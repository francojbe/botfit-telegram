import { supabase } from '../db/supabaseClient';

export interface UserInput {
  edad: number;
  altura: number;
  peso_inicial: number;
  objetivo: string;
  calorias_meta: number;
  proteina_meta: number;
}

export interface MetricInput {
  peso_actual: number;
  notas?: string;
  fecha?: string;
}

export interface MealInput {
  descripcion_original: string;
  imagen_url?: string | null;
  est_calorias: number;
  est_proteina: number;
  est_carbs: number;
  est_grasas: number;
  fecha?: string;
}

export interface WorkoutInput {
  rutina_texto: string;
  completado?: boolean;
  fecha?: string;
}

/**
 * Crea o actualiza un usuario en la base de datos (upsert basado en telegram_id).
 */
export async function crearUsuario(userId: number, datos: UserInput): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .upsert({
        telegram_id: userId,
        edad: datos.edad,
        altura: datos.altura,
        peso_inicial: datos.peso_inicial,
        objetivo: datos.objetivo,
        calorias_meta: datos.calorias_meta,
        proteina_meta: datos.proteina_meta
      });

    if (error) {
      console.error('[UserService] Error al crear/actualizar usuario:', error);
      return false;
    }

    console.log(`[UserService] Usuario ${userId} creado o actualizado correctamente.`);
    return true;
  } catch (err) {
    console.error('[UserService] Exception en crearUsuario:', err);
    return false;
  }
}

/**
 * Actualiza parcialmente los datos de un usuario.
 */
export async function actualizarPerfil(userId: number, datos: Partial<UserInput>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update(datos)
      .eq('telegram_id', userId);

    if (error) {
      console.error('[UserService] Error al actualizar perfil:', error);
      return false;
    }

    console.log(`[UserService] Perfil de ${userId} actualizado parcialmente.`);
    return true;
  } catch (err) {
    console.error('[UserService] Exception en actualizarPerfil:', err);
    return false;
  }
}

/**
 * Registra una métrica diaria para el usuario.
 */
export async function registrarPeso(userId: number, peso: number, notas: string = '', fechaCustom?: string): Promise<boolean> {
  try {
    const fecha = fechaCustom || new Date().toLocaleDateString('en-CA');
    const { error } = await supabase
      .from('daily_metrics')
      .insert({
        user_id: userId,
        peso_actual: peso,
        notas: notas,
        fecha: fecha
      });

    if (error) {
           console.error('[UserService] Error al registrar peso:', error);
           return false;
    }
    console.log(`[UserService] Peso ${peso}kg registrado para el usuario ${userId}`);
    return true;
  } catch(err) {
      console.error('[UserService] Exception en registrarPeso:', err);
      return false;
  }
}

/**
 * Asienta un registro de comida (macros, foto) para el usuario.
 */
export async function asentarComida(userId: number, descripcion: string, imagenUrl: string | null, macros: any, fechaCustom?: string): Promise<boolean> {
  try {
      // Intentamos extraer macros si vienen en el objeto o defaults
      const cal = macros?.calorias || 0;
      const prot = macros?.proteina || 0;
      const carb = macros?.carbs || 0;
      const grasas = macros?.grasas || 0;
      const fecha = fechaCustom || new Date().toLocaleDateString('en-CA');

      const { error } = await supabase
        .from('meals_log')
        .insert({
          user_id: userId,
          descripcion_original: descripcion,
          imagen_url: imagenUrl,
          est_calorias: cal,
          est_proteina: prot,
          est_carbs: carb,
          est_grasas: grasas,
          fecha: fecha
        });

      if (error) {
           console.error('[UserService] Error al registrar comida:', error);
           return false;
      }
      console.log(`[UserService] Comida de ${userId} registrada exitosamente.`);
      return true;
  } catch(err) {
      console.error('[UserService] Exception en asentarComida:', err);
      return false;
  }
}

/**
 * Asienta un entrenamiento para el usuario.
 */
