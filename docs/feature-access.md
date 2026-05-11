# Feature Access

This repository uses a backend-owned feature access model with two layers:

- `entitlements`: durable capabilities derived from the tenant subscription or plan
- `feature flags`: runtime switches layered on top for rollout, experiments, kill switches, and tenant exceptions

## Naming

- Use human-readable camelCase keys such as `sandbox` or `agentEndpointConfig`.
- Do not build flag names dynamically.
- Prefer one flag per operator decision. If two features need different rollback paths, they should have different keys.

## Ownership

- Every flag definition must include an `owner`.
- Every flag definition should include a clear, user-facing description of what turning it on or off changes.
- Subscription entitlements are owned by product and billing logic, not by the frontend.

## Lifecycle

- `release` and `experiment` flags are temporary by default and should be removed after rollout.
- `ops` flags are long-lived kill switches and should stay documented and tested.
- `entitlement` flags should mirror durable product capabilities and can be overridden per tenant when support or sales needs an exception.

## Cleanup Rules

- Add an `expiresAt` value when a flag is meant to be temporary.
- Treat flag cleanup as part of the definition of done for rollout work.
- Remove dead code after a temporary flag is launched or abandoned.
- Prefer resetting tenant overrides once the underlying rollout or incident is resolved.

## Subscription Mapping

- The backend resolves Stripe `price_id` values into internal `plan_id` values.
- Keep Stripe identifiers out of frontend product-access logic.
- If a new Stripe price is introduced, update the backend plan mapping before rollout so entitlements stay deterministic.
