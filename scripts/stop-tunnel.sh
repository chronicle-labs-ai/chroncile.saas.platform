#!/usr/bin/env bash
set -euo pipefail

if [[ -f /tmp/chronicle-tunnel.env ]]; then
  source /tmp/chronicle-tunnel.env
  if [[ -n "${NGROK_PID:-}" ]]; then
    kill "$NGROK_PID" 2>/dev/null && echo "Stopped ngrok (PID $NGROK_PID)" || echo "ngrok already stopped"
  fi
  rm -f /tmp/chronicle-tunnel.env
else
  pkill -f "ngrok http" 2>/dev/null && echo "Stopped ngrok" || echo "No ngrok process found"
fi
