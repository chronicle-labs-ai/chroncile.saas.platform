#!/usr/bin/env bash
set -euo pipefail

# Chronicle Labs -- Multi-Environment Setup
#
# Prerequisites:
#   - flyctl installed and authenticated (fly auth login)
#   - gh CLI installed and authenticated
#   - doppler CLI installed and authenticated, or DOPPLER_TOKEN exported
#
# Usage:
#   ./scripts/setup-production.sh [environment]
#   Environments: development | staging | production | all (default)

ENV="${1:-all}"
BACKEND_DEPLOY_DIR="deploy"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Chronicle Labs Environment Setup ==="
echo ""

setup_env() {
    local env_name="$1"
    local env_slug="$2"
    local fly_app="$3"
    local fly_config="$4"

    echo "── Setting up: $env_name ──"
    echo ""

    echo "  Fly.io app:    $fly_app"
    echo "  Fly.io config: $fly_config"
    echo "  URL:           https://$fly_app.fly.dev"
    echo "  Doppler config: ${env_slug}_backend"
    echo ""

    "${ROOT_DIR}/scripts/sync-fly-secrets-from-doppler.sh" "${env_slug}" "${fly_app}"

    echo "  Secrets synced from Doppler for $fly_app"
    echo ""

    if [ "$env_name" = "production" ]; then
        echo "  Frontend production env vars should be sourced from prd_frontend"
        echo "  and synced through env-manager's permanent environment sync."
        echo ""
    fi
}

if [ "$ENV" = "development" ] || [ "$ENV" = "all" ]; then
    setup_env "development" "dev" "chronicle-backend-dev" "${BACKEND_DEPLOY_DIR}/fly.development.toml"
fi

if [ "$ENV" = "staging" ] || [ "$ENV" = "all" ]; then
    setup_env "staging" "stg" "chronicle-backend-staging" "${BACKEND_DEPLOY_DIR}/fly.staging.toml"
fi

if [ "$ENV" = "production" ] || [ "$ENV" = "all" ]; then
    setup_env "production" "prd" "chronicle-backend" "${BACKEND_DEPLOY_DIR}/fly.production.toml"
fi

echo "=== Branching Strategy ==="
echo ""
echo "  develop  -> auto-deploys to chronicle-backend-dev.fly.dev"
echo "  staging  -> auto-deploys to chronicle-backend-staging.fly.dev"
echo "  main     -> auto-deploys to chronicle-backend.fly.dev"
echo ""
echo "  Feature branches: feat/* -> PR to develop"
echo "  Promotion: develop -> PR to staging -> PR to main"
echo ""

echo "=== Manual Deploy ==="
echo ""
echo "  Dev:     cd backend && flyctl deploy --config ${BACKEND_DEPLOY_DIR}/fly.development.toml --remote-only"
echo "  Staging: cd backend && flyctl deploy --config ${BACKEND_DEPLOY_DIR}/fly.staging.toml --remote-only"
echo "  Prod:    cd backend && flyctl deploy --config ${BACKEND_DEPLOY_DIR}/fly.production.toml --remote-only"
echo ""

echo "=== GitHub Environments ==="
echo ""
echo "  development  -- no protection, auto-deploy on develop push"
echo "  staging      -- auto-deploy on staging push"
echo "  production   -- branch restricted to main"
echo ""
echo "  Each environment needs FLY_API_TOKEN and DOPPLER_BACKEND_TOKEN."
echo ""
echo "=== Setup Complete ==="
