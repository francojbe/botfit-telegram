import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import {
  obtenerUsuario,
  obtenerUltimosEjercicios,
  obtenerHistorialChat,
  obtenerResumenNutricionalHoy
} from './userService';

const PROXY_URL = config.proxyApiUrl;
const AUTH_SECRET = config.proxyAuthSecret;

// Cargar la metodología base para el System Prompt
const metodologiaPath = path.resolve(__dirname, '../../metodologia.md');
let metodologiaBase = '';
try {
  metodologiaBase = fs.readFileSync(metodologiaPath, 'utf-8');
} catch {
  // La metodología ahora está embebida en el system prompt como fallback
  metodologiaBase = `
Eres un experto en recomposición corporal. Filosofía: entrenamiento de fuerza con mancuernas 3-4 días/semana,
rutinas Full-Body o Upper/Lower, ejercicios compuestos (sentadilla goblet, press banca, remo, peso muerto rumano),
sobrecarga progresiva obligatoria, déficit calórico ligero (-300 kcal), proteína 2g/kg de peso.
  `;
}

/**
 * Construye el bloque de contexto del usuario para el System Prompt.
 */
async function buildUserContext(userId: number): Promise<string> {
  const userData = await obtenerUsuario(userId);
  const ultimosEjercicios = await obtenerUltimosEjercicios(userId, 5);
  const nutricionHoy = await obtenerResumenNutricionalHoy(userId);

  let ctx = '';

  if (userData) {
    ctx += `\n═══ PERFIL DEL USUARIO ═══\n`;
    ctx += `• Objetivo: ${userData.objetivo}\n`;
    ctx += `• Peso inicial: ${userData.peso_inicial}kg\n`;
    ctx += `• Meta calórica: ${userData.calorias_meta} kcal/día\n`;
    ctx += `• Meta proteína: ${userData.proteina_meta}g/día\n`;
  }

  if (nutricionHoy) {
    const calMeta = userData?.calorias_meta || 2000;
    const proMeta = userData?.proteina_meta || 150;
    const calRestantes = calMeta - nutricionHoy.calorias;
    const proRestante = proMeta - nutricionHoy.proteina;

    ctx += `\n═══ INGESTA DE HOY (${nutricionHoy.registros} comidas registradas) ═══\n`;
    ctx += `• Calorías: ${nutricionHoy.calorias} / ${calMeta} kcal (${calRestantes > 0 ? `${calRestantes} restantes` : '⚠️ SUPERADO'})\n`;
    ctx += `• Proteína: ${nutricionHoy.proteina}g / ${proMeta}g (${proRestante > 0 ? `${proRestante}g restantes` : '✅ Meta alcanzada'})\n`;
    ctx += `• Carbs: ${nutricionHoy.carbs}g | Grasas: ${nutricionHoy.grasas}g\n`;

    if (calRestantes < 0) {
      ctx += `→ ALERTA: El usuario superó sus calorías hoy. Menciona esto si es relevante.\n`;
    } else if (proRestante > 50) {
      ctx += `→ ACCIÓN: Recomienda una fuente de proteína si el usuario pregunta qué comer.\n`;
    }
  } else {
    ctx += `\n═══ INGESTA DE HOY ═══\n• Sin comidas registradas hoy.\n`;
  }

  if (ultimosEjercicios.length > 0) {
    ctx += `\n═══ ÚLTIMOS EJERCICIOS REGISTRADOS ═══\n`;
    ultimosEjercicios.forEach(ex => {
      ctx += `• ${ex.exercise_name}: ${ex.weight_kg}kg × ${ex.reps} reps (${new Date(ex.fecha).toLocaleDateString('es-CL')})\n`;
    });
    ctx += `→ Usa esto para comparar y alentar la sobrecarga progresiva.\n`;
  }

  return ctx;
}

/**
 * Procesa un mensaje de texto o imagen usando el Proxy API (OpenAI Compatible).
 * Incluye: System Prompt dinámico + Historial de conversación + Contexto nutricional.
 */
