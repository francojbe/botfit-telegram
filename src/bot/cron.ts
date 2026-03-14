import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { obtenerTodosLosUsuarios, obtenerPromedioSemanal, obtenerUsuario } from '../services/userService';
import { generarReporteSemanal } from '../services/aiService';

/**
 * Inicializa todos los jobs programados del bot.
 */
export function iniciarRecordatorios(bot: Telegraf<any>) {
  
  // ─── CHECK-IN SEMANAL ────────────────────────────────────────────────────────
  // Todos los domingos a las 10:00 AM
  cron.schedule('0 10 * * 0', async () => {
    console.log('[Cron] Ejecutando Check-in Semanal...');

    try {
      const usuarios = await obtenerTodosLosUsuarios();
      console.log(`[Cron] Procesando ${usuarios.length} usuarios...`);

      for (const usuario of usuarios) {
        try {
          const userId = usuario.telegram_id;
          
          // Obtener promedios de esta semana (últimos 7 días) y la anterior (7-14 días atrás)
          const promedioActual = await obtenerPromedioSemanal(userId, 7);
          const promedioAnterior = await obtenerPromedioSemanal(userId, 14);

          // Ajuste: el "anterior" debe ser solo los días 8-14, no acumulado.
          // Si ambos son iguales porque el usuario solo tiene datos de esta semana, el anterior será null
          const promedioSemanaPrevia = (promedioAnterior && promedioActual && promedioAnterior !== promedioActual)
            ? promedioAnterior
            : null;

          const userData = await obtenerUsuario(userId);
          
          // Generar reporte con IA
          const reporte = await generarReporteSemanal(userId, promedioActual, promedioSemanaPrevia, userData);

          // Encabezado siempre igual
          const encabezado = `📊 *Check-in Semanal — Domingo*\n\n`;
          const statsBase = promedioActual
            ? `⚖️ Tu promedio de peso esta semana: *${promedioActual}kg*\n` +
              (promedioSemanaPrevia ? `│  Semana anterior: ${promedioSemanaPrevia}kg\n` : '') +
              `\n`
            : `⚖️ No registraste tu peso esta semana.\n→ Hazlo todos los días en ayunas para que pueda acompañarte mejor.\n\n`;

          await bot.telegram.sendMessage(userId, encabezado + statsBase + reporte, { parse_mode: 'Markdown' });
          console.log(`[Cron] Check-in enviado a usuario ${userId}`);
          
          // Esperar 1 segundo entre mensajes para respetar rate limits
          await new Promise(r => setTimeout(r, 1000));
        } catch (userErr) {
          console.error(`[Cron] Error procesando usuario ${usuario.telegram_id}:`, userErr);
        }
      }
    } catch (error) {
      console.error('[Cron] Error en check-in semanal:', error);
    }
  });

  // ─── RECORDATORIO DIARIO DE AGUA / NEAT ─────────────────────────────────────
  // Todos los días hábiles (L-V) a las 13:00
  cron.schedule('0 13 * * 1-5', async () => {
    console.log('[Cron] Ejecutando recordatorio NEAT...');

    const recordatorios = [
      '⚡ *Recordatorio:* ¿Ya sumaste pasos hoy? El NEAT (actividad no programada) quema tanta grasa como el cardio. ¡Muévete!',
      '💧 *Hidratación:* ¿Llegaste a 2L de agua? El agua mejora la síntesis de proteínas y el rendimiento en el gym.',
      '🚶 *NEAT check:* 8.000 pasos diarios equivalen a quemar ~300 kcal extra. ¿Cómo vas?',
      '🍗 *Proteína:* ¿Alcanzaste tu meta de proteína hoy? Es lo más importante para mantener músculo y bajar grasa.',
    ];

    const mensaje = recordatorios[new Date().getDay() % recordatorios.length];

    try {
      const usuarios = await obtenerTodosLosUsuarios();
      for (const usuario of usuarios) {
        try {
          await bot.telegram.sendMessage(usuario.telegram_id, mensaje, { parse_mode: 'Markdown' });
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          // Usuario puede haber bloqueado el bot, continúa
        }
      }
    } catch (error) {
      console.error('[Cron] Error en recordatorio NEAT:', error);
    }
  });

  console.log('[Cron] Jobs registrados: Check-in semanal (dom 10:00) + Recordatorio NEAT (L-V 13:00)');
}
