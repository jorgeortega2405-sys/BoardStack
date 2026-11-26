FROM rust:bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/room-server /app/room-server

ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=5s \
  CMD curl -f http://127.0.0.1:3001/health || exit 1

CMD ["/app/room-server"]
