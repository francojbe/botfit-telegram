import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Intentar cargar .env desde la raíz del proyecto
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Intentar una ruta relativa por si acaso (fallback)
  dotenv.config();
}

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  proxyApiUrl: process.env.PROXY_API_URL || process.env.OPENAI_API_URL || 'https://recuperadora-api-ia-free.nojauc.easypanel.host/v1/chat/completions',
  proxyAuthSecret: process.env.PROXY_AUTH_SECRET || process.env.OPENAI_API_KEY || 'mi_proxy_secreto',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3456/auth/callback',
};

// Validación crítica
if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('❌ ERROR: Faltan variables de entorno esenciales (SUPABASE_URL o SUPABASE_ANON_KEY).');
  if (!fs.existsSync(envPath)) {
    console.warn(`💡 Tip: No se encontró el archivo .env en ${envPath}. Si estás en producción, asegúrate de configurar las variables en tu panel de control (Easypanel/Docker).`);
  }
}
