# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias (incluyendo devDependencies para compilar TS)
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar
COPY tsconfig.json ./
COPY src/ ./src/
COPY metodologia.md ./
RUN npx tsc

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar JS compilado y archivo de metodología
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/metodologia.md ./

# Puerto del servidor OAuth
EXPOSE 3456

# Variables de entorno (se inyectan desde EasyPanel)
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
