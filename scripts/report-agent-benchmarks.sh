#!/usr/bin/env bash
set -euo pipefail

# Combine Chronicle MCP benchmark output with normalized Tau² summaries into a
# clearly labeled side-by-side report.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARK_DIR="$ROOT_DIR/benchmarks/tau2"
REPORT_SCRIPT="$BENCHMARK_DIR/render_benchmark_report.py"

if [ -z "${CHRONICLE_BENCHMARK_FILE:-}" ]; then
  echo "Set CHRONICLE_BENCHMARK_FILE to a Chronicle MCP benchmark JSON or stdout capture." >&2
  exit 1
fi

TAU2_SUMMARY_FILES="${TAU2_SUMMARY_FILES:-}"
if [ -z "$TAU2_SUMMARY_FILES" ] && [ "$#" -lt 1 ]; then
  echo "Usage: CHRONICLE_BENCHMARK_FILE=... scripts/report-agent-benchmarks.sh <tau2-summary.json> [more summaries...]" >&2
  echo "Or set TAU2_SUMMARY_FILES to a colon-separated list of summary files." >&2
  exit 1
fi

SUMMARY_ARGS=()
if [ -n "$TAU2_SUMMARY_FILES" ]; then
  IFS=':' read -r -a summary_paths <<< "$TAU2_SUMMARY_FILES"
  for path in "${summary_paths[@]}"; do
    SUMMARY_ARGS+=(--tau2-summary "$path")
  done
fi
for path in "$@"; do
  SUMMARY_ARGS+=(--tau2-summary "$path")
done

INGEST_ARGS=()
if [ -n "${TAU2_INGEST_MANIFESTS:-}" ]; then
  IFS=':' read -r -a manifest_paths <<< "$TAU2_INGEST_MANIFESTS"
  for path in "${manifest_paths[@]}"; do
    INGEST_ARGS+=(--ingestion-manifest "$path")
  done
fi

OUTPUT_ARGS=()
if [ -n "${BENCHMARK_REPORT_OUTPUT:-}" ]; then
  OUTPUT_ARGS+=(--output "$BENCHMARK_REPORT_OUTPUT")
fi
if [ -n "${BENCHMARK_REPORT_JSON_OUTPUT:-}" ]; then
  OUTPUT_ARGS+=(--json-output "$BENCHMARK_REPORT_JSON_OUTPUT")
fi

command=(python3 "$REPORT_SCRIPT" "${SUMMARY_ARGS[@]}" --chronicle "$CHRONICLE_BENCHMARK_FILE")
if [ "${#INGEST_ARGS[@]}" -gt 0 ]; then
  command+=("${INGEST_ARGS[@]}")
fi
if [ "${#OUTPUT_ARGS[@]}" -gt 0 ]; then
  command+=("${OUTPUT_ARGS[@]}")
fi

"${command[@]}"
