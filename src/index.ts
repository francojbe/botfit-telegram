import { config } from './config';
import { Telegraf, session, Scenes, Markup } from 'telegraf';
import path from 'path';
import fs from 'fs';
import express from 'express';
import authRouter from './routes/authRouter';

// Importar servicios compartidos y flujos
import { procesarMensaje, analizarFoto } from './services/aiService';
import {
  asentarComida,
  registrarEntrenamiento,
  obtenerUltimoEntrenamiento,
  registrarEjercicio,
  guardarMensaje,
  actualizarPerfil,
  obtenerUsuario,
  registrarPeso,
  obtenerResumenNutricionalHoy,
  obtenerEntrenamientoHoy,
  obtenerEntrenamientoPorFecha,
  obtenerHistorialComidas,
  obtenerHistorialPesos,
  obtenerHistorialEntrenos
} from './services/userService';
import { getNextRoutine, generateWorkoutMessage } from './services/workoutService';
import { onboardingWizard, MyContext } from './bot/scenes/onboarding';
import { iniciarRecordatorios } from './bot/cron';
import {
  getAuthUrl,
  tieneConexionGoogleFit,
  obtenerDatosDiarios,
  formatearDatosFit
} from './services/googleFitService';

const BOT_TOKEN = config.telegramToken;
if (!BOT_TOKEN) {
  console.error('ERROR CRÍTICO: TELEGRAM_BOT_TOKEN no configurado.');
  process.exit(1);
}

// ─── INICIALIZACIÓN ─────────────────────────────────────────────────────────
const bot = new Telegraf<any>(BOT_TOKEN);
const stage = new Scenes.Stage<MyContext>([onboardingWizard]);

bot.use(session());
bot.use(stage.middleware());

// ─── TECLADO PRINCIPAL (siempre visible) ────────────────────────────────────
export const MAIN_KEYBOARD = Markup.keyboard([
  ['🏋️ Mi Rutina', '📊 Mi Día'],
  ['📅 Mi Historial', '📱 Google Fit'],
  ['👤 Mi Perfil', '💬 Hablar con el Coach'],
  ['🔄 Reconfigurar Perfil'],
]).resize();
// "resize" hace el teclado compacto y no ocupa toda la pantalla

// ─── SERVIDOR OAUTH LOCAL ────────────────────────────────────────────────────
const expressApp = express();
expressApp.use('/auth', authRouter);
expressApp.listen(3456, () => {
  console.log('[Auth] Servidor OAuth escuchando en http://localhost:3456');
});
console.log('[Bot] Sessiones y Scenes configuradas');

bot.catch((err: any, ctx: any) => {
  console.error(`[Bot] Error no manejado en update ${ctx.updateType}:`, err);
});

// Iniciar cron jobs
iniciarRecordatorios(bot);


// ─── COMANDOS ────────────────────────────────────────────────────────────────

// /start → Onboarding o re-onboarding
bot.start((ctx) => {
  ctx.scene.enter('ONBOARDING_WIZARD');
});

// Botones del teclado persistente → redirigen al comando correspondiente
bot.hears(/Mi Rutina/i, async (ctx) => {
  console.log(`[Bot] Botón presionado: Mi Rutina`);
  await handleRutina(ctx);
});

bot.hears(/Mi Día/i, async (ctx) => {
  console.log(`[Bot] Botón presionado: Mi Día`);
  // Intentamos imitar el comando /stats
  await handleStats(ctx);
});

bot.hears(/Mi Perfil/i, async (ctx) => {
  console.log(`[Bot] Botón presionado: Mi Perfil`);
  await handlePerfil(ctx);
});

bot.hears(/Hablar con el Coach/i, async (ctx) => {
  console.log(`[Bot] Botón presionado: Hablar con el Coach`);
  await ctx.reply(
    '¡Hola! Escríbeme lo que quieras 💬\n\nPuedo ayudarte con:\n• Registrar comidas: _"Comí arroz con pollo"_\n• Registrar peso: _"Pesé 80kg"_\n• Registrar ejercicios: _"Hice sentadilla 50kg 10 reps"_\n• Preguntar cualquier cosa sobre entrenamiento o nutrición',
    { parse_mode: 'Markdown', ...MAIN_KEYBOARD }
  );
});