export async function procesarMensaje(userId: number, mensaje: string, imageUrl?: string): Promise<string> {
  console.log(`[aiService] Procesando mensaje de ${userId} (imagen: ${!!imageUrl})...`);

  // Construir contexto del usuario (perfil + nutrición + ejercicios)
  const userContext = await buildUserContext(userId);

  // Obtener historial conversacional para dar memoria real a la IA
  const historial = await obtenerHistorialChat(userId, 12);
  console.log(`[aiService] Historial cargado: ${historial.length} mensajes`);

  const systemPrompt = `
Eres un COACH de fitness y nutrición de élite que trabaja por Telegram. Debes transformar al usuario usando ciencia, no motivación vacía.

═══ METODOLOGÍA BASE ═══
${metodologiaBase}

${userContext}

═══ TUS HERRAMIENTAS (ACCIONES DE AGENTE) ═══
Puedes ejecutar acciones en la base de datos incluyendo estos tags al FINAL de tu respuesta.
Incluye TODOS los que apliquen según el mensaje del usuario.

3. Si el usuario reporta algo de "ayer" o una fecha específica, incluye el campo "fecha" (YYYY-MM-DD) en la acción. Hoy es ${new Date().toLocaleDateString('en-CA')}.

1. REGISTRO DE COMIDA:
   ACCION: {"tipo":"LOG_MEAL","descripcion":"Pollo con arroz","calorias":520,"proteina":45,"carbs":55,"grasas":12, "fecha": "YYYY-MM-DD"}

2. REGISTRO DE EJERCICIOS:
   ACCION: {"tipo":"LOG_EXERCISE","ejercicios":[{"nombre":"Sentadilla","series":4,"reps":8,"peso":50}], "fecha": "YYYY-MM-DD"}

3. REGISTRO DE PESO CORPORAL:
   ACCION: {"tipo":"LOG_WEIGHT","peso":80.5,"notas":"En ayunas", "fecha": "YYYY-MM-DD"}

4. ACTUALIZACIÓN DE PERFIL:
   ACCION: {"tipo":"UPDATE_PROFILE","datos":{"campo":"valor"}}
   Campos válidos: objetivo, calorias_meta, proteina_meta, edad, altura

═══ REGLAS DE ORO ═══
1. Analiza siempre los datos del usuario ANTES de responder. Personaliza cada respuesta.
2. Si el usuario menciona una comida (aunque sea vagamente), estima macros y lanza LOG_MEAL.
3. Si menciona un ejercicio con peso/reps, lanza LOG_EXERCISE.
4. Si menciona su peso corporal, lanza LOG_WEIGHT.
5. Respuestas CORTAS y DIRECTAS (máx 200 palabras), estilo coach profesional. Sin emojis excesivos.
6. NUNCA expliques al usuario que estás ejecutando acciones, solo hazlo.
7. Nunca muestres los tags ACCION: en la parte visible del mensaje; solo escríbelos al final.
`;

  try {
    // Construir array de mensajes con historial real
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...historial, // Inyectar las últimas 12 conversaciones como contexto
    ];

    // Agregar el mensaje actual (texto o imagen)
    if (imageUrl) {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(imageResponse.data as any, 'binary').toString('base64');
      const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';

      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: mensaje || 'Analiza esta comida según nuestra metodología.' },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` }
          }
        ]
      });
    } else {
      messages.push({ role: 'user', content: mensaje });
    }

    console.log(`[aiService] Enviando ${messages.length} mensajes al proxy (${historial.length} de historial + 1 nuevo)`);

    const response = await axios.post(PROXY_URL, {
      model: 'multi-ia-proxy',
      messages,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 45000
    });

    const data = response.data as any;
    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    return 'Recibí tu mensaje, pero mi conexión cerebral está lenta. ¿Puedes repetirlo?';
  } catch (error: any) {
    console.error('[aiService] Error en Proxy API:', error.response?.data || error.message);
    return 'Tuve un problema técnico al procesar tu consulta. ¡Inténtalo de nuevo en un momento!';
  }
}

/**
 * Función puente para compatibilidad: analizar foto de comida.
 */
export async function analizarFoto(userId: number, imageUrl: string): Promise<string> {
  return procesarMensaje(userId, 'Analiza esta comida detalladamente. Estima calorías y macros según nuestra metodología.', imageUrl);
}

/**
 * Genera un reporte semanal personalizado para el Check-in del Cron.
 * NOT exported via procesarMensaje to avoid storing in chat_logs.
 */
export async function generarReporteSemanal(userId: number, promedioActual: number | null, promedioAnterior: number | null, userData: any): Promise<string> {
  const diff = (promedioActual && promedioAnterior) ? (promedioActual - promedioAnterior).toFixed(2) : null;
  
  const prompt = `Genera un check-in semanal de coaching. Datos del usuario:
- Objetivo: ${userData?.objetivo || 'Recomposición'}
- Meta calórica: ${userData?.calorias_meta || '?'} kcal
- Promedio de peso esta semana: ${promedioActual ?? 'sin datos'}kg
- Promedio semana pasada: ${promedioAnterior ?? 'sin datos'}kg
- Variación: ${diff ? `${parseFloat(diff) > 0 ? '+' : ''}${diff}kg` : 'no calculable'}

Redacta un mensaje de coaching semanal: analiza el progreso, da una conclusión técnica BREVE (buena noticia o acción correctiva), y termina con una pregunta motivadora para la semana. Máximo 150 palabras. NO uses saludos genéricos.`;

  try {
    const sysReporte = `Eres un coach de fitness de élite respondiendo el check-in semanal de un cliente. Basado en los datos, da feedback técnico directo y personalizado.`;
    
    const response = await axios.post(PROXY_URL, {
      model: 'multi-ia-proxy',
      messages: [
        { role: 'system', content: sysReporte },
        { role: 'user', content: prompt }
      ],
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const data = response.data as any;
    return data?.choices?.[0]?.message?.content || '📊 Check-in semanal: ¡Sigue registrando tu peso para que pueda analizar tu progreso!';
  } catch (e) {
    return '📊 Check-in semanal: ¡Sigue registrando tu peso todos los días para que pueda analizar tu tendencia!';
  }
}
