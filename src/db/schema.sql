-- src/db/schema.sql

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  edad INT,
  altura DECIMAL,
  peso_inicial DECIMAL,
  objetivo VARCHAR(50), -- grasa, músculo, recomposición
  calorias_meta INT,
  proteina_meta INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Métricas Diarias
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  peso_actual DECIMAL,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Registro de Comidas
CREATE TABLE IF NOT EXISTS meals_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  imagen_url TEXT,
  descripcion_original TEXT,
  est_calorias INT,
  est_proteina INT,
  est_carbs INT,
  est_grasas INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Registro de Entrenamientos
CREATE TABLE IF NOT EXISTS workout_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  rutina_texto TEXT,
  workout_type VARCHAR(10), -- A, B, C
  completado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Detalle de Ejercicios (Para Sobrecarga Progresiva)
CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workout_log(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets INT,
  reps INT,
  weight_kg DECIMAL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para encontrar rápidamente el progreso en un ejercicio específico
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_exercise ON exercise_logs(user_id, exercise_name);
