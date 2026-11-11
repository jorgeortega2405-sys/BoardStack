# Stage 1: Static binary compilation with Rust Musl
FROM rust:alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev

COPY apps/BoardPDF/sync-engine/Cargo.toml apps/BoardPDF/sync-engine/Cargo.lock ./
COPY apps/BoardPDF/sync-engine/src ./src
RUN cargo build --release

# Stage 2: Minimal runner container (Alpine)
FROM alpine:3.20 AS runner
WORKDIR /app

# Create unprivileged user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/release/board-sync-engine /app/sync-engine

USER appuser
EXPOSE 3001
ENV PORT=3001

CMD ["/app/sync-engine"]
