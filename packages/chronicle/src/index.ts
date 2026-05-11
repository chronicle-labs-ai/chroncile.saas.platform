/*
 * `chronicle` — single source of truth for every wire shape that
 * crosses an HTTP boundary in this monorepo.
 *
 * The package is a thin TypeScript shell over the Rust crates in
 * `backend/crates/domain`. `cargo run -p gen-contracts` regenerates
 * the contents of `./types`, `./json-schema`, and (via
 * `yarn workspace chronicle gen:zod`) `./schemas`. Hand-edit only
 * `./aliases.ts` and `./feature-access.ts`.
 *
 * Sub-paths:
 *
 *   chronicle/types         compile-time TypeScript types from ts-rs
 *   chronicle/schemas       runtime Zod validators from schemars
 *   chronicle/aliases       hand-written nominal aliases (EventId, …)
 *   chronicle/feature-access  feature-flag + entitlement helpers
 */

export * from "./feature-access";
export * from "./aliases";
export * from "./types";
