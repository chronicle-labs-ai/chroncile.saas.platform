#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${HELIX_SKIP_PUSH:-0}" != "1" ]]; then
  bash "${SCRIPT_DIR}/helix-event-graph-push.sh" "${HELIX_INSTANCE:-dev}"
fi

cd "${REPO_ROOT}/backend"

cargo run -p chronicle_store --features "postgres helix" \
  --example helix_load_from_postgres -- "$@"
