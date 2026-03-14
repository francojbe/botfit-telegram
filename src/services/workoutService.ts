import { obtenerUltimoEntrenamiento, obtenerUltimoEsfuerzo } from './userService';

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
    name: 'Pesado (Fuerza)',
    exercises: [
      { 
        nombre: 'Goblet Squat', 
        series: '4', 
        reps: '6-8',
        explicacion: 'Sujeta una mancuerna frente al pecho con ambas manos. Baja la cadera manteniendo la espalda recta y sube explosivo.'
      },
      { 
        nombre: 'Press Banca Mancuernas', 
        series: '4', 
        reps: '6-8',
        explicacion: 'Acostado en el banco, empuja las mancuernas hacia el techo. Controla la bajada hasta que toquen casi el pecho.'
      },
      { 
        nombre: 'Remo Mancuerna', 
        series: '4', 
        reps: '8-10',
        explicacion: 'Apoya una mano en el banco, espalda paralela al suelo. Tira de la mancuerna hacia tu cadera, apretando la espalda.'
      },
      { 
        nombre: 'Press Militar/Arnold', 
        series: '3', 
        reps: '8-10',
        explicacion: 'Sentado o de pie, empuja las mancuernas sobre la cabeza. Si es Arnold, rota las palmas al subir.'
      },
      { 
        nombre: 'Farmer\'s Walk', 
        series: '3', 
        reps: '30m',
        explicacion: 'Camina con las mancuernas más pesadas que puedas en cada mano. Mantén el core firme y espalda recta.'
      }
    ]
  },
  {
    day: 'B',
    name: 'Moderado',
    exercises: [
      { 
        nombre: 'Peso Muerto Rumano', 
        series: '4', 
        reps: '8-10',
        explicacion: 'Baja las mancuernas pegadas a tus piernas, llevando la cadera hacia atrás hasta sentir estiramiento en isquios.'
      },
      { 
        nombre: 'Zancadas Mancuernas', 
        series: '3', 
        reps: '10-12',
        explicacion: 'Da un paso largo y baja la rodilla trasera casi hasta tocar el suelo. Alterna piernas manteniendo el torso vertical.'
      },
      { 
        nombre: 'Press Inclinado Mancuernas', 
        series: '3', 
        reps: '8-10',
        explicacion: 'Banco a 30-45 grados. Enfócate en la parte superior del pecho. Baja lento, sube fuerte.'
      },
      { 
        nombre: 'Dominadas/Jalones', 
        series: '3', 
        reps: '8-10',
        explicacion: 'Tira de tu cuerpo hacia arriba si tienes barra, o de la mancuerna hacia abajo en un banco inclinado (Sustituto).'
      },
      { 
        nombre: 'Plancha', 
        series: '3', 
        reps: '30-45s',
        explicacion: 'Mantén el cuerpo recto como una tabla apoyado en antebrazos. Aprieta glúteos y abdomen.'
      }
    ]
  },
  {
    day: 'C',
    name: 'Metabólico (Hipertrofia)',
    exercises: [
      { 
        nombre: 'Sentadilla Goblet/Split Búlgaro', 
        series: '3', 
        reps: '10-12',
        explicacion: 'Si es búlgaro, apoya un pie en el banco detrás de ti. Quema garantizado.'
      },
      { 
        nombre: 'Press Banca Mancuernas', 
        series: '3', 
        reps: '10-12',
        explicacion: 'Mismo que Día A, pero con menos peso y más enfoque en sentir el músculo trabajar.'
      },
      { 
        nombre: 'Remo Renegado', 
        series: '3', 
        reps: '10-12',
        explicacion: 'Posición de flexión apoyado en mancuernas. Haz un remo con un brazo sin que la cadera rote, luego el otro.'
      },
      { 
        nombre: 'Elevaciones Laterales + Curl (Superserie)', 
        series: '3', 
        reps: '12-15',
        explicacion: 'Primero eleva mancuernas a los lados para hombros, luego inmediatamente haz curls para bíceps.'
      },
      { 
        nombre: 'Abdominales con Mancuerna', 
        series: '3', 
        reps: '12-15',
        explicacion: 'Sit-ups sosteniendo una mancuerna ligera. Rota el torso al final para trabajar oblicuos.'
      }
    ]
  }
];

/**
 * Determina cuál es la siguiente rutina que le toca al usuario.
 */
export async function getNextRoutine(userId: number): Promise<Routine> {
  const lastWorkout = await obtenerUltimoEntrenamiento(userId);
  
  if (!lastWorkout || !lastWorkout.workout_type) {
    return ROUTINES[0]; // Empezar por el día A
  }

  const lastDay = lastWorkout.workout_type;
  const currentIndex = ROUTINES.findIndex(r => r.day === lastDay);
  
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