bot.hears(/Reconfigurar Perfil/i, (ctx) => {
  console.log(`[Bot] Botón presionado: Reconfigurar Perfil`);
  ctx.scene.enter('ONBOARDING_WIZARD');
});

// ─── GOOGLE FIT ───────────────────────────────────────────────────────────────

bot.hears(/Google Fit/i, async (ctx) => {
  console.log(`[Bot] Botón presionado: Google Fit`);
  const userId = ctx.from.id;
  const conectado = await tieneConexionGoogleFit(userId);

  if (!conectado) {
    // Primera vez: mostrar botón de conexión OAuth
    const url = getAuthUrl(userId);
    await ctx.reply(
      '📱 *Conectar Google Fit*\n\n' +
      'Vincula tu cuenta para ver pasos, calorías quemadas, distancia y más directamente aquí.\n\n' +
      '1️⃣ Pulsa el botón de abajo\n' +
      '2️⃣ Inicia sesión con tu Google\n' +
      '3️⃣ Acepta los permisos\n' +
      '4️⃣ Vuelve aquí y presiona 📱 Google Fit de nuevo',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('🔗 Conectar con Google Fit', url)]
        ])
      }
    );
    return;
  }

  // Ya conectado: mostrar submenú
  await ctx.reply(
    '📱 *Google Fit*\n¿Qué quieres ver?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Actividad de hoy',    'fit_hoy')],
        [Markup.button.callback('🔄 Reconectar cuenta',  'fit_reconectar')],
      ])
    }
  );
});

bot.action('fit_hoy', async (ctx) => {
  await ctx.answerCbQuery('Cargando datos...');
  const userId = ctx.from!.id;

  try {
    await ctx.reply('⏳ Obteniendo datos de Google Fit...');
    const userData = await obtenerUsuario(userId);
    const datos = await obtenerDatosDiarios(userId);
    const metaPasos = (userData?.neat_pasos_meta) || 8000;
    const mensaje = formatearDatosFit(datos, metaPasos);
    await ctx.reply(mensaje, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
  } catch (error: any) {
    console.error('[GoogleFit] Error:', error.message);
    await ctx.reply(
      '❌ Error al leer tus datos de Google Fit.\n\nPosibles causas:\n• La sesión expiró — pulsa 🔄 Reconectar\n• Google Fit no tiene datos de hoy',
      MAIN_KEYBOARD
    );
  }
});

bot.action('fit_reconectar', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const url = getAuthUrl(userId);
  await ctx.reply(
    '🔄 Pulsa el botón para reconectar tu cuenta de Google:',
    Markup.inlineKeyboard([[Markup.button.url('🔗 Reconectar Google Fit', url)]])
  );
});

// Botón "Mi Historial" → Submenú inline con 3 opciones
bot.hears(/Mi Historial/i, async (ctx) => {
  console.log(`[Bot] Botón presionado: Mi Historial`);
  await ctx.reply(
    '📅 *¿Qué quieres revisar?*\nElige una opción:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🍽 Comidas (7 días)',      'hist_comidas')],
        [Markup.button.callback('⚖️ Pesos (7 días)',        'hist_pesos')],
        [Markup.button.callback('🏋️ Entrenos (7 días)',    'hist_entrenos')],
      ])
    }
  );
});

// ─── CALLBACKS HISTORIAL ─────────────────────────────────────────────────────

bot.action('hist_comidas', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const comidas = await obtenerHistorialComidas(userId, 7);

  if (!comidas.length) {
    return ctx.reply('📭 No tienes comidas registradas en los últimos 7 días.\nEscríbeme lo que comes y lo registro automáticamente.', MAIN_KEYBOARD);
  }

  // Agrupar por día
  const porDia: Record<string, typeof comidas> = {};
  for (const c of comidas) {
    const dia = new Date(c.created_at).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(c);
  }

  let msg = '🍽 *Tus comidas — últimos 7 días*\n';
  for (const [dia, items] of Object.entries(porDia)) {
    const totalCal = items.reduce((s, x) => s + (x.est_calorias || 0), 0);
    const totalProt = items.reduce((s, x) => s + (x.est_proteina || 0), 0);
    msg += `\n📆 *${dia}* — ${totalCal} kcal · ${totalProt}g prot\n`;
    for (const c of items) {
      msg += `  • ${c.descripcion_original}\n`;
    }
  }

  await ctx.reply(msg, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
});

