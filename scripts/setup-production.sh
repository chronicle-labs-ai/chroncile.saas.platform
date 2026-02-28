#!/usr/bin/env bash
set -euo pipefail

# Chronicle Labs -- Production Setup
#
# Prerequisites:
#   - flyctl installed and authenticated (fly auth login)
#   - Vercel CLI installed (npm i -g vercel) and linked to project
#   - GitHub repo secrets configured (FLY_API_TOKEN)
#
# Usage:
#   ./scripts/setup-production.sh

echo "=== Chronicle Labs Production Setup ==="
echo ""

# ── 1. Fly.io Backend Secrets ──

echo "Setting Fly.io secrets for chronicle-backend..."
echo "(You'll be prompted for values if not set as env vars)"
echo ""

# Use the session pooler (port 6543) for SQLx compatibility
# The transaction pooler (port 5432) doesn't support prepared statements
FLY_DATABASE_URL="${DATABASE_URL:-postgresql://postgres.civkodlunbswfhltbvqc:AydeaProxify@aws-1-us-east-1.pooler.supabase.com:6543/postgres}"

# Generate secrets if not provided
FLY_AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
FLY_SERVICE_SECRET="${SERVICE_SECRET:-$(openssl rand -base64 32)}"
FLY_ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

echo "Database URL: ${FLY_DATABASE_URL:0:50}..."
echo "Auth Secret: ${FLY_AUTH_SECRET:0:10}..."
echo ""

read -p "Continue with these values? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. Set env vars and re-run."
    exit 1
fi

flyctl secrets set \
    DATABASE_URL="$FLY_DATABASE_URL" \
    AUTH_SECRET="$FLY_AUTH_SECRET" \
    SERVICE_SECRET="$FLY_SERVICE_SECRET" \
    ENCRYPTION_KEY="$FLY_ENCRYPTION_KEY" \
    PIPEDREAM_CLIENT_ID="${PIPEDREAM_CLIENT_ID:-}" \
    PIPEDREAM_CLIENT_SECRET="${PIPEDREAM_CLIENT_SECRET:-}" \
    PIPEDREAM_PROJECT_ID="${PIPEDREAM_PROJECT_ID:-}" \
    STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}" \
    STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}" \
    --app chronicle-backend

echo ""
echo "Fly.io secrets configured."
echo ""

# ── 2. Vercel Frontend Environment Variables ──

echo "=== Vercel Configuration ==="
echo ""
echo "Set these environment variables in the Vercel dashboard"
echo "(Settings > Environment Variables) for the frontend project:"
echo ""
echo "  NEXT_PUBLIC_APP_URL        = https://<your-vercel-domain>"
echo "  NEXT_PUBLIC_BACKEND_URL    = https://chronicle-backend.fly.dev"
echo "  AUTH_SECRET                = $FLY_AUTH_SECRET"
echo "  AUTH_TRUST_HOST            = true"
echo "  SERVICE_SECRET             = $FLY_SERVICE_SECRET"
echo "  ENCRYPTION_KEY             = $FLY_ENCRYPTION_KEY"
echo "  PIPEDREAM_CLIENT_ID        = ${PIPEDREAM_CLIENT_ID:-<set in Vercel>}"
echo "  PIPEDREAM_CLIENT_SECRET    = ${PIPEDREAM_CLIENT_SECRET:-<set in Vercel>}"
echo "  PIPEDREAM_PROJECT_ID       = ${PIPEDREAM_PROJECT_ID:-<set in Vercel>}"
echo "  STRIPE_SECRET_KEY          = ${STRIPE_SECRET_KEY:-<set in Vercel>}"
echo ""

# ── 3. GitHub Actions Secrets ──

echo "=== GitHub Actions ==="
echo ""
echo "Set this secret in GitHub repo settings (Settings > Secrets > Actions):"
echo ""
echo "  FLY_API_TOKEN = $(flyctl auth token 2>/dev/null || echo '<run: flyctl auth token>')"
echo ""

# ── 4. Deploy ──

echo "=== First Deploy ==="
echo ""
echo "Backend:"
echo "  cd backend && flyctl deploy --remote-only"
echo ""
echo "Frontend:"
echo "  Connect repo to Vercel at https://vercel.com/new"
echo "  Set root directory to: apps/frontend"
echo "  Framework preset: Next.js"
echo ""
echo "After first deploy, CI/CD handles subsequent deploys automatically."
echo ""
echo "=== Setup Complete ==="
