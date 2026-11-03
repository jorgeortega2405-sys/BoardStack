# apps/BoardPDF/Dockerfile
# -------------------------------------------------------------
# ETAPA 1: Compilación de Código TypeScript y Bundling de Vite
# -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /workspace

RUN apk add --no-cache python3 make g++

# Copiar manifiestos y resolver workspaces
COPY package*.json ./
COPY apps/BoardPDF/package*.json ./apps/BoardPDF/
RUN npm ci --workspace=apps/BoardPDF

# Copiar código y compilar backend y cliente SPA
COPY tsconfig.json ./
COPY apps/BoardPDF ./apps/BoardPDF

WORKDIR /workspace/apps/BoardPDF
RUN npm run build

# -------------------------------------------------------------
# ETAPA 2: Entorno de Ejecución Ligero y Seguro (Runner Debian Slim)
# -------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Herramientas de sistema requeridas para manipulación de PDFs
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ghostscript qpdf poppler-utils wget \
    && rm -rf /var/lib/apt/lists/*

# Dependencias de Python para workers (compatibilidad garantizada con binary wheels glibc)
COPY apps/BoardPDF/scripts/requirements.txt /app/scripts/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /app/scripts/requirements.txt

# Copiar artefactos compilados y dependencias de ejecución
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/BoardPDF/dist ./dist
COPY --from=builder /workspace/apps/BoardPDF/public ./public
COPY --from=builder /workspace/apps/BoardPDF/scripts ./scripts
COPY --from=builder /workspace/apps/BoardPDF/package.json ./package.json

# Garantizar permisos de escritura para directorios operativos en usuario node
RUN mkdir -p /app/logs /app/uploads && chown -R node:node /app

# Ejecución bajo usuario no privilegiado estándar de Node
USER node
EXPOSE 3000

# Healthcheck interno del contenedor
HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health/liveness || exit 1

CMD ["node", "dist/index.js"]
