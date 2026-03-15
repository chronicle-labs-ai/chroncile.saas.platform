.PHONY: build check test test-full clippy fmt fmt-check backend backend-dev migrate \
	docker-up doppler-check doppler-login doppler-setup doppler-sync \
	doppler-sync-backend doppler-sync-frontend doppler-sync-env-manager \
	doppler-sync-dev doppler-sync-stg doppler-sync-prd \
	dev tunnel tunnel-stop

BACKEND_DIR := backend
FRONTEND_DIR := apps/frontend
ENV_MANAGER_DIR := apps/env-manager
LOCAL_COMPOSE_FILE := deploy/docker-compose.yml
DOPPLER_PROJECT ?= chronicle-platform
DOPPLER_ENV ?= dev
DOPPLER_BACKEND_CONFIG := $(DOPPLER_ENV)_backend
DOPPLER_FRONTEND_CONFIG := $(DOPPLER_ENV)_frontend
DOPPLER_ENV_MANAGER_CONFIG := $(DOPPLER_ENV)_env_manager

backend:
	cd $(BACKEND_DIR) && cargo run --bin chronicle-backend
	
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

docker-up:
	docker compose -f $(LOCAL_COMPOSE_FILE) up --build

doppler-check:
	@command -v doppler >/dev/null 2>&1 || (echo "Doppler CLI is not installed or not on PATH." && exit 1)

doppler-login: doppler-check
	doppler login

doppler-setup: doppler-check
	@doppler me >/dev/null 2>&1 || { \
		echo "Doppler is not authenticated. Starting interactive login..."; \
		doppler login; \
	}
	doppler configure set project=$(DOPPLER_PROJECT) config=$(DOPPLER_BACKEND_CONFIG) --scope $(BACKEND_DIR)
	doppler configure set project=$(DOPPLER_PROJECT) config=$(DOPPLER_FRONTEND_CONFIG) --scope $(FRONTEND_DIR)
	doppler configure set project=$(DOPPLER_PROJECT) config=$(DOPPLER_ENV_MANAGER_CONFIG) --scope $(ENV_MANAGER_DIR)

doppler-sync: doppler-sync-backend doppler-sync-frontend doppler-sync-env-manager

doppler-sync-backend: doppler-setup
	cd $(BACKEND_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" && doppler secrets download --project $(DOPPLER_PROJECT) --config $(DOPPLER_BACKEND_CONFIG) --no-file --format env > "$$tmp_file" && mv "$$tmp_file" .env

doppler-sync-frontend: doppler-setup
	cd $(FRONTEND_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" && doppler secrets download --project $(DOPPLER_PROJECT) --config $(DOPPLER_FRONTEND_CONFIG) --no-file --format env > "$$tmp_file" && mv "$$tmp_file" .env

doppler-sync-env-manager: doppler-setup
	cd $(ENV_MANAGER_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" && doppler secrets download --project $(DOPPLER_PROJECT) --config $(DOPPLER_ENV_MANAGER_CONFIG) --no-file --format env > "$$tmp_file" && mv "$$tmp_file" .env

doppler-sync-dev:
	@$(MAKE) doppler-sync DOPPLER_ENV=dev

doppler-sync-stg:
	@$(MAKE) doppler-sync DOPPLER_ENV=stg

doppler-sync-prd:
	@$(MAKE) doppler-sync DOPPLER_ENV=prd

tunnel:
	./scripts/start-tunnel.sh 3000

tunnel-stop:
	./scripts/stop-tunnel.sh

dev: doppler-sync-dev tunnel
	@echo ""
	@echo "=== Chronicle local dev ==="
	@echo "  Backend:  http://localhost:8080"
	@echo "  Frontend: http://localhost:3000"
	@if [ -f /tmp/chronicle-tunnel.env ]; then . /tmp/chronicle-tunnel.env && echo "  Tunnel:   $$TUNNEL_URL"; fi
	@echo ""
	@echo "Start services in separate terminals:"
	@echo "  make backend"
	@echo "  yarn dev:frontend"
	@echo ""
