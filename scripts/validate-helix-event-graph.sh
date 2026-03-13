#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HELIX_INSTANCE="${HELIX_INSTANCE:-test}"

if [[ "${HELIX_SKIP_PUSH:-0}" != "1" ]]; then
  bash "${SCRIPT_DIR}/helix-event-graph-push.sh" "${HELIX_INSTANCE}"
fi

if [[ -z "${HELIX_TEST_DATABASE_URL:-}" ]]; then
  if [[ -n "${EVENTS_DATABASE_URL:-}" ]]; then
    export HELIX_TEST_DATABASE_URL="${EVENTS_DATABASE_URL}"
  elif [[ -n "${DATABASE_URL:-}" ]]; then
    export HELIX_TEST_DATABASE_URL="${DATABASE_URL}"
  fi
fi

if [[ "${HELIX_INSTANCE}" == "test" && -z "${HELIX_TEST_PORT:-}" ]]; then
  export HELIX_TEST_PORT=6970
fi

cd "${REPO_ROOT}/backend"

cargo test -p chronicle_store --features "postgres helix" \
  --test helix_backend -- --ignored --nocapture --test-threads=1 "$@"
