#!/usr/bin/env bash
set -euo pipefail

ENV_SLUG="${1:?usage: sync-fly-secrets-from-doppler.sh <dev|stg|prd> [fly-app-name]}"
FLY_APP_NAME="${2:-}"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-chronicle-platform}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-${ENV_SLUG}_backend}"

if ! command -v doppler >/dev/null 2>&1; then
  echo "doppler CLI is required" >&2
  exit 1
fi

if ! command -v flyctl >/dev/null 2>&1; then
  echo "flyctl is required" >&2
  exit 1
fi

if [[ -z "${FLY_APP_NAME}" ]]; then
  case "${ENV_SLUG}" in
    dev)
      FLY_APP_NAME="chronicle-backend-dev"
      ;;
    stg)
      FLY_APP_NAME="chronicle-backend-staging"
      ;;
    prd)
      FLY_APP_NAME="chronicle-backend"
      ;;
    *)
      echo "unsupported environment slug: ${ENV_SLUG}" >&2
      exit 1
      ;;
  esac
fi

echo "Syncing ${DOPPLER_PROJECT}/${DOPPLER_CONFIG} -> ${FLY_APP_NAME}"
doppler secrets download \
  --project "${DOPPLER_PROJECT}" \
  --config "${DOPPLER_CONFIG}" \
  --format env-no-quotes \
  --no-file | flyctl secrets import --stage --app "${FLY_APP_NAME}"
