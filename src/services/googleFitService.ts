import { google } from 'googleapis';
import { supabase } from '../db/supabaseClient';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI  = 'http://localhost:3456/auth/callback';

export const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
];

// ─── OAUTH CLIENT ─────────────────────────────────────────────────────────────

export function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(telegramId: number): string {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: String(telegramId),
    prompt: 'consent', // Fuerza a que siempre pida permiso y genere refresh_token
  });
}

// ─── TOKENS ───────────────────────────────────────────────────────────────────

export async function guardarTokens(telegramId: number, tokens: any): Promise<void> {
  const { error } = await supabase
    .from('google_tokens')
    .upsert({
      user_id: telegramId,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) console.error('[GoogleFit] Error guardando tokens:', error);
}

export async function obtenerTokens(telegramId: number): Promise<any | null> {
  const { data, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', telegramId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function tieneConexionGoogleFit(telegramId: number): Promise<boolean> {
  const tokens = await obtenerTokens(telegramId);
  return !!tokens?.refresh_token;
}

// ─── FETCH GOOGLE FIT DATA ────────────────────────────────────────────────────

async function getAuthenticatedClient(telegramId: number) {
  const tokenRow = await obtenerTokens(telegramId);
  if (!tokenRow) throw new Error('Usuario sin tokens de Google Fit');

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token:  tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date:   tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : undefined,
  });

  // Auto-refresh si el token expiró
  oauth2Client.on('tokens', async (newTokens) => {
    await guardarTokens(telegramId, {
      ...newTokens,
      refresh_token: newTokens.refresh_token || tokenRow.refresh_token,
    });
  });

  return oauth2Client;
}

export interface DatosFitDiarios {
  pasos:           number;
  caloriasQuemadas: number;
  distanciaKm:     number;
  minActivos:      number;
  pesoKg:          number | null;
}

/**
 * Obtiene los datos de Google Fit del día de hoy.
 */
export async function obtenerDatosDiarios(telegramId: number): Promise<DatosFitDiarios> {
  const auth = await getAuthenticatedClient(telegramId);
  const fitness = google.fitness({ version: 'v1', auth });

  // Rango de tiempo: hoy desde medianoche hasta ahora
  const ahora = Date.now();
  const medianoche = new Date();
  medianoche.setHours(0, 0, 0, 0);
  const inicioMs = medianoche.getTime();

  const body = {
    aggregateBy: [
      { dataTypeName: 'com.google.step_count.delta' },
      { dataTypeName: 'com.google.calories.expended' },
      { dataTypeName: 'com.google.distance.delta' },
      { dataTypeName: 'com.google.active_minutes' },
      { dataTypeName: 'com.google.weight' },
    ],
    bucketByTime: { durationMillis: String(ahora - inicioMs + 1) },
    startTimeMillis: String(inicioMs),
    endTimeMillis:   String(ahora),
  };

  const res = await fitness.users.dataset.aggregate({
    userId: 'me',
    requestBody: body,
  });

  const buckets = res.data.bucket || [];
  let pasos = 0, cals = 0, distM = 0, minActivos = 0, peso: number | null = null;

  for (const bucket of buckets) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        const val = point.value?.[0];
        if (!val) continue;
        const nombre = dataset.dataSourceId || '';

        if (nombre.includes('step_count'))     pasos           += val.intVal || 0;
        if (nombre.includes('calories'))       cals            += val.fpVal  || 0;
        if (nombre.includes('distance'))       distM           += val.fpVal  || 0;
        if (nombre.includes('active_minutes')) minActivos      += val.intVal || 0;
        if (nombre.includes('weight') && val.fpVal) peso = val.fpVal;
      }
    }
  }

  return {
    pasos,
    caloriasQuemadas: Math.round(cals),
    distanciaKm:      Math.round(distM / 100) / 10,
    minActivos,
    pesoKg:           peso ? Math.round(peso * 10) / 10 : null,
  };
}

/**
 * Formatea los datos de Google Fit en un mensaje legible para el bot.
 */
export function formatearDatosFit(datos: DatosFitDiarios, metaPasos: number = 8000): string {
  const progresoPasos = Math.round((datos.pasos / metaPasos) * 100);
  const barraLlena = Math.round(progresoPasos / 10);
  const barra = '▓'.repeat(Math.min(barraLlena, 10)) + '░'.repeat(Math.max(10 - barraLlena, 0));

  let msg = `📱 *Google Fit — Hoy*\n\n`;
  msg += `👟 Pasos: *${datos.pasos.toLocaleString('es-CL')}* / ${metaPasos.toLocaleString('es-CL')}\n`;
  msg += `[${barra}] ${progresoPasos}%\n\n`;
  msg += `🔥 Calorías quemadas: *${datos.caloriasQuemadas} kcal*\n`;
  msg += `📍 Distancia: *${datos.distanciaKm} km*\n`;
  msg += `⚡ Minutos activos: *${datos.minActivos} min*\n`;
  if (datos.pesoKg) msg += `⚖️ Peso registrado: *${datos.pesoKg} kg*\n`;

  if (datos.pasos >= metaPasos) {
    msg += `\n✅ ¡Meta de pasos alcanzada! Excelente NEAT hoy 💪`;
  } else {
    const restantes = metaPasos - datos.pasos;
    msg += `\n💡 Te faltan *${restantes.toLocaleString('es-CL')} pasos* para llegar a tu meta`;
  }

  return msg;
}
