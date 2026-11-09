# Stage 1: Base native dependencies and tools
FROM node:20-bookworm-slim AS base
WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ghostscript qpdf poppler-utils wget \
    libreoffice-nogui \
    fonts-dejavu \
    fonts-liberation \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY apps/BoardPDF/scripts/requirements.txt /workspace/apps/BoardPDF/scripts/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /workspace/apps/BoardPDF/scripts/requirements.txt

COPY package*.json ./
COPY apps/BoardPDF/package*.json ./apps/BoardPDF/
RUN npm install --workspace=apps/BoardPDF

# Stage 2: Development environment with live reload (runner-dev)
FROM base AS runner-dev
WORKDIR /workspace/apps/BoardPDF

ENV NODE_ENV=development
EXPOSE 3000

COPY tsconfig.json /workspace/tsconfig.json
COPY apps/BoardPDF /workspace/apps/BoardPDF

RUN mkdir -p /workspace/apps/BoardPDF/logs /workspace/apps/BoardPDF/data /workspace/apps/BoardPDF/uploads /workspace/apps/BoardPDF/public/uploads/collaborative /workspace/apps/BoardPDF/public/uploads/avatars \
    && chown -R node:node /workspace/apps/BoardPDF/logs /workspace/apps/BoardPDF/data /workspace/apps/BoardPDF/uploads /workspace/apps/BoardPDF/public/uploads

USER node
HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health/liveness || exit 1

CMD ["npm", "run", "dev"]

# Stage 3: Production compilation (builder)
FROM base AS builder
WORKDIR /workspace

COPY tsconfig.json ./
COPY apps/BoardPDF ./apps/BoardPDF

WORKDIR /workspace/apps/BoardPDF
RUN npm run build

# Stage 4: Production execution environment (runner)
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ghostscript qpdf poppler-utils wget \
    libreoffice-nogui \
    fonts-dejavu \
    fonts-liberation \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY apps/BoardPDF/scripts/requirements.txt /app/scripts/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /app/scripts/requirements.txt

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/BoardPDF/dist ./dist
COPY --from=builder /workspace/apps/BoardPDF/public ./public
COPY --from=builder /workspace/apps/BoardPDF/scripts ./scripts
COPY --from=builder /workspace/apps/BoardPDF/package.json ./package.json

RUN mkdir -p /app/logs /app/data /app/uploads /app/public/uploads/collaborative /app/public/uploads/avatars \
    && chown -R node:node /app/logs /app/data /app/uploads /app/public/uploads

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health/liveness || exit 1

CMD ["node", "dist/index.js"]
