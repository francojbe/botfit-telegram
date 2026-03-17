import { Scenes, Markup } from 'telegraf';
import { crearUsuario } from '../../services/userService';

// Teclado principal persistente (mismo que en index.ts)
const MAIN_KEYBOARD = Markup.keyboard([
  ['🏋️ Mi Rutina', '📊 Mi Día'],
  ['📅 Mi Historial', '📱 Google Fit'],
  ['👤 Mi Perfil', '💬 Hablar con el Coach'],
  ['🔄 Reconfigurar Perfil'],
]).resize();

// Interfaz para el contexto de la sesión temporal (Wizard)
interface MyWizardSession extends Scenes.WizardSessionData {
  edad?: number;
  peso?: number;
  altura?: number;
  genero?: 'M' | 'F';
  actividad?: number; // Factor multiplicador
  meta?: string;
}

// Extensión del contexto de Telegraf
export interface MyContext extends Scenes.WizardContext<MyWizardSession> {}

export const onboardingWizard = new Scenes.WizardScene<MyContext>(
  'ONBOARDING_WIZARD',
  async (ctx) => {
    await ctx.reply('¡Bienvenido! Iniciemos tu transformación. Necesito conocerte un poco.\n\n¿Qué edad tienes? (Escribe solo números)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const edad = parseInt((ctx.message as any)?.text);
    if (isNaN(edad)) {
      await ctx.reply('Por favor, ingresa solo un número para tu edad.');
      return;
    }
    ctx.scene.session.edad = edad;
    await ctx.reply('Perfecto. ¿Cuál es tu género?\n1. Hombre 👤\n2. Mujer 👤');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const opcion = (ctx.message as any)?.text;
    if (opcion !== '1' && opcion !== '2') {
      await ctx.reply('Por favor, elige 1 para Hombre o 2 para Mujer.');
      return;
    }
    ctx.scene.session.genero = opcion === '1' ? 'M' : 'F';
    await ctx.reply('Anotado. Ahora, ¿cuál es tu peso actual en kg? (Ejemplo: 78.5)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const pesoText = (ctx.message as any)?.text?.replace(',', '.');
    const peso = parseFloat(pesoText);
    if (isNaN(peso)) {
      await ctx.reply('Por favor, ingresa tu peso numéricamente (ejemplo: 78.5).');
      return;
    }
    ctx.scene.session.peso = peso;
    await ctx.reply('¿Cuál es tu altura en cm? (Ejemplo: 175)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const altura = parseInt((ctx.message as any)?.text);
    if (isNaN(altura)) {
      await ctx.reply('Por favor, ingresa tu altura en cm.');
      return;
    }
    ctx.scene.session.altura = altura;
    await ctx.reply('¿Cuál es tu nivel de actividad diaria?\n1. Sedentario (Poco ejercicio)\n2. Ligero (1-3 días/semana)\n3. Moderado (3-5 días/semana)\n4. Intenso (6-7 días/semana)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const opcion = (ctx.message as any)?.text;
    const factores: Record<string, number> = { '1': 1.2, '2': 1.375, '3': 1.55, '4': 1.725 };
    if (!factores[opcion]) {
      await ctx.reply('Por favor, elige una opción del 1 al 4.');
      return;
    }
    ctx.scene.session.actividad = factores[opcion];
    await ctx.reply('¡Casi terminamos! ¿Cuál es tu objetivo?\n1. Perder grasa 🔥\n2. Ganar músculo 💪\n3. Recomposición (Ambas) ✨');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const metaOpcion = (ctx.message as any)?.text;
    let meta = 'Recomposición';
    let ajusteCalorico = -300; // Default recomposición

    if (metaOpcion === '1') {
        meta = 'Perder grasa';
        ajusteCalorico = -500;
    } else if (metaOpcion === '2') {
        meta = 'Ganar músculo';
        ajusteCalorico = 200;
    }

    const userId = ctx.from?.id;
    const { edad, peso, altura, genero, actividad } = ctx.scene.session;

    if (userId && edad && peso && altura && genero && actividad) {
      // Fórmula Mifflin-St Jeor para TDEE
      const bmr = (10 * peso) + (6.25 * altura) - (5 * edad) + (genero === 'M' ? 5 : -161);
      const tdee = bmr * actividad;
      
      const calorias_meta = Math.round(tdee + ajusteCalorico);
      const proteina_meta = Math.round(peso * 2.2); // Rango alto de nuestra metodología
      const grasas_meta = Math.round(peso * 0.8);
      const carbs_meta = Math.round((calorias_meta - (proteina_meta * 4) - (grasas_meta * 9)) / 4);

      await ctx.reply(
        `✅ *¡Perfil Configurado! Tu plan de entrenamiento inteligente está listo.*\n\n` +
        `Objetivo: *${meta}*\n` +
        `Calorías diarias: *${calorias_meta} kcal*\n\n` +
        `Macros Diarios:\n` +
        `• Proteína: *${proteina_meta}g*\n` +
        `• Grasas: *${grasas_meta}g*\n` +
        `• Carbos: *${carbs_meta}g*\n\n` +
        `_La proteína es sagrada. Mantén tu NEAT alto. Dale duro a las pesas._`,
        { parse_mode: 'Markdown' }
      );

      await ctx.reply(
        '👇 Usa estos botones para interactuar conmigo. No necesitas recordar comandos.',
        MAIN_KEYBOARD
      );

      await crearUsuario(userId, {
        edad,
        peso_inicial: peso,
        altura,
        objetivo: meta,
        calorias_meta,
        proteina_meta
      });
    }

    return ctx.scene.leave();
  }
);
