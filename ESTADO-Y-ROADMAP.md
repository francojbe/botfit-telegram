# 🤖 Telegram Fitness Coach — Estado y Roadmap

> **Last updated:** 2026-03-17 | Stack: Node.js + TypeScript · Telegraf · Supabase · Proxy LLM

---

## ✅ IMPLEMENTADO Y FUNCIONANDO

### Infraestructura
- [x] Bot corriendo con Telegraf, sessiones y Scenes middleware
- [x] Onboarding wizard secuencial (`/start`) — edad, género, peso, altura, actividad, meta
- [x] TDEE con fórmula Mifflin-St Jeor + macros automáticos (proteína 2.2g/kg, grasas 0.8g/kg)
- [x] Persistencia completa en Supabase
- [x] **Corrección de Esquema y Fechas Locales**: Columna `workout_type` añadida y normalización de fechas a `YYYY-MM-DD` local para evitar desajustes de zona horaria.

### Cerebro IA — aiService.ts
- [x] **Memoria conversacional real**: inyecta los últimos 12 mensajes del historial como contexto OpenAI
- [x] **Contexto nutricional diario**: la IA sabe cuántas calorías y proteína comió el usuario HOY
- [x] Perfil del usuario inyectado en el system prompt (objetivo, metas)
- [x] Últimos 5 ejercicios inyectados (sobrecarga progresiva en conversación libre)
- [x] Análisis multimodal de fotos de comida
- [x] Función `generarReporteSemanal()` para los cron jobs (solicitud separada, no contamina chat_logs)

### Agente Autónomo — index.ts
- [x] **Parser robusto de acciones**: tolera JSON multilinea, insensible a mayúsculas ("ACCION:") y balanceo de llaves.
- [x] **Confirmaciones visuales** de cada acción: `✅ Peso registrado: 80.5kg`
- [x] `LOG_MEAL` · `LOG_EXERCISE` · `LOG_WEIGHT` · `UPDATE_PROFILE`

### Comandos del Bot
- [x] `/start` — Onboarding o re-onboarding
- [x] `/rutina` — Entrenamiento del día A/B/C con sobrecarga progresiva
- [x] `/stats` — Resumen del día: nutrición + entrenamiento + peso
- [x] `/perfil` — Ver perfil actual con instrucciones para editarlo
- [x] `/help` — Lista completa de comandos

### Cron Jobs — cron.ts
- [x] **Check-in semanal real** (domingos 10:00): lee todos los usuarios en BD, calcula promedio de peso semanal, genera reporte personalizado con IA, envía por Telegram
- [x] **Recordatorio NEAT** (L-V 13:00): mensajes rotatorios sobre pasos, agua, proteína

---

## 🔮 PRÓXIMAS MEJORAS (Backlog)

### Media prioridad
- [ ] **Comando `/progreso`**: subir fotos frente/perfil/espalda → guardar en Supabase Storage → feedback visual de la IA
- [ ] **Comando `/historial`**: mostrar últimas comidas y pesos de los últimos 7 días en formato legible

### Baja prioridad
- [ ] **Dashboard Web (Next.js)**: gráficas de peso, calorías vs. meta, galería de progreso, fecha estimada de llegada a meta

---

## 📁 Mapa de Archivos

```
telegram-fitness-coach/
├── metodologia.md              ← System Prompt base (leído en runtime por aiService)
├── ESTADO-Y-ROADMAP.md         ← Este archivo
├── .env                        ← Credenciales (no commitear)
└── src/
    ├── index.ts                ← Orquestador: comandos, handlers, agente autónomo
    ├── bot/
    │   ├── cron.ts             ← ✅ Check-in semanal + recordatorio NEAT
    │   └── scenes/
    │       └── onboarding.ts   ← ✅ Wizard TDEE completo
    └── services/
        ├── aiService.ts        ← ✅ IA con memoria + contexto nutricional
        ├── userService.ts      ← ✅ CRUD + historial + nutrición diaria + cron helpers
        └── workoutService.ts   ← ✅ Rutinas A/B/C + sobrecarga progresiva
```
