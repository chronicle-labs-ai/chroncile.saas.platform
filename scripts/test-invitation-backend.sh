#!/usr/bin/env bash
#
# Smoke test for the M2 invitation flow at the backend layer.
#
# Hits the running Rust backend at /api/platform/tenants/register-workos
# directly — no frontend, no WorkOS — to verify the handler creates a User
# row when Tenant exists but User is new (the path that broke /accept-invite).
#
# Pre-conditions:
#   1. Backend running locally (default: http://localhost:8000)
#   2. SERVICE_SECRET env var set in the SAME terminal (must match what the
#      backend has loaded from its env)
#
# Run:
#   SERVICE_SECRET="<value>" ./scripts/test-invitation-backend.sh
#   # or override the URL:
#   BACKEND_URL=http://localhost:8000 SERVICE_SECRET="..." ./scripts/test-invitation-backend.sh
#
# What it does:
#   Case A — onboarding (tenant + user both new) — must return created=true
#   Case B — invitation (tenant exists, user new) — must return created=false
#                                                   AND user must be persisted
#   Case C — re-register (idempotent) — must return created=false, no error
#   Case D — empty service_secret — must return 401
#   Case E — onboarding with empty name — must return 400
#
# After each case, prints the HTTP status + JSON body. Any non-expected
# status is highlighted with ❌ and the script exits non-zero so this is
# CI-friendly.
#
# This script does NOT clean up — it uses unique IDs per run, but you may
# want to truncate tables between runs to avoid clutter.

set -u

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
ENDPOINT="${BACKEND_URL}/api/platform/tenants/register-workos"

if [[ -z "${SERVICE_SECRET:-}" ]]; then
  echo "❌ SERVICE_SECRET env var is required."
  echo
  echo "   Set it in the same terminal where the backend is running, OR copy"
  echo "   the value from apps/frontend/.env / backend Doppler config:"
  echo "     SERVICE_SECRET=\"<secret>\" $0"
  exit 2
fi

# Unique per-run suffix so re-runs don't collide.
RUN_ID="$(date +%s)$$"
ORG_A="org_test_a_${RUN_ID}"
USER_ADMIN="user_admin_${RUN_ID}"
USER_INVITEE="user_invitee_${RUN_ID}"

echo "▶ BACKEND_URL = ${BACKEND_URL}"
echo "▶ Run ID      = ${RUN_ID}"
echo "▶ Org A       = ${ORG_A}"
echo "▶ Admin user  = ${USER_ADMIN}"
echo "▶ Invitee     = ${USER_INVITEE}"
echo

failures=0

#
# Helper: POSTs JSON, prints status + body, returns status in $http_status.
#
post_json() {
  local label="$1"
  local body="$2"
  local expected_status="$3"
  local expected_jq_check="${4-}"

  echo "─── ${label} ───"
  local response_file
  response_file="$(mktemp)"
  local http_status
  http_status="$(
    curl -sS -o "${response_file}" -w "%{http_code}" \
      -X POST "${ENDPOINT}" \
      -H "Content-Type: application/json" \
      -d "${body}"
  )"
  local body_text
  body_text="$(cat "${response_file}")"
  rm -f "${response_file}"

  echo "  status: ${http_status}"
  echo "  body:   ${body_text}"

  if [[ "${http_status}" == "${expected_status}" ]]; then
    echo "  ✅ status ok"
  else
    echo "  ❌ expected ${expected_status}, got ${http_status}"
    failures=$((failures + 1))
    echo
    return
  fi

  if [[ -n "${expected_jq_check}" ]]; then
    if echo "${body_text}" | jq -e "${expected_jq_check}" >/dev/null 2>&1; then
      echo "  ✅ body check passed: ${expected_jq_check}"
    else
      echo "  ❌ body check failed: ${expected_jq_check}"
      failures=$((failures + 1))
    fi
  fi
  echo
}

#
# CASE A — onboarding (new tenant + new user)
#
post_json "Case A — onboarding (new tenant + new user)" "$(
  cat <<EOF
{
  "serviceSecret": "${SERVICE_SECRET}",
  "workosUserId": "${USER_ADMIN}",
  "workosOrganizationId": "${ORG_A}",
  "email": "admin-${RUN_ID}@example.com",
  "name": "Test Workspace ${RUN_ID}",
  "slug": "test-workspace-${RUN_ID}",
  "firstName": "Admin",
  "lastName": "Smith"
}
EOF
)" "200" '.created == true and .tenantId != null and .userId != null'

#
# CASE B — invitation accept (tenant exists, user new)
#
post_json "Case B — invitation (tenant exists, user new)" "$(
  cat <<EOF
{
  "serviceSecret": "${SERVICE_SECRET}",
  "workosUserId": "${USER_INVITEE}",
  "workosOrganizationId": "${ORG_A}",
  "email": "invitee-${RUN_ID}@example.com",
  "name": "",
  "slug": "",
  "firstName": "Invitee",
  "lastName": "Jones"
}
EOF
)" "200" '.created == false and .tenantId != null and .userId != null'

#
# CASE C — idempotent re-register of existing user
#
post_json "Case C — idempotent re-register" "$(
  cat <<EOF
{
  "serviceSecret": "${SERVICE_SECRET}",
  "workosUserId": "${USER_INVITEE}",
  "workosOrganizationId": "${ORG_A}",
  "email": "invitee-${RUN_ID}@example.com",
  "name": "",
  "slug": "",
  "firstName": "Invitee",
  "lastName": "Jones"
}
EOF
)" "200" '.created == false'

#
# CASE D — wrong service_secret (security check)
#
post_json "Case D — wrong service_secret rejected" "$(
  cat <<EOF
{
  "serviceSecret": "DEFINITELY-NOT-THE-RIGHT-SECRET",
  "workosUserId": "user_evil_${RUN_ID}",
  "workosOrganizationId": "org_evil_${RUN_ID}",
  "email": "evil-${RUN_ID}@example.com",
  "name": "Evil Corp",
  "slug": "evil"
}
EOF
)" "401" ""

#
# CASE E — onboarding with empty name (validation, only when creating new tenant)
#
post_json "Case E — empty name rejected for NEW tenant" "$(
  cat <<EOF
{
  "serviceSecret": "${SERVICE_SECRET}",
  "workosUserId": "user_z_${RUN_ID}",
  "workosOrganizationId": "org_brand_new_${RUN_ID}",
  "email": "z-${RUN_ID}@example.com",
  "name": "",
  "slug": "still-valid"
}
EOF
)" "400" ""

echo "════════════════════════════════════════"
if [[ ${failures} -eq 0 ]]; then
  echo "✅ All 5 cases passed. Backend invitation logic is correct."
  exit 0
else
  echo "❌ ${failures} check(s) failed. See output above."
  exit 1
fi
