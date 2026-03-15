#!/usr/bin/env bash
set -euo pipefail

# Start an ngrok tunnel and patch PIPEDREAM_WEBHOOK_URL into the frontend .env.
# Usage: ./scripts/start-tunnel.sh [port]   (default: 3000)

PORT="${1:-3000}"
FRONTEND_ENV="apps/frontend/.env"
NGROK_API="http://127.0.0.1:4040/api/tunnels"
MAX_WAIT=15

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed. Install with: brew install ngrok" >&2
  exit 1
fi

# Kill any existing ngrok process so we get a clean tunnel.
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

echo "Starting ngrok tunnel to localhost:${PORT}..."
ngrok http "$PORT" --log=stdout --log-format=json > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for the ngrok API to come up and return a tunnel URL.
TUNNEL_URL=""
for i in $(seq 1 "$MAX_WAIT"); do
  sleep 1
  TUNNEL_URL=$(curl -s "$NGROK_API" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        if t.get('proto') == 'https':
            print(t['public_url'])
            break
except: pass
" 2>/dev/null || true)
  if [[ -n "$TUNNEL_URL" ]]; then
    break
  fi
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "Failed to get tunnel URL after ${MAX_WAIT}s. Check ngrok logs at /tmp/ngrok.log" >&2
  kill "$NGROK_PID" 2>/dev/null || true
  exit 1
fi

WEBHOOK_URL="${TUNNEL_URL}/api/webhooks/pipedream"

echo "Tunnel URL:  $TUNNEL_URL"
echo "Webhook URL: $WEBHOOK_URL"
echo "ngrok PID:   $NGROK_PID"
echo "Inspector:   http://127.0.0.1:4040"

# Patch the frontend .env file with the tunnel URL.
if [[ -f "$FRONTEND_ENV" ]]; then
  if grep -q "^PIPEDREAM_WEBHOOK_URL=" "$FRONTEND_ENV"; then
    sed -i '' "s|^PIPEDREAM_WEBHOOK_URL=.*|PIPEDREAM_WEBHOOK_URL=\"${WEBHOOK_URL}\"|" "$FRONTEND_ENV"
  else
    echo "PIPEDREAM_WEBHOOK_URL=\"${WEBHOOK_URL}\"" >> "$FRONTEND_ENV"
  fi
  echo "Updated $FRONTEND_ENV"
else
  echo "Warning: $FRONTEND_ENV not found, skipping env patch" >&2
fi

# Write state so other scripts can read the tunnel URL.
cat > /tmp/chronicle-tunnel.env <<EOF
TUNNEL_URL=${TUNNEL_URL}
PIPEDREAM_WEBHOOK_URL=${WEBHOOK_URL}
NGROK_PID=${NGROK_PID}
EOF

echo "Tunnel is running. Stop with: kill $NGROK_PID"
