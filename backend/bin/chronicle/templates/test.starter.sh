#!/bin/bash
# Starter test.sh scaffolded by `chronicle recipes init`.
#
# The verifier runs this inside the sandbox. It must:
#   1. Inspect whatever the agent produced under $WORK_DIR
#   2. Write a numeric reward (0.0..1.0 typical) to one of:
#        /tmp/chronicle/logs/verifier/reward.txt   (single number)
#        /tmp/chronicle/logs/verifier/reward.json  (multi-key {"key": value})
#
# This default is intentionally trivial: it confirms the agent's
# echo-runner produced /tmp/chronicle/work/output.txt and awards 1.0
# if so, 0.0 otherwise. Replace with real grading logic.

set -euo pipefail

mkdir -p /tmp/chronicle/logs/verifier

if [ -f /tmp/chronicle/work/output.txt ]; then
  echo "agent output:"
  cat /tmp/chronicle/work/output.txt
  echo 1 > /tmp/chronicle/logs/verifier/reward.txt
else
  echo "agent did not produce /tmp/chronicle/work/output.txt"
  echo 0 > /tmp/chronicle/logs/verifier/reward.txt
fi
