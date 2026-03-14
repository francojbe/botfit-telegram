import express from 'express';
import { createOAuthClient, guardarTokens } from '../services/googleFitService';

const router = express.Router();

/**
 * GET /auth/callback
 * Google redirige aquí después de que el usuario acepta los permisos.
 * Captura el código, lo intercambia por tokens y los guarda en Supabase.
 */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Parámetros inválidos');
  }

  const telegramId = parseInt(String(state), 10);
  if (isNaN(telegramId)) {
    return res.status(400).send('ID de Telegram inválido');
  }

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(String(code));

    await guardarTokens(telegramId, tokens);

    // Página de éxito que el usuario ve en su navegador
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conectado con Google Fit ✅</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
            color: white;
            text-align: center;
            padding: 20px;
          }
          .card {
            background: rgba(255,255,255,0.07);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 24px;
            padding: 48px 40px;
            max-width: 400px;
          }
          .icon { font-size: 72px; margin-bottom: 24px; }
          h1 { font-size: 26px; margin-bottom: 12px; font-weight: 700; }
          p  { font-size: 16px; opacity: 0.8; line-height: 1.5; }
          .badge {
            display: inline-block;
            background: rgba(52,199,89,0.2);
            border: 1px solid rgba(52,199,89,0.5);
            color: #34c759;
            border-radius: 100px;
            padding: 6px 16px;
            font-size: 13px;
            font-weight: 600;
            margin-top: 24px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>¡Listo!</h1>
          <p>Tu cuenta de Google Fit fue conectada exitosamente al bot de fitness.</p>
          <p style="margin-top: 12px;">Puedes cerrar esta ventana y volver a Telegram.</p>
          <span class="badge">🏃 Google Fit conectado</span>
        </div>
      </body>
      </html>
    `);

    console.log(`[Auth] Google Fit conectado para usuario ${telegramId}`);
  } catch (error) {
    console.error('[Auth] Error en callback OAuth:', error);
    res.status(500).send('Error al conectar con Google Fit. Intenta de nuevo desde el bot.');
  }
});

export default router;