bot.action('hist_pesos', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const pesos = await obtenerHistorialPesos(userId, 7);

  if (!pesos.length) {
    return ctx.reply('📭 No tienes pesos registrados en los últimos 7 días.\nDime "hoy peso 80kg" para registrarlo.', MAIN_KEYBOARD);
  }

  let msg = '⚖️ *Tus registros de peso — últimos 7 días*\n\n';
  const primero = pesos[pesos.length - 1]?.peso_actual;
  const ultimo  = pesos[0]?.peso_actual;
  const diff = primero && ultimo ? (ultimo - primero).toFixed(1) : null;

  for (const p of pesos) {
    const fecha = new Date(p.created_at).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
    msg += `📆 ${fecha}: *${p.peso_actual} kg*`;
    if (p.notas) msg += ` — _${p.notas}_`;
    msg += '\n';
  }

  if (diff !== null) {
    const emoji = parseFloat(diff) < 0 ? '📉' : parseFloat(diff) > 0 ? '📈' : '➡️';
    msg += `\n${emoji} Variación del período: *${parseFloat(diff) > 0 ? '+' : ''}${diff} kg*`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
});

bot.action('hist_entrenos', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from!.id;
  const entrenos = await obtenerHistorialEntrenos(userId, 7);

  if (!entrenos.length) {
    return ctx.reply('📭 No tienes entrenamientos registrados en los últimos 7 días.\nUsa el botón 🏋️ Mi Rutina para empezar.', MAIN_KEYBOARD);
  }

  let msg = '🏋️ *Tus entrenamientos — últimos 7 días*\n';
  for (const e of entrenos) {
    const fecha = new Date(e.created_at).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
    const estado = e.completado ? '✅' : '⏸';
    msg += `\n${estado} *${fecha}* — Día ${e.workout_type || '?'}: ${e.rutina_texto}\n`;
    if (e.exercise_logs && e.exercise_logs.length > 0) {
      for (const ex of e.exercise_logs.slice(0, 4)) {
        msg += `  └ ${ex.exercise_name}: ${ex.weight_kg ?? '?'}kg × ${ex.reps ?? '?'} reps\n`;
      }
      if (e.exercise_logs.length > 4) msg += `  └ ...y ${e.exercise_logs.length - 4} ejercicios más\n`;
    }
  }

  await ctx.reply(msg, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
});


// /help → Lista de comandos
bot.help((ctx) => {
  ctx.reply(
    '🤖 *Coach de Fitness IA*\n\n' +
    'Usa los botones del menú de abajo para todo 👇\n\n' +
    '🏋️ *Mi Rutina* — Tu entrenamiento del día\n' +
    '📊 *Mi Día* — Resumen de calorías y actividad\n' +
    '👤 *Mi Perfil* — Ver tu perfil y metas\n' +
    '💬 *Hablar con el Coach* — Chat libre de nutrición y entreno\n' +
    '🔄 *Reconfigurar Perfil* — Modificar tus datos\n\n' +
    '_También puedes escribirme directamente:_\n' +
    '_"Comí un sándwich"_, _"Pesé 80kg"_, _"Hice sentadilla"_\n' +
    '_O enviarme una foto de tu comida._ 📸',
    { parse_mode: 'Markdown', ...MAIN_KEYBOARD }
  );
});

// /rutina → Entrenamiento del día con sobrecarga progresiva
bot.command('rutina', async (ctx) => handleRutina(ctx));

