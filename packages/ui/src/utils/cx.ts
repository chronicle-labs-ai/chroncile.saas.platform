export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[];

/**
 * Minimal class-name concatenator. Fine-grained merge is a non-goal —
 * the primitives own their base classes and callers pass overrides via
 * `className`, which come last so they win on equal specificity.
 *
 * @deprecated Use `cn` from `./cn` (the shadcn-canonical helper that
 * pipes through `tailwind-merge`). `cx` is retained for the dozens of
 * existing call sites that don't need precise utility merging; new code
 * should reach for `cn` to match the rest of the design system.
 */
export function cx(...args: ClassValue[]): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (Array.isArray(a)) {
      const nested = cx(...a);
      if (nested) out.push(nested);
    } else {
      out.push(String(a));
    }
  }
  return out.join(" ");
}
