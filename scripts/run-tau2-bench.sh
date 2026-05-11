#!/usr/bin/env bash
set -euo pipefail

# Run the official Tau² benchmark through the isolated checkout and optionally
# emit a normalized summary artifact alongside the raw results file.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARK_DIR="$ROOT_DIR/benchmarks/tau2"
VENV_DIR="$BENCHMARK_DIR/.venv"
CHECKOUT_DIR="$BENCHMARK_DIR/vendor/tau2-bench"
SUMMARY_SCRIPT="$BENCHMARK_DIR/summarize_tau2_results.py"

if [ ! -x "$VENV_DIR/bin/tau2" ] || [ ! -d "$CHECKOUT_DIR" ]; then
  echo "Tau² benchmark is not set up yet. Run scripts/setup-tau2-bench.sh first." >&2
  exit 1
fi

TAU2_DOMAIN="${TAU2_DOMAIN:-retail}"
TAU2_AGENT="${TAU2_AGENT:-llm_agent}"
TAU2_USER="${TAU2_USER:-user_simulator}"
TAU2_TASK_SPLIT="${TAU2_TASK_SPLIT:-base}"
TAU2_TASK_SET_NAME="${TAU2_TASK_SET_NAME:-}"
TAU2_NUM_TRIALS="${TAU2_NUM_TRIALS:-1}"
TAU2_NUM_TASKS="${TAU2_NUM_TASKS:-}"
TAU2_MAX_CONCURRENCY="${TAU2_MAX_CONCURRENCY:-1}"
TAU2_AGENT_LLM="${TAU2_AGENT_LLM:-claude-haiku-4-5-20251001}"
TAU2_USER_LLM="${TAU2_USER_LLM:-claude-haiku-4-5-20251001}"
TAU2_SUMMARIZE="${TAU2_SUMMARIZE:-1}"
TAU2_MAX_STEPS="${TAU2_MAX_STEPS:-200}"
TAU2_MAX_ERRORS="${TAU2_MAX_ERRORS:-10}"
TAU2_LOG_LEVEL="${TAU2_LOG_LEVEL:-ERROR}"
TAU2_AUTO_RESUME="${TAU2_AUTO_RESUME:-1}"

if [ -n "${TAU2_SAVE_TO:-}" ]; then
  RESULTS_PATH="$TAU2_SAVE_TO"
else
  RESULTS_PATH="$(python3 - "$BENCHMARK_DIR" "$TAU2_DOMAIN" <<'PY'
import sys
from pathlib import Path

benchmark_dir = Path(sys.argv[1])
domain = sys.argv[2]
sys.path.insert(0, str(benchmark_dir))

from tau2_common import default_tau2_results_path

print(default_tau2_results_path(domain))
PY
)"
fi

RESULTS_PATH="$(python3 - "$RESULTS_PATH" <<'PY'
import sys
from pathlib import Path

print(Path(sys.argv[1]).expanduser().resolve())
PY
)"
RESULTS_PATH="${RESULTS_PATH%.json}"
TAU2_SAVE_TO_ARG="$RESULTS_PATH"
FINAL_RESULTS_PATH="${RESULTS_PATH}.json"

mkdir -p "$(dirname "$FINAL_RESULTS_PATH")"

echo "Running Tau² benchmark"
echo "Domain: $TAU2_DOMAIN"
echo "Results file: $FINAL_RESULTS_PATH"

TASK_SET_ARGS=()
if [ -n "$TAU2_TASK_SET_NAME" ]; then
  TASK_SET_ARGS+=(--task-set-name "$TAU2_TASK_SET_NAME")
fi

TASK_COUNT_ARGS=()
if [ -n "$TAU2_NUM_TASKS" ]; then
  TASK_COUNT_ARGS+=(--num-tasks "$TAU2_NUM_TASKS")
fi

(
  cd "$CHECKOUT_DIR"
  command=(
    "$VENV_DIR/bin/tau2" run
    --domain "$TAU2_DOMAIN"
    --task-split-name "$TAU2_TASK_SPLIT"
    --agent "$TAU2_AGENT"
    --user "$TAU2_USER"
    --agent-llm "$TAU2_AGENT_LLM"
    --user-llm "$TAU2_USER_LLM"
    --num-trials "$TAU2_NUM_TRIALS"
    --max-concurrency "$TAU2_MAX_CONCURRENCY"
    --max-steps "$TAU2_MAX_STEPS"
    --max-errors "$TAU2_MAX_ERRORS"
    --log-level "$TAU2_LOG_LEVEL"
    --save-to "$TAU2_SAVE_TO_ARG"
  )
  if [ "${#TASK_SET_ARGS[@]}" -gt 0 ]; then
    command+=("${TASK_SET_ARGS[@]}")
  fi
  if [ "${#TASK_COUNT_ARGS[@]}" -gt 0 ]; then
    command+=("${TASK_COUNT_ARGS[@]}")
  fi
  if [ "$#" -gt 0 ]; then
    command+=("$@")
  fi
  if [ "$TAU2_AUTO_RESUME" = "1" ] && [ -f "$FINAL_RESULTS_PATH" ]; then
    printf 'y\n' | "${command[@]}"
  else
    "${command[@]}"
  fi
)

echo "Tau² raw results written to $FINAL_RESULTS_PATH"

if [ "$TAU2_SUMMARIZE" = "1" ]; then
  python3 "$SUMMARY_SCRIPT" --input "$FINAL_RESULTS_PATH"
fi
