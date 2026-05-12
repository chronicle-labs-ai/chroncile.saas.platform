/*
 * Shared typed-variant re-exports. Consumers import `VariantProps` from here
 * rather than tailwind-variants directly so we can swap the implementation
 * (or layer on top of it) in one place if we ever need to.
 */

export type { VariantProps } from "tailwind-variants";
export { tv } from "./tv";
