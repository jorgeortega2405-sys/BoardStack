# apps/collab-server/Dockerfile
# -------------------------------------------------------------
# ETAPA 1: Compilación Binaria con Rust Musl (Estático)
# -------------------------------------------------------------
FROM rust:alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev

COPY apps/collab-server/Cargo.toml apps/collab-server/Cargo.lock ./
COPY apps/collab-server/src ./src
RUN cargo build --release

# -------------------------------------------------------------
# ETAPA 2: Contenedor Minimalista de Ejecución (Alpine Ligero)
# -------------------------------------------------------------
FROM alpine:3.20 AS runner
WORKDIR /app

# Crear usuario y grupo sin privilegios de root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/release/board-collab-server /app/collab-server

USER appuser
EXPOSE 3001
ENV PORT=3001

CMD ["/app/collab-server"]
