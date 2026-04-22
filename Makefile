.PHONY: build check test test-full clippy fmt fmt-check backend backend-dev migrate \
	docker-up doppler-check doppler-login doppler-setup doppler-sync \
	doppler-sync-backend doppler-sync-frontend doppler-sync-env-manager \
	doppler-sync-dev doppler-sync-stg doppler-sync-prd \
	dev dev-all tunnel tunnel-stop

BACKEND_DIR := backend
FRONTEND_DIR := apps/frontend
ENV_MANAGER_DIR := apps/env-manager
LOCAL_COMPOSE_FILE := deploy/docker-compose.yml
DOPPLER_PROJECT ?= chronicle-platform
DOPPLER_ENV ?= dev
DOPPLER_BACKEND_CONFIG := $(DOPPLER_ENV)_backend
DOPPLER_FRONTEND_CONFIG := $(DOPPLER_ENV)_frontend
DOPPLER_ENV_MANAGER_CONFIG := $(DOPPLER_ENV)_env_manager

DEV_USER ?= $(shell whoami)
NGROK_DOMAIN ?= $(DEV_USER).chronicle-api.com
DOPPLER_DEV_BACKEND_CONFIG := dev_backend_$(DEV_USER)
DOPPLER_DEV_FRONTEND_CONFIG := dev_frontend_$(DEV_USER)

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

dev-all:
	@if [ ! -d node_modules ]; then \
		echo "node_modules not found, running yarn install..."; \
		yarn install; \
	fi
	@echo "=== Chronicle Dev [$(DEV_USER)] ==="
	@echo ""
	@echo "Syncing Doppler configs for $(DEV_USER)..."
	@cd $(BACKEND_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" \
		&& doppler secrets download --project $(DOPPLER_PROJECT) --config $(DOPPLER_DEV_BACKEND_CONFIG) --no-file --format env > "$$tmp_file" \
		&& mv "$$tmp_file" .env \
		&& echo "  Backend:     $(DOPPLER_DEV_BACKEND_CONFIG) -> backend/.env"
	@cd $(FRONTEND_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" \
		&& doppler secrets download --project $(DOPPLER_PROJECT) --config $(DOPPLER_DEV_FRONTEND_CONFIG) --no-file --format env > "$$tmp_file" \
		&& mv "$$tmp_file" .env \
		&& echo "  Frontend:    $(DOPPLER_DEV_FRONTEND_CONFIG) -> apps/frontend/.env"
	@cd $(ENV_MANAGER_DIR) && tmp_file="$$(mktemp ./.env.XXXXXX)" \
		&& doppler secrets download --project $(DOPPLER_PROJECT) --config $(DOPPLER_ENV_MANAGER_CONFIG) --no-file --format env > "$$tmp_file" \
		&& mv "$$tmp_file" .env \
		&& echo "  Env Manager: $(DOPPLER_ENV_MANAGER_CONFIG) -> apps/env-manager/.env"
	@echo ""
	@echo "Starting Fly DB proxy (chronicle-env-manager-db -> localhost:15432)..."
	@pkill -f "flyctl proxy 15432" 2>/dev/null || true
	@flyctl proxy 15432:5432 -a chronicle-env-manager-db > /dev/null 2>&1 &
	@sleep 2
	@if lsof -ti:15432 > /dev/null 2>&1; then \
		echo "  Fly DB proxy: localhost:15432 -> chronicle-env-manager-db.internal:5432"; \
		sed -i '' 's|chronicle-env-manager-db.flycast:5432|127.0.0.1:15432|g' $(ENV_MANAGER_DIR)/.env; \
	else \
		echo "  Fly DB proxy failed. Falling back to local Postgres."; \
		sed -i '' 's|postgres://postgres:[^@]*@chronicle-env-manager-db[^"]*|postgresql://chronicle:chronicle_dev@localhost:5432/env_manager|g' $(ENV_MANAGER_DIR)/.env; \
	fi
	@echo ""
	@echo "Starting tunnel $(NGROK_DOMAIN) -> localhost:8080 (backend)..."
	@./scripts/start-tunnel.sh 8080 --domain=$(NGROK_DOMAIN) || echo "  Tunnel failed (ngrok may not be configured). Continuing without tunnel."
	@echo ""
	@echo "=== Services ==="
	@echo "  Backend:     http://localhost:8080"
	@echo "  Frontend:    http://localhost:3000"
	@echo "  Env Manager: http://localhost:3100"
	@echo "  Tunnel:      https://$(NGROK_DOMAIN)"
	@echo "  Fly DB:      localhost:15432"
	@echo ""
	@trap 'kill 0' EXIT; \
	cd $(BACKEND_DIR) && cargo run --bin chronicle-backend & \
	yarn dev:frontend & \
	yarn dev:env-manager & \
	wait
