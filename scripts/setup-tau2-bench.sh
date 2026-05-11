#!/usr/bin/env bash
set -euo pipefail

# Clone/update the official Tau² benchmark in an isolated workspace and install
# it into benchmarks/tau2/.venv without affecting the main repo toolchains.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARK_DIR="$ROOT_DIR/benchmarks/tau2"
UPSTREAM_METADATA="$BENCHMARK_DIR/upstream.json"
VENV_DIR="$BENCHMARK_DIR/.venv"
VENDOR_DIR="$BENCHMARK_DIR/vendor"
CHECKOUT_DIR="$VENDOR_DIR/tau2-bench"

if [ ! -f "$UPSTREAM_METADATA" ]; then
  echo "Missing Tau² metadata file: $UPSTREAM_METADATA" >&2
  exit 1
fi

UPSTREAM_REPOSITORY="${TAU2_BENCH_REPOSITORY:-$(python3 - "$UPSTREAM_METADATA" <<'PY'
import json
import sys
from pathlib import Path

metadata = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(metadata["repository"])
PY
)}"
UPSTREAM_REF="${TAU2_BENCH_REF:-$(python3 - "$UPSTREAM_METADATA" <<'PY'
import json
import sys
from pathlib import Path

metadata = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(metadata["ref"])
PY
)}"

mkdir -p "$VENDOR_DIR" "$BENCHMARK_DIR/output/raw" "$BENCHMARK_DIR/output/summaries" "$BENCHMARK_DIR/output/ingestion" "$BENCHMARK_DIR/reports"

if [ ! -d "$CHECKOUT_DIR/.git" ]; then
  echo "Cloning Tau² benchmark from $UPSTREAM_REPOSITORY"
  git clone "$UPSTREAM_REPOSITORY" "$CHECKOUT_DIR"
fi

echo "Updating Tau² benchmark checkout to $UPSTREAM_REF"
git -C "$CHECKOUT_DIR" fetch --tags origin
git -C "$CHECKOUT_DIR" checkout "$UPSTREAM_REF"

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "Creating isolated Tau² virtual environment at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

echo "Installing Tau² benchmark into the isolated virtual environment"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -e "$CHECKOUT_DIR"

echo "Tau² benchmark is ready"
echo "Checkout: $CHECKOUT_DIR"
echo "Virtualenv: $VENV_DIR"
echo "Pinned ref: $UPSTREAM_REF"
