import { obtenerUltimaRutinaProgramada, obtenerUltimoEsfuerzo } from './userService';

export interface Exercise {
  nombre: string;
  series: string;
  reps: string;
  explicacion: string;
}

export interface Routine {
  day: string;
  name: string;
  exercises: Exercise[];
}

const ROUTINES: Routine[] = [
  {
    day: 'A',
    name: 'Pecho, Hombro y Tríceps',
    exercises: [
      { nombre: 'Press inclinado (Mancuerna)', series: '3', reps: '16', explicacion: 'Acostado, empuja mancuernas desde el pecho inclinado a 45 grados. Controla la bajada.' },
      { nombre: 'Push up (Flexiones)', series: '3', reps: '25', explicacion: 'Flexiones de brazos tradicionales en el suelo. Mantén el core firme.' },
      { nombre: 'Extensión de codo inclinado', series: '3', reps: '16', explicacion: 'Mancuerna tras la nuca o inclinado, extendiendo el brazo para aislar el tríceps.' },
      { nombre: 'Press de hombro (Mancuerna)', series: '3', reps: '16', explicacion: 'Sentado o de pie, empuja mancuernas hacia arriba sobre la cabeza.' },
      { nombre: 'Vuelos Lateral/Frontal', series: '3', reps: '25', explicacion: 'Elevaciones laterales con mancuerna para hombro medio y frontal.' },
      { nombre: 'Copa Tríceps', series: '3', reps: '12', explicacion: 'Sujeta una mancuerna con ambas manos tras la cabeza y extiende codos.' },
      { nombre: 'Plank con apoyo alterno', series: '4', reps: '1min', explicacion: 'Plancha abdominal alternando el apoyo de manos y antebrazos.' }
    ]
  },
  {
    day: 'B',
    name: 'Espalda, Hombro y Bíceps',
    exercises: [
      { nombre: 'Remo prono (Mancuerna)', series: '3', reps: '18', explicacion: 'Inclinado hacia adelante, tira de las mancuernas hacia tu cadera con palmas hacia abajo.' },
      { nombre: 'Remo Supino (Mancuerna)', series: '3', reps: '18', explicacion: 'Igual al prono pero con palmas hacia arriba para involucrar más el bíceps.' },
      { nombre: 'Abducción de hombro', series: '3', reps: '18', explicacion: 'Elevaciones laterales controladas para trabajar el deltoides.' },
      { nombre: 'Flexión de codo (Bíceps)', series: '3', reps: '18', explicacion: 'Curl de bíceps con mancuerna, manteniendo codos pegados al cuerpo.' },
      { nombre: 'Aducción escapular', series: '3', reps: '18', explicacion: 'Junta las escápulas atrás sin doblar codos, enfocándote en la espalda alta.' },
      { nombre: 'Remo erguido', series: '3', reps: '18', explicacion: 'Lleva las mancuernas hacia el mentón, subiendo codos hacia los lados.' },
      { nombre: 'Plank con extensión de brazo', series: '2', reps: '1min', explicacion: 'Plancha extendiendo un brazo hacia adelante de forma alterna.' }
    ]
  },
  {
    day: 'C',
    name: 'Refuerzo Tren Inferior (Piernas)',
    exercises: [
      { nombre: 'Sentadilla (Mancuerna)', series: '3', reps: '25', explicacion: 'Sentadilla tradicional con mancuernas a los lados o modo Goblet.' },
      { nombre: 'Peso muerto (Mancuerna)', series: '3', reps: '25', explicacion: 'Baja las mancuernas rozando las piernas, cadera atrás y espalda recta.' },
      { nombre: 'Sentadilla lateral', series: '3', reps: '16', explicacion: 'Desplazamiento lateral bajando la cadera sobre una pierna mientras la otra estira.' },
      { nombre: 'Sentadilla alterna con sumo', series: '3', reps: '20', explicacion: 'Pies anchos, puntas hacia afuera. Baja profundo alternando apoyo.' },
      { nombre: 'Sentadilla unipodal isométrica', series: '3', reps: '20', explicacion: 'Sentadilla a una pierna aguantando la posición (puedes apoyarte en pared).' },
      { nombre: 'Puente bipodal (Glúteo)', series: '3', reps: '30', explicacion: 'Tumbado boca arriba, eleva la cadera apretando glúteos. Pies en sofá para más reto.' },
      { nombre: 'Doble Crunch (Abs)', series: '3', reps: '1min', explicacion: 'Abdominales llevando rodillas al pecho y torso al mismo tiempo.' }
    ]
  },
  {
    day: 'D',
    name: 'Cardio y Core',
    exercises: [
      { nombre: 'Burpees con salto', series: '3', reps: '16', explicacion: 'Cuerpo a tierra, salto explosivo y aplauso arriba.' },
      { nombre: 'Caminata de oso', series: '3', reps: '16', explicacion: 'Camina en 4 puntos (manos y pies) sin apoyar rodillas.' },
      { nombre: 'Crunch Oblicuos cruzado', series: '3', reps: '16', explicacion: 'Codo derecho a rodilla izquierda y viceversa.' },
      { nombre: 'Elevación de piernas', series: '3', reps: '20', explicacion: 'Tumbado boca arriba, sube piernas rectas hasta 90 grados y baja lento.' },
      { nombre: 'Plank Spiderman', series: '3', reps: '1min', explicacion: 'En posición de plancha, lleva rodilla al codo por fuera lateralmente.' },
      { nombre: 'Salto frontales', series: '3', reps: '12', explicacion: 'Saltos de longitud hacia adelante con aterrizaje suave.' },
      { nombre: 'Push up (Velocidad)', series: '5', reps: '25s', explicacion: 'Máxima cantidad de flexiones posibles en 25 segundos.' },
      { nombre: 'Skipping (Velocidad)', series: '5', reps: '25s', explicacion: 'Carrera en el sitio subiendo rodillas rápido durante 25 segundos.' }
    ]
  }
];

