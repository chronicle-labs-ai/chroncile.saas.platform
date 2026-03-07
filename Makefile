.PHONY: build check test test-full clippy fmt fmt-check backend-dev migrate \
	doppler-check doppler-login doppler-setup doppler-sync doppler-sync-backend \
	doppler-sync-frontend doppler-sync-env-manager

BACKEND_DIR := backend
FRONTEND_DIR := apps/frontend
ENV_MANAGER_DIR := apps/env-manager

build:
	cd $(BACKEND_DIR) && cargo build

check:
	cd $(BACKEND_DIR) && cargo check

test:
	cd $(BACKEND_DIR) && cargo test --workspace

test-full:
	cd $(BACKEND_DIR) && cargo test --workspace --features postgres-tests

clippy:
	cd $(BACKEND_DIR) && cargo clippy --workspace -- -D warnings

fmt:
	cd $(BACKEND_DIR) && cargo fmt --all

fmt-check:
	cd $(BACKEND_DIR) && cargo fmt --all -- --check

backend-dev:
	cd $(BACKEND_DIR) && cargo run --bin chronicle-backend

migrate:
	cd $(BACKEND_DIR) && sqlx migrate run

doppler-check:
	@command -v doppler >/dev/null 2>&1 || (echo "Doppler CLI is not installed or not on PATH." && exit 1)

doppler-login: doppler-check
	doppler login

doppler-setup: doppler-check
	@doppler me >/dev/null 2>&1 || { \
		echo "Doppler is not authenticated. Starting interactive login..."; \
		doppler login; \
	}
	@doppler setup --no-interactive >/dev/null 2>&1 || { \
		echo "Non-interactive Doppler setup failed. Starting interactive setup..."; \
		doppler setup; \
	}

doppler-sync: doppler-sync-backend doppler-sync-frontend doppler-sync-env-manager

doppler-sync-backend: doppler-setup
	cd $(BACKEND_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" && doppler secrets download --no-file --format env > "$$tmp_file" && mv "$$tmp_file" .env

doppler-sync-frontend: doppler-setup
	cd $(FRONTEND_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" && doppler secrets download --no-file --format env > "$$tmp_file" && mv "$$tmp_file" .env

doppler-sync-env-manager: doppler-setup
	cd $(ENV_MANAGER_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" && doppler secrets download --no-file --format env > "$$tmp_file" && mv "$$tmp_file" .env
