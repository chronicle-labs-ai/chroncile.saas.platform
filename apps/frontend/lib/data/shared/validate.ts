/*
 * Boundary validation helpers.
 *
 * Provider impls (`app`, `chronicle`) hand HTTP responses through
 * `validate(schema, raw)` so a schema mismatch surfaces as a clean
 * `ProviderError(502, …)` rather than a runtime crash deep in the
 * component tree.
 *
 * Schemas come from `chronicle/schemas`, which are auto-generated from
 * the Rust types via `yarn gen:contracts`. Drift between Rust + Zod
 * is caught statically by the per-schema assertion blocks emitted
 * into each `chronicle/src/schemas/<x>.ts` file.
 *
 * Cross-package gotcha — yarn installs a separate `zod` copy per
 * workspace (because the root pulls in `zod@4` for `@chroniclelabs/ai-sdk`
 * while every consumer pins `~3.23`). The two `ZodType` prototypes are
 * not `instanceof`-compatible, which trips Zod's 2-arg
 * `z.record(keys, values)` overload discriminator and silently makes
 * it default to `{ [k: string]: string }`. Use the 1-arg
 * `z.record(values)` form everywhere — it doesn't take that path.
 *
 * The functions intentionally return `unknown` and let the caller
 * cast to the matching ts-rs type. This avoids a static-vs-runtime
 * mismatch: the JSON Schema (from `schemars`) preserves `null`
 * arms for `Option<T>` while the ts-rs type uses `?: T` (driven by
 * `#[ts(optional)]`). The shapes are *runtime-compatible* — the
 * cast is the assertion that ties them together. Drift between the
 * two is caught by the static-assertion blocks emitted into each
 * `shared/schemas/<x>.ts` file.
 */

import { ProviderError } from "../types";

export interface SafeParser {
  safeParse(raw: unknown):
    | { success: true; data: unknown }
    | { success: false; error: { message: string; issues?: unknown } };
}

export function validate(
  schema: SafeParser,
  raw: unknown,
  context: string,
): unknown {
  if (raw === undefined || raw === null) return raw;
  const result = schema.safeParse(raw);
  if (!result.success) {
    if (typeof console !== "undefined") {
      console.error(
        `[validate] ${context} response failed schema:`,
        result.error.issues,
      );
    }
    throw new ProviderError(
      502,
      `${context} returned a payload that doesn't match the contract: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data;
}

/**
 * Variant for endpoints that can legitimately return either a value
 * or `null` (a "not-found" 200 OK). Skips validation on `null`.
 */
export function validateNullable(
  schema: SafeParser,
  raw: unknown,
  context: string,
): unknown {
  if (raw === null) return null;
  return validate(schema, raw, context);
}