export async function registrarEntrenamiento(userId: number, rutina: string, workoutType?: string, completado: boolean = true, fechaCustom?: string): Promise<string | null> {
   try {
       const fecha = fechaCustom || new Date().toLocaleDateString('en-CA');
       const { data, error } = await supabase
        .from('workout_log')
        .insert({
          user_id: userId,
          rutina_texto: rutina,
          workout_type: workoutType,
          completado: completado,
          fecha: fecha
        })
        .select();
        
       if(error) {
           console.error('[UserService] Error al registrar entrenamiento:', error);
           return null;
       }
       console.log(`[UserService] Entrenamiento registrado para ${userId}`);
       return data?.[0]?.id || null;
   } catch (err) {
       console.error('[UserService] Exception en registrarEntrenamiento:', err);
       return null;
   }
}

/**
 * Obtiene el último entrenamiento registrado para un usuario.
 */
export async function obtenerUltimoEntrenamiento(userId: number): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('workout_log')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}


/**
 * Obtiene los datos de un usuario por su Telegram ID.
 */
export async function obtenerUsuario(userId: number): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId)
      .single();

    if (error) {
       if (error.code !== 'PGRST116') { // No se encontró registro
          console.error('[UserService] Error al obtener usuario:', error);
       }
       return null;
    }
    return data;
  } catch (err) {
    console.error('[UserService] Exception en obtenerUsuario:', err);
    return null;
  }
}

/**
 * Registra un ejercicio individual de una rutina.
 */
export async function registrarEjercicio(userId: number, workoutId: string, ejercicio: any, fechaCustom?: string): Promise<boolean> {
  try {
    const fecha = fechaCustom || new Date().toLocaleDateString('en-CA');
    const { error } = await supabase
      .from('exercise_logs')
      .insert({
        user_id: userId,
        workout_id: workoutId,
        exercise_name: ejercicio.nombre,
        sets: parseInt(ejercicio.series || ejercicio.sets || 0),
        reps: parseInt(ejercicio.reps || 0),
        weight_kg: parseFloat(ejercicio.peso || ejercicio.weight || 0),
        fecha: fecha
      });

    if (error) {
       console.error('[UserService] Error al registrar ejercicio:', error);
       return false;
    }
    return true;
  } catch (err) {
    console.error('[UserService] Exception en registrarEjercicio:', err);
    return false;
  }
}

/**
 * Obtiene el último esfuerzo registrado para un ejercicio específico de un usuario.
 */
export async function obtenerUltimoEsfuerzo(userId: number, exerciseName: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_name', exerciseName)
      .order('fecha', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Obtiene los últimos X ejercicios registrados por el usuario para darle contexto a la IA.
 */
export async function obtenerUltimosEjercicios(userId: number, limit: number = 5): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

/**
 * Registra un mensaje en el log de conversaciones (para auditoría y mejora del agente).
 */
export async function guardarMensaje(userId: number, role: 'user' | 'assistant', content: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_logs')
      .insert({
        user_id: userId,
        role: role,
        content: content
      });

    if (error) {
      console.error('[UserService] Error al guardar mensaje en chat_logs:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[UserService] Exception en guardarMensaje:', err);
    return false;
  }
}

/**
 * [MEMORIA CONVERSACIONAL] Obtiene los últimos N mensajes del historial de chat de un usuario.
 * Se usa para inyectar contexto conversacional en el System Prompt de la IA.
 */
export async function obtenerHistorialChat(userId: number, limit: number = 12): Promise<Array<{ role: 'user' | 'assistant', content: string }>> {
  try {
    const { data, error } = await supabase
      .from('chat_logs')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    // Revertir para que estén en orden cronológico (más antiguo primero)
    return data.reverse() as Array<{ role: 'user' | 'assistant', content: string }>;
  } catch (err) {
    console.error('[UserService] Exception en obtenerHistorialChat:', err);
    return [];
  }
}

/**
 * [CONTEXTO NUTRICIONAL] Obtiene un resumen de la ingesta calórica de hoy para el usuario.
 * Se usa para que la IA sepa cuánto ha comido el usuario en el día actual.
 */
export async function obtenerResumenNutricionalHoy(userId: number): Promise<{ calorias: number, proteina: number, carbs: number, grasas: number, registros: number } | null> {
  try {
    const hoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

    const { data, error } = await supabase
      .from('meals_log')
      .select('est_calorias, est_proteina, est_carbs, est_grasas')
      .eq('user_id', userId)
      .eq('fecha', hoy);

    if (error || !data || data.length === 0) return null;

    const resumen = data.reduce((acc, meal) => ({
      calorias: acc.calorias + (meal.est_calorias || 0),
      proteina: acc.proteina + (meal.est_proteina || 0),
      carbs:    acc.carbs    + (meal.est_carbs    || 0),
      grasas:   acc.grasas   + (meal.est_grasas   || 0),
      registros: acc.registros + 1
    }), { calorias: 0, proteina: 0, carbs: 0, grasas: 0, registros: 0 });

    return resumen;
  } catch (err) {
    console.error('[UserService] Exception en obtenerResumenNutricionalHoy:', err);
    return null;
  }
}

/**
 * [CRON] Obtiene todos los usuarios activos de la base de datos con su telegram_id.
 */
export async function obtenerTodosLosUsuarios(): Promise<Array<{ telegram_id: number, objetivo: string, calorias_meta: number, proteina_meta: number }>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('telegram_id, objetivo, calorias_meta, proteina_meta');

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.error('[UserService] Exception en obtenerTodosLosUsuarios:', err);
    return [];
  }
}

