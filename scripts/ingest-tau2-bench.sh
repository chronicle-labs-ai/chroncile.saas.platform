#!/usr/bin/env bash
set -euo pipefail

# Ingest official Tau² result files into Chronicle's native events API and emit
# a manifest describing the imported benchmark runs.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARK_DIR="$ROOT_DIR/benchmarks/tau2"
INGEST_SCRIPT="$BENCHMARK_DIR/ingest_tau2_to_chronicle.py"

if [ "$#" -lt 1 ] && [ -z "${TAU2_RESULTS_FILE:-}" ]; then
  echo "Usage: scripts/ingest-tau2-bench.sh <tau2-results.json> [more files...]" >&2
  echo "Or set TAU2_RESULTS_FILE=/path/to/results.json" >&2
  exit 1
fi

CHRONICLE_EVENTS_URL="${CHRONICLE_EVENTS_URL:-http://localhost:8080}"
CHRONICLE_TAU2_ORG_ID="${CHRONICLE_TAU2_ORG_ID:-tau2-benchmark}"
CHRONICLE_TAU2_BATCH_SIZE="${CHRONICLE_TAU2_BATCH_SIZE:-100}"
CHRONICLE_TAU2_CREATED_BY="${CHRONICLE_TAU2_CREATED_BY:-tau2-bench-importer}"
CHRONICLE_TAU2_CREATE_LINKS="${CHRONICLE_TAU2_CREATE_LINKS:-1}"

INPUT_ARGS=()
if [ -n "${TAU2_RESULTS_FILE:-}" ]; then
  INPUT_ARGS+=(--input "$TAU2_RESULTS_FILE")
fi
for path in "$@"; do
  INPUT_ARGS+=(--input "$path")
done

if [ -n "${TAU2_INGEST_MANIFEST:-}" ]; then
  OUTPUT_ARGS=(--output "$TAU2_INGEST_MANIFEST")
else
  OUTPUT_ARGS=()
fi

LINK_ARGS=()
if [ "$CHRONICLE_TAU2_CREATE_LINKS" != "1" ]; then
  LINK_ARGS+=(--no-links)
fi

command=(
  python3 "$INGEST_SCRIPT"
  "${INPUT_ARGS[@]}"
  --chronicle-url "$CHRONICLE_EVENTS_URL"
  --org-id "$CHRONICLE_TAU2_ORG_ID"
  --batch-size "$CHRONICLE_TAU2_BATCH_SIZE"
  --created-by "$CHRONICLE_TAU2_CREATED_BY"
)
if [ "${#LINK_ARGS[@]}" -gt 0 ]; then
  command+=("${LINK_ARGS[@]}")
fi
if [ "${#OUTPUT_ARGS[@]}" -gt 0 ]; then
  command+=("${OUTPUT_ARGS[@]}")
fi

"${command[@]}"
