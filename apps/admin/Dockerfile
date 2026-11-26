FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY client ./client
COPY src ./src

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /workspace/dist ./dist
COPY --from=builder /workspace/public ./public

RUN mkdir -p /app/logs && chown -R node:node /app/logs

USER node
EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:3002/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/index.js"]