/**
 * [CRON] Calcula el promedio de peso de los últimos N días para un usuario.
 */
export async function obtenerPromedioSemanal(userId: number, diasAtras: number = 7): Promise<number | null> {
  try {
    const desde = new Date();
    desde.setDate(desde.getDate() - diasAtras);

    const { data, error } = await supabase
      .from('daily_metrics')
      .select('peso_actual')
      .eq('user_id', userId)
      .gte('created_at', desde.toISOString());

    if (error || !data || data.length === 0) return null;

    const total = data.reduce((sum, m) => sum + (m.peso_actual || 0), 0);
    return Math.round((total / data.length) * 100) / 100;
  } catch (err) {
    console.error('[UserService] Exception en obtenerPromedioSemanal:', err);
    return null;
  }
}

/**
 * [STATS] Obtiene el entrenamiento más reciente del día de hoy.
 */
export async function obtenerEntrenamientoHoy(userId: number): Promise<any | null> {
  try {
    const hoy = new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase
      .from('workout_log')
      .select('*, exercise_logs(*)')
      .eq('user_id', userId)
      .eq('fecha', hoy)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * [STATS] Obtiene el entrenamiento de una fecha específica.
 */
export async function obtenerEntrenamientoPorFecha(userId: number, fecha: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('workout_log')
      .select('*, exercise_logs(*)')
      .eq('user_id', userId)
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * [HISTORIAL] Obtiene las últimas comidas de los últimos N días.
 */
export async function obtenerHistorialComidas(userId: number, dias: number = 7): Promise<any[]> {
  try {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const { data, error } = await supabase
      .from('meals_log')
      .select('descripcion_original, est_calorias, est_proteina, created_at')
      .eq('user_id', userId)
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return data;
  } catch (err) {
    return [];
  }
}

/**
 * [HISTORIAL] Obtiene los registros de peso de los últimos N días.
 */
export async function obtenerHistorialPesos(userId: number, dias: number = 7): Promise<any[]> {
  try {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const { data, error } = await supabase
      .from('daily_metrics')
      .select('peso_actual, notas, created_at')
      .eq('user_id', userId)
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return data;
  } catch (err) {
    return [];
  }
}

/**
 * [HISTORIAL] Obtiene los entrenamientos de los últimos N días.
 */
export async function obtenerHistorialEntrenos(userId: number, dias: number = 7): Promise<any[]> {
  try {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const { data, error } = await supabase
      .from('workout_log')
      .select('rutina_texto, workout_type, completado, created_at, exercise_logs(exercise_name, weight_kg, reps)')
      .eq('user_id', userId)
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    if (error || !data) return [];
    return data;
  } catch (err) {
    return [];
  }
}
