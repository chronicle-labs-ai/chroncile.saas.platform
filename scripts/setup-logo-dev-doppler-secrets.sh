#!/usr/bin/env bash
#
# Store Logo.dev keys in the split Doppler configs for one environment.
# The publishable key is used by frontend image URLs. The secret key is
# optional and only belongs in the backend config if a server-side Logo.dev
# integration is added later.

set -euo pipefail

ENV_SLUG="${1:?usage: setup-logo-dev-doppler-secrets.sh <dev|stg|prd>}"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-chronicle-platform}"

case "${ENV_SLUG}" in
  dev|stg|prd) ;;
  *)
    echo "error: env slug must be one of: dev, stg, prd" >&2
    exit 2
    ;;
esac

if ! command -v doppler >/dev/null 2>&1; then
  echo "doppler CLI is required (https://docs.doppler.com/docs/install-cli)" >&2
  exit 1
fi

BACKEND_CONFIG="${ENV_SLUG}_backend"
FRONTEND_CONFIG="${ENV_SLUG}_frontend"

echo "Targeting Doppler project '${DOPPLER_PROJECT}', configs:"
echo "  - ${FRONTEND_CONFIG} (NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY)"
echo "  - ${BACKEND_CONFIG}  (LOGO_DEV_SECRET_KEY, optional)"
echo

read_secret() {
  local prompt="$1"
  local var_name="$2"
  local expected_prefix="${3:-}"
  local allow_empty="${4:-false}"
  local value=""

  while true; do
    printf "%s: " "${prompt}" >&2
    read -rs value
    printf "\n" >&2

    if [[ -z "${value}" ]]; then
      if [[ "${allow_empty}" == "true" ]]; then
        break
      fi
      echo "  empty value, try again" >&2
      continue
    fi

    if [[ -n "${expected_prefix}" && "${value}" != "${expected_prefix}"* ]]; then
      echo "  warning: value does not start with '${expected_prefix}'" >&2
      printf "  use it anyway? [y/N] " >&2
      local confirm
      read -r confirm
      [[ "${confirm}" =~ ^[yY]$ ]] || continue
    fi

    break
  done

  printf -v "${var_name}" '%s' "${value}"
}

read_secret "Logo.dev publishable token (pk_...)" PUBLISHABLE_TOKEN "pk_"
read_secret "Logo.dev secret key (sk_..., optional)" SECRET_KEY "sk_" true

echo
echo "Writing to Doppler..."

printf "%s" "${PUBLISHABLE_TOKEN}" | doppler secrets set NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY \
  --project "${DOPPLER_PROJECT}" \
  --config "${FRONTEND_CONFIG}" \
  --no-interactive \
  --silent >/dev/null
echo "  ok: ${FRONTEND_CONFIG} (NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY)"

if [[ -n "${SECRET_KEY}" ]]; then
  printf "%s" "${SECRET_KEY}" | doppler secrets set LOGO_DEV_SECRET_KEY \
    --project "${DOPPLER_PROJECT}" \
    --config "${BACKEND_CONFIG}" \
    --no-interactive \
    --silent >/dev/null
  echo "  ok: ${BACKEND_CONFIG}  (LOGO_DEV_SECRET_KEY)"
else
  echo "  skipped: ${BACKEND_CONFIG}  (no server-side Logo.dev usage yet)"
fi

unset PUBLISHABLE_TOKEN SECRET_KEY

echo
echo "Done. Sync local env files with:"
echo "  make doppler-sync DOPPLER_ENV=${ENV_SLUG}"
