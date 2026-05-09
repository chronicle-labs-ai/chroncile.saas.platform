/*
 * Dev-mode seed validation.
 *
 * Each per-domain `default` seed feeds its `build()` output through
 * `validateInDev(schema, data, label)` to catch fixture drift before
 * a Storybook screenshot run, a `seed:chronicle` POST, or the mock
 * provider serving stale shapes.
 *
 * Production builds skip the check — `process.env.NODE_ENV` is
 * inlined by Next.js / Vite at build time, so the conditional dies
 * with the build. The first invocation per (domain, scenario) caches
 * the result so we don't repeatedly parse the same fixture every time
 * `build()` is called.
 */

import type { z } from "zod";

const VALIDATED = new Set<string>();

export function validateInDev<T>(
  schema: z.ZodType<T>,
  value: T,
  label: string,
): T {
  if (process.env.NODE_ENV === "production") return value;
  if (VALIDATED.has(label)) return value;
  const result = schema.safeParse(value);
  VALIDATED.add(label);
  if (!result.success) {
    /* Print up to 10 issues with their full path + message. The
       paths point straight at the offending fixture key — much
       easier than parsing `[{...},{...}]` output. */
    const summary = result.error.issues
      .slice(0, 10)
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");
    const more =
      result.error.issues.length > 10
        ? `\n  … +${result.error.issues.length - 10} more`
        : "";
    if (typeof console !== "undefined") {
      console.error(
        `[seeds] ${label} fixture failed schema validation (${result.error.issues.length} issue(s)):\n${summary}${more}`,
      );
    }
    /* Throw rather than warn so missing-field bugs surface during
       `yarn dev` instead of as silent runtime mismatches. */
    throw new Error(
      `[seeds] ${label} fixture diverges from the canonical schema. ` +
        `Run \`yarn gen:contracts\` and update the fixture.\n${summary}${more}`,
    );
  }
  return value;
}
