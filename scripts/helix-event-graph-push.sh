#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="${ROOT_DIR}/backend/helix/event-graph"
INSTANCE="${1:-dev}"
DOCKER_DESKTOP_BIN="/Applications/Docker.app/Contents/Resources/bin"

if [[ -d "${DOCKER_DESKTOP_BIN}" ]]; then
  export PATH="${DOCKER_DESKTOP_BIN}:${PATH}"
fi

if command -v helix >/dev/null 2>&1; then
  HELIX_BIN="$(command -v helix)"
elif [[ -x "${HOME}/.local/bin/helix" ]]; then
  HELIX_BIN="${HOME}/.local/bin/helix"
else
  echo "Helix CLI not found. Run ./scripts/install-helix-cli.sh first." >&2
  exit 1
fi

cd "${PROJECT_DIR}"
"${HELIX_BIN}" push "${INSTANCE}"
