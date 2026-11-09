# Stage 1: Static binary compilation with Rust Musl
FROM rust:alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev

COPY apps/BoardPDF/collab-server/Cargo.toml apps/BoardPDF/collab-server/Cargo.lock ./
COPY apps/BoardPDF/collab-server/src ./src
RUN cargo build --release

# Stage 2: Minimal runner container (Alpine)
FROM alpine:3.20 AS runner
WORKDIR /app

# Create unprivileged user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/release/board-collab-server /app/collab-server

USER appuser
EXPOSE 3001
ENV PORT=3001

CMD ["/app/collab-server"]
