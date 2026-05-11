#!/usr/bin/env bash
set -euo pipefail

# Normalize one or more Tau² raw result files into repo-local JSON and markdown
# summary artifacts.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARK_DIR="$ROOT_DIR/benchmarks/tau2"
SUMMARY_SCRIPT="$BENCHMARK_DIR/summarize_tau2_results.py"

if [ "$#" -lt 1 ] && [ -z "${TAU2_RESULTS_FILE:-}" ]; then
  echo "Usage: scripts/report-tau2-bench.sh <tau2-results.json> [more files...]" >&2
  echo "Or set TAU2_RESULTS_FILE=/path/to/results.json" >&2
  exit 1
fi

INPUT_ARGS=()
if [ -n "${TAU2_RESULTS_FILE:-}" ]; then
  INPUT_ARGS+=(--input "$TAU2_RESULTS_FILE")
fi
for path in "$@"; do
  INPUT_ARGS+=(--input "$path")
done

OUTPUT_ARGS=()
if [ -n "${TAU2_SUMMARY_OUTPUT:-}" ]; then
  OUTPUT_ARGS+=(--output "$TAU2_SUMMARY_OUTPUT")
fi
if [ -n "${TAU2_SUMMARY_MARKDOWN:-}" ]; then
  OUTPUT_ARGS+=(--markdown "$TAU2_SUMMARY_MARKDOWN")
fi

command=(python3 "$SUMMARY_SCRIPT" "${INPUT_ARGS[@]}")
if [ "${#OUTPUT_ARGS[@]}" -gt 0 ]; then
  command+=("${OUTPUT_ARGS[@]}")
fi

"${command[@]}"
