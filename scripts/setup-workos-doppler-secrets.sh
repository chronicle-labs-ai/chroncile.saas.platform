#!/usr/bin/env bash
#
# Land the three WorkOS-dashboard-sourced secrets into Doppler for one
# environment. Use after `setup-workos-doppler-secrets.sh dev`-style.
#
# Per docs/doppler.md, WORKOS_API_KEY and WORKOS_CLIENT_ID live in BOTH
# the backend and frontend configs (same value). WORKOS_WEBHOOK_SECRET
# lives in the backend config only. The other two WorkOS-related keys
# (WORKOS_REDIRECT_URI, WORKOS_COOKIE_PASSWORD) are deterministic and
# are populated in `dev_frontend` / `stg_frontend` / `prd_frontend`
# directly — this script does not touch them.
#
# Values are read from stdin via `read -s` so they never appear in
# shell history, process listings, or the terminal scrollback.

set -euo pipefail

ENV_SLUG="${1:?usage: setup-workos-doppler-secrets.sh <dev|stg|prd>}"
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
echo "  - ${BACKEND_CONFIG}  (WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_WEBHOOK_SECRET)"
echo "  - ${FRONTEND_CONFIG} (WORKOS_API_KEY, WORKOS_CLIENT_ID)"
echo

read_secret() {
  local prompt="$1"
  local var_name="$2"
  local expected_prefix="${3:-}"
  local value=""

  while true; do
    printf "%s: " "${prompt}" >&2
    read -rs value
    printf "\n" >&2

    if [[ -z "${value}" ]]; then
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

read_secret "WORKOS_API_KEY (sk_...)"          API_KEY        "sk_"
read_secret "WORKOS_CLIENT_ID (client_...)"    CLIENT_ID      "client_"
read_secret "WORKOS_WEBHOOK_SECRET"            WEBHOOK_SECRET ""

echo
echo "Writing to Doppler..."

doppler secrets set --project "${DOPPLER_PROJECT}" --config "${BACKEND_CONFIG}" \
  --no-interactive --silent \
  "WORKOS_API_KEY=${API_KEY}" \
  "WORKOS_CLIENT_ID=${CLIENT_ID}" \
  "WORKOS_WEBHOOK_SECRET=${WEBHOOK_SECRET}" >/dev/null
echo "  ok: ${BACKEND_CONFIG}  (3 keys)"

doppler secrets set --project "${DOPPLER_PROJECT}" --config "${FRONTEND_CONFIG}" \
  --no-interactive --silent \
  "WORKOS_API_KEY=${API_KEY}" \
  "WORKOS_CLIENT_ID=${CLIENT_ID}" >/dev/null
echo "  ok: ${FRONTEND_CONFIG} (2 keys)"

unset API_KEY CLIENT_ID WEBHOOK_SECRET

echo
echo "Done. Verify with:"
echo "  doppler secrets --project ${DOPPLER_PROJECT} --config ${BACKEND_CONFIG} --only-names | grep WORKOS_"
echo "  doppler secrets --project ${DOPPLER_PROJECT} --config ${FRONTEND_CONFIG} --only-names | grep WORKOS_"
