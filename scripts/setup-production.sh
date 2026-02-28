#!/usr/bin/env bash
set -euo pipefail

# Chronicle Labs -- Production Setup (Render + Vercel)
#
# Prerequisites:
#   - Render account at https://dashboard.render.com
#   - Vercel CLI installed (npm i -g vercel) and linked to project
#   - GitHub repo connected to Render via Blueprint
#
# Usage:
#   ./scripts/setup-production.sh

echo "=== Chronicle Labs Production Setup ==="
echo ""

# ── 1. Generate Secrets ──

AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
SERVICE_SECRET="${SERVICE_SECRET:-$(openssl rand -base64 32)}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

# Use the session pooler (port 6543) for SQLx compatibility
# The transaction pooler (port 5432) doesn't support prepared statements
DATABASE_URL="${DATABASE_URL:-postgresql://postgres.civkodlunbswfhltbvqc:AydeaProxify@aws-1-us-east-1.pooler.supabase.com:6543/postgres}"

echo "Generated secrets (save these — you'll enter them in the Render Dashboard):"
echo ""
echo "  DATABASE_URL           = ${DATABASE_URL:0:50}..."
echo "  AUTH_SECRET             = $AUTH_SECRET"
echo "  SERVICE_SECRET          = $SERVICE_SECRET"
echo "  ENCRYPTION_KEY          = $ENCRYPTION_KEY"
echo ""

# ── 2. Render Backend Setup ──

echo "=== Render Configuration ==="
echo ""
echo "1. Go to https://dashboard.render.com/select-repo?type=blueprint"
echo "2. Connect the GitHub repo and select the render.yaml Blueprint"
echo "3. Render will prompt you for the following secret environment variables:"
echo ""
echo "   DATABASE_URL            = (paste from above)"
echo "   AUTH_SECRET              = (paste from above)"
echo "   SERVICE_SECRET           = (paste from above)"
echo "   ENCRYPTION_KEY           = (paste from above)"
echo "   PIPEDREAM_CLIENT_ID      = ${PIPEDREAM_CLIENT_ID:-<your Pipedream client ID>}"
echo "   PIPEDREAM_CLIENT_SECRET  = ${PIPEDREAM_CLIENT_SECRET:-<your Pipedream client secret>}"
echo "   PIPEDREAM_PROJECT_ID     = ${PIPEDREAM_PROJECT_ID:-<your Pipedream project ID>}"
echo "   STRIPE_SECRET_KEY        = ${STRIPE_SECRET_KEY:-<your Stripe secret key>}"
echo "   STRIPE_WEBHOOK_SECRET    = ${STRIPE_WEBHOOK_SECRET:-<your Stripe webhook secret>}"
echo ""
echo "4. Click 'Apply' — Render will build and deploy the backend from the Dockerfile"
echo ""
echo "   The backend URL will be: https://chronicle-backend.onrender.com"
echo ""

# ── 3. Vercel Frontend Environment Variables ──

echo "=== Vercel Configuration ==="
echo ""
echo "Set these environment variables in the Vercel dashboard"
echo "(Settings > Environment Variables) for the frontend project:"
echo ""
echo "  NEXT_PUBLIC_APP_URL        = https://<your-vercel-domain>"
echo "  NEXT_PUBLIC_BACKEND_URL    = https://chronicle-backend.onrender.com"
echo "  AUTH_SECRET                = $AUTH_SECRET"
echo "  AUTH_TRUST_HOST            = true"
echo "  SERVICE_SECRET             = $SERVICE_SECRET"
echo "  ENCRYPTION_KEY             = $ENCRYPTION_KEY"
echo "  PIPEDREAM_CLIENT_ID        = ${PIPEDREAM_CLIENT_ID:-<set in Vercel>}"
echo "  PIPEDREAM_CLIENT_SECRET    = ${PIPEDREAM_CLIENT_SECRET:-<set in Vercel>}"
echo "  PIPEDREAM_PROJECT_ID       = ${PIPEDREAM_PROJECT_ID:-<set in Vercel>}"
echo "  STRIPE_SECRET_KEY          = ${STRIPE_SECRET_KEY:-<set in Vercel>}"
echo ""

# ── 4. CI/CD Flow ──

echo "=== CI/CD Flow ==="
echo ""
echo "  1. Push to main"
echo "  2. GitHub Actions runs lint + test + build"
echo "  3. When all checks pass, Render auto-deploys (autoDeployTrigger: checksPass)"
echo "  4. Vercel auto-deploys the frontend on push"
echo ""

# ── 5. First Deploy ──

echo "=== First Deploy ==="
echo ""
echo "Backend:"
echo "  Connect repo via Blueprint at https://dashboard.render.com/select-repo?type=blueprint"
echo ""
echo "Frontend:"
echo "  Connect repo to Vercel at https://vercel.com/new"
echo "  Set root directory to: apps/frontend"
echo "  Framework preset: Next.js"
echo ""
echo "After first deploy, CI/CD handles subsequent deploys automatically."
echo ""
echo "=== Setup Complete ==="
