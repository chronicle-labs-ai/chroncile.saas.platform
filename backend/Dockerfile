FROM rust:bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --features postgres

COPY . .
RUN cargo build --release --bin chronicle-backend --features postgres

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/chronicle-backend /usr/local/bin/chronicle-backend
COPY --from=builder /app/migrations /app/migrations

WORKDIR /app

ARG GIT_SHA=""
ARG GIT_TAG=""
ARG ENVIRONMENT="production"

ENV API_HOST=0.0.0.0
ENV API_PORT=8080
ENV RUST_LOG=info,tower_http=debug
ENV BACKEND_MODE=real
ENV GIT_SHA=${GIT_SHA}
ENV GIT_TAG=${GIT_TAG}
ENV ENVIRONMENT=${ENVIRONMENT}

EXPOSE 8080
CMD ["chronicle-backend"]
