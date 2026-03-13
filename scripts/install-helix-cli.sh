#!/usr/bin/env bash

set -euo pipefail

if command -v helix >/dev/null 2>&1; then
  exec helix --version
fi

if [[ -x "${HOME}/.local/bin/helix" ]]; then
  exec "${HOME}/.local/bin/helix" --version
fi

curl -sSL https://install.helix-db.com | bash