async function handleRutina(ctx: any) {
  try {
    const userId = ctx.from.id;
    await ctx.reply('⏳ Calculando tu rutina del día...');

    const userData = await obtenerUsuario(userId);
    const routine = await getNextRoutine(userId);
    const message = await generateWorkoutMessage(userId, routine, userData);

    await registrarEntrenamiento(userId, `Día ${routine.day}: ${routine.name}`, routine.day, false);
    await ctx.replyWithHTML(message + `\n\n_Registra tu progreso escribiéndome: "Sentadilla 50kg 8 reps"_`);
    // Mostrar teclado principal después del mensaje de rutina
    await ctx.reply('¿Qué más necesitas?', MAIN_KEYBOARD);
  } catch (error: any) {
    console.error('[Cmd /rutina] Error:', error);
    await ctx.reply('Error generando tu rutina. Intenta de nuevo.', MAIN_KEYBOARD);
  }
}

// /stats → Resumen del día (nutrición + peso + entreno)
bot.command('stats', async (ctx) => {
  console.log(`[Stats] Comando /stats recibido`);
  await handleStats(ctx);
});

async function handleStats(ctx: any) {
  try {
    const userId = ctx.from.id;
    const userData = await obtenerUsuario(userId);

    if (!userData) {
      return ctx.reply('Primero configura tu perfil con /start');
    }

    const nutricion = await obtenerResumenNutricionalHoy(userId);
    const entrenoHoy = await obtenerEntrenamientoHoy(userId);

    let mensaje = `📊 *Tu día de hoy*\n\n`;

    // Bloque de nutrición
    if (nutricion) {
      const calRestantes = (userData.calorias_meta || 2000) - nutricion.calorias;
      const proRestante = (userData.proteina_meta || 150) - nutricion.proteina;
      mensaje += `🍽 *Nutrición (${nutricion.registros} comidas registradas)*\n`;
      mensaje += `• Calorías: ${nutricion.calorias} / ${userData.calorias_meta} kcal`;
      mensaje += calRestantes > 0 ? ` (${calRestantes} restantes)\n` : ` ⚠️ Superado\n`;
      mensaje += `• Proteína: ${nutricion.proteina}g / ${userData.proteina_meta}g`;
      mensaje += proRestante > 0 ? ` (${proRestante}g restantes)\n` : ` ✅\n`;
      mensaje += `• Carbs: ${nutricion.carbs}g | Grasas: ${nutricion.grasas}g\n\n`;
    } else {
      mensaje += `🍽 *Nutrición*\nAún no registraste comidas hoy.\n→ Escríbeme lo que comiste y lo asiento automáticamente.\n\n`;
    }

    // Bloque de entrenamiento
    if (entrenoHoy) {
      mensaje += `🏋️ *Entrenamiento*\n`;
      mensaje += `• Completaste: ${entrenoHoy.rutina_texto || 'Entrenamiento'}\n`;
      if (entrenoHoy.exercise_logs && entrenoHoy.exercise_logs.length > 0) {
        entrenoHoy.exercise_logs.slice(0, 3).forEach((ex: any) => {
          mensaje += `  └ ${ex.exercise_name}: ${ex.weight_kg}kg × ${ex.reps} reps\n`;
        });
      }
      mensaje += '\n';
    } else {
      mensaje += `🏋️ *Entrenamiento*\nNo entrenaste hoy (o no está registrado).\n→ Usa /rutina para obtener tu sesión del día.\n\n`;
    }

    mensaje += `_Sigue registrando todo para que el análisis sea más preciso._`;

    await ctx.reply(mensaje, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
  } catch (error: any) {
    console.error('[Cmd /stats] Error:', error);
    await ctx.reply('Error generando el resumen. Intenta de nuevo.', MAIN_KEYBOARD);
  }
}

// /perfil → Ver perfil actual
bot.command('perfil', async (ctx) => handlePerfil(ctx));

async function handlePerfil(ctx: any) {
  try {
    const userId = ctx.from.id;
    const userData = await obtenerUsuario(userId);

    if (!userData) {
      return ctx.reply('No tienes perfil aún. Usa /start para crearlo.');
    }

    await ctx.reply(
      `👤 *Tu Perfil Actual*\n\n` +
      `• Objetivo: ${userData.objetivo}\n` +
      `• Peso inicial: ${userData.peso_inicial}kg\n` +
      `• Altura: ${userData.altura}cm\n` +
      `• Edad: ${userData.edad} años\n\n` +
      `🎯 *Metas Diarias*\n` +
      `• Calorías: ${userData.calorias_meta} kcal\n` +
      `• Proteína: ${userData.proteina_meta}g\n\n` +
      `_Para actualizar tus datos usa el botón 🔄 Reconfigurar Perfil o dime: "Cambiar mi objetivo a ganar músculo"_`,
      { parse_mode: 'Markdown', ...MAIN_KEYBOARD }
    );
  } catch (error: any) {
    console.error('[Cmd /perfil] Error:', error);
    await ctx.reply('Error obteniendo tu perfil.', MAIN_KEYBOARD);
  }
}


// ─── HANDLERS MULTIMODALES ───────────────────────────────────────────────────

// Procesar Fotos (Vision AI → estimación de macros)
bot.on('photo', async (ctx) => {
  try {
    const userId = ctx.from.id;
    await guardarMensaje(userId, 'user', '[FOTO ENVIADA]');

    const foto = ctx.message.photo.pop();
    if (!foto) return;

    await ctx.reply('🔍 Analizando tu comida...');

    const link = await ctx.telegram.getFileLink(foto.file_id);
    const imageUrl = link.href;
    const caption = ctx.message.caption || '';
    const respuestaIA = await analizarFoto(userId, imageUrl, caption);
    console.log(`[Bot] Respuesta IA (Foto): ${respuestaIA.substring(0, 100)}...`);
    const { mensaje: cleanMessage, confirmaciones } = await ejecutarAccionesAgente(ctx, userId, respuestaIA, imageUrl);

    const respuestaFinal = [cleanMessage, ...confirmaciones].filter(Boolean).join('\n');
    await guardarMensaje(userId, 'assistant', cleanMessage);
    await ctx.reply(respuestaFinal, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
  } catch (error) {
    console.error('[Bot] Error analizando foto:', error);
    await ctx.reply('Error analizando la foto. Intenta de nuevo.');
  }
});

// Procesar Texto Libre (Chat con IA)
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const texto = ctx.message.text;

  console.log(`[Bot] Texto de ${userId}: "${texto}"`);
  await guardarMensaje(userId, 'user', texto);

  // Ignorar comandos no registrados
  if (texto.startsWith('/')) return;

  try {
    const respuestaIA = await procesarMensaje(userId, texto);
    const { mensaje: cleanMessage, confirmaciones } = await ejecutarAccionesAgente(ctx, userId, respuestaIA);

    const respuestaFinal = [cleanMessage, ...confirmaciones].filter(Boolean).join('\n');
    await guardarMensaje(userId, 'assistant', cleanMessage);
    // Mostrar el teclado junto con la respuesta
    await ctx.reply(respuestaFinal, MAIN_KEYBOARD);
  } catch (error) {
    console.error('[Bot] Error procesando texto:', error);
    await ctx.reply('Error procesando tu mensaje. Intenta de nuevo.', MAIN_KEYBOARD);
  }
});