/**
 * Determina cuál es la siguiente rutina que le toca al usuario.
 */
export async function getNextRoutine(userId: number): Promise<Routine> {
  const lastWorkout = await obtenerUltimaRutinaProgramada(userId);
  
  if (!lastWorkout || !lastWorkout.workout_type) {
    return ROUTINES[0]; // Empezar por el día A si es novato
  }

  const lastDay = lastWorkout.workout_type;
  const currentIndex = ROUTINES.findIndex(r => r.day === lastDay);
  
  if (currentIndex === -1) return ROUTINES[0];

  const nextIndex = (currentIndex + 1) % ROUTINES.length;
  return ROUTINES[nextIndex];
}

/**
 * Genera el mensaje de la rutina incluyendo los récords anteriores y sugerencias de sobrecarga.
 */
export async function generateWorkoutMessage(userId: number, routine: Routine, userData: any = null): Promise<string> {
  let message = `🔥 <b>RUTINA DEL DÍA: DÍA ${routine.day} - ${routine.name}</b> 🔥\n\n`;
  
  // Tip inteligente basado en perfil
  if (userData) {
    const objetivo = userData.objetivo?.toLowerCase();
    if (objetivo?.includes('grasa') || objetivo?.includes('perder')) {
      message += `🎯 <b>ENFOQUE HOY:</b> Descansos cortos (45-60s) para mantener pulsaciones altas. ¡Quema esa grasa!\n\n`;
    } else if (objetivo?.includes('musculo') || objetivo?.includes('ganar')) {
      message += `🎯 <b>ENFOQUE HOY:</b> Prioriza la fase excéntrica (bajada lenta). El tiempo bajo tensión traerá el crecimiento.\n\n`;
    } else {
      message += `🎯 <b>ENFOQUE HOY:</b> Técnica impecable y control. Busca esa recomposición corporal.\n\n`;
    }
  }

  message += `<i>Objetivo: Sobrecarga Progresiva. No te limites, intenta superar tu "yo" de la semana pasada.</i>\n\n`;

  for (const ex of routine.exercises) {
    const lastEffort = await obtenerUltimoEsfuerzo(userId, ex.nombre);
    
    // Parseo de rango de repeticiones (ej: "6-8" -> maxReps = 8)
    const repRangeMatch = ex.reps.match(/(\d+)-(\d+)/);
    const maxReps = repRangeMatch ? parseInt(repRangeMatch[2]) : parseInt(ex.reps);
    const minReps = repRangeMatch ? parseInt(repRangeMatch[1]) : parseInt(ex.reps);

    message += `🏋️ <b>${ex.nombre}</b>\n`;
    message += `├ Sets: ${ex.series} | Reps: ${ex.reps}\n`;
    
    if (lastEffort) {
      const lastWeight = Number(lastEffort.weight_kg);
      const lastReps = Number(lastEffort.reps);
      
      message += `├ ⭐️ ÚLTIMA VEZ: ${lastWeight}kg x ${lastReps} reps\n`;
      
      // Lógica de Inteligencia de Sobrecarga
      if (lastReps >= maxReps) {
        // Si llegó al tope de repeticiones, sugerir subir peso
        const suggestedWeight = lastWeight + (lastWeight >= 50 ? 2.5 : 1.25);
        message += `└ 📈 <b>RETO HOY:</b> Sube a <b>${suggestedWeight}kg</b> e intenta sacar al menos ${minReps} reps.\n`;
      } else {
        // Si no llegó al tope, sugerir más repeticiones
        message += `└ 📈 <b>RETO HOY:</b> Mantén <b>${lastWeight}kg</b> pero intenta sacar <b>${lastReps + 1} a ${maxReps}</b> repeticiones impecables.\n`;
      }
    } else {
      message += `├ ⭐️ ÚLTIMA VEZ: Sin registro previo\n`;
      message += `└ 📈 <b>RETO HOY:</b> Elige un peso que domines para ${ex.reps} reps y asienta tu marca base.\n`;
    }
    
    message += `└ 💡 <i>${ex.explicacion}</i>\n\n`;
  }

  message += `✍️ <b>Para registrar:</b> Escribe algo como:\n<i>"Sentadilla 40kg 10 reps"</i> o simplemente dime cómo te fue.`;
  
  return message;
}