// ─── AGENTE AUTÓNOMO ─────────────────────────────────────────────────────────

/**
 * Parsea y ejecuta acciones JSON embebidas en la respuesta de la IA.
 * Retorna el mensaje limpio (sin tags) y las confirmaciones de acciones ejecutadas.
 *
 * MEJORA vs. versión anterior: parser robusto que tolera JSONs multilinea.
 */
async function ejecutarAccionesAgente(
  ctx: any,
  userId: number,
  rawMessage: string,
  imageUrl: string | null = null
): Promise<{ mensaje: string; confirmaciones: string[] }> {

  const confirmaciones: string[] = [];
  let cleanMessage = rawMessage;

  // Parser robusto: dividir por "ACCION:" (insensible a mayúsculas) y extraer JSON balanceando llaves
  const partes = rawMessage.split(/ACCION:\s*/i);

  for (let i = 1; i < partes.length; i++) {
    const parte = partes[i].trim();
    const jsonStart = parte.indexOf('{');
    if (jsonStart === -1) continue;

    // Extraer JSON balanceando llaves para tolerar multilineas
    let depth = 0;
    let jsonEnd = -1;
    for (let j = jsonStart; j < parte.length; j++) {
      if (parte[j] === '{') depth++;
      if (parte[j] === '}') depth--;
      if (depth === 0) { jsonEnd = j + 1; break; }
    }

    if (jsonEnd === -1) continue;

    const jsonStr = parte.substring(jsonStart, jsonEnd);

    // Remover el tag completo del mensaje visible (insensible a mayúsculas)
    const tagMatch = cleanMessage.match(/ACCION:\s*/i);
    if (tagMatch) {
      const startIndex = cleanMessage.toLowerCase().indexOf(tagMatch[0].toLowerCase());
      // Intentamos remover desde el tag hasta el fin del JSON de forma precisa
      cleanMessage = (cleanMessage.substring(0, startIndex) + cleanMessage.substring(startIndex + tagMatch[0].length + jsonStr.length)).trim();
    }

    try {
      const action = JSON.parse(jsonStr);
      console.log(`[Agente] Ejecutando: ${action.tipo} para usuario ${userId}`);

      switch (action.tipo) {
        case 'LOG_MEAL': {
          await asentarComida(userId, action.descripcion || 'Comida', imageUrl, {
            calorias: action.calorias,
            proteina: action.proteina,
            carbs: action.carbs,
            grasas: action.grasas
          }, action.fecha);
          confirmaciones.push(
            `✅ _Comida registrada${action.fecha ? ` (${action.fecha})` : ''}: ~${action.calorias ?? '?'} kcal · ${action.proteina ?? '?'}g proteína_`
          );
          break;
        }

        case 'LOG_EXERCISE': {
          const targetDate = action.fecha || new Date().toLocaleDateString('en-CA');
          let workout = await obtenerEntrenamientoPorFecha(userId, targetDate);

          if (!workout) {
            console.log(`[Agente] No hay entrenamiento el ${targetDate}. Creando...`);
            const newId = await registrarEntrenamiento(userId, 'Entrenamiento Manual', 'M', true, targetDate);
            workout = { id: newId };
          }

          if (action.ejercicios && Array.isArray(action.ejercicios)) {
            let guardados = 0;
            for (const ex of action.ejercicios) {
              const ok = await registrarEjercicio(userId, (workout as any).id, ex, targetDate);
              if (ok) guardados++;
            }
            if (guardados > 0) {
              const lista = action.ejercicios.map((e: any) => `${e.nombre} ${e.peso ?? '?'}kg×${e.reps}`).join(', ');
              confirmaciones.push(`✅ _${guardados} ejercicios guardados${action.fecha ? ` del ${action.fecha}` : ''}: ${lista}_`);
            }
          }
          break;
        }

        case 'LOG_WEIGHT': {
          await registrarPeso(userId, action.peso, action.notas || '', action.fecha);
          confirmaciones.push(`✅ _Peso registrado${action.fecha ? ` (${action.fecha})` : ''}: ${action.peso}kg_`);
          break;
        }

        case 'UPDATE_PROFILE': {
          if (action.datos && typeof action.datos === 'object') {
            await actualizarPerfil(userId, action.datos);
            const campos = Object.keys(action.datos).join(', ');
            confirmaciones.push(`✅ _Perfil actualizado: ${campos}_`);
          }
          break;
        }

        default:
          console.warn(`[Agente] Acción desconocida: ${action.tipo}`);
      }
    } catch (e) {
      console.error('[Agente] Error al parsear/ejecutar acción:', jsonStr, e);
    }
  }

  return { mensaje: cleanMessage, confirmaciones };
}


// ─── ARRANQUE ────────────────────────────────────────────────────────────────
bot.telegram.getMe().then((me) => {
  console.log(`[Bot] Conectado como @${me.username}`);
  return bot.launch({ dropPendingUpdates: true });
}).then(() => {
  console.log('✅✅✅ BOT ONLINE ✅✅✅');
}).catch((err) => {
  console.error('❌ Error al lanzar bot:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
