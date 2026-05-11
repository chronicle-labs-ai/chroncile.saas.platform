/*
 * Seeds — generic shape every per-domain registry follows.
 *
 * A `Seed<TData>` is a *factory*, not raw data. Calling `build()`
 * returns a fresh, mutable copy of the fixture so two consumers
 * (the in-browser `MockStore`, the `seed:chronicle` CLI, a
 * Storybook decorator) never accidentally share references.
 *
 * Every per-domain folder under `packages/seeds/src/` exports:
 *
 *   - a `<Domain>SeedData` shape (the plain-object payload)
 *   - one or more `Seed<<Domain>SeedData>` modules (`default.ts`,
 *     `empty.ts`, `power-user.ts`, …)
 *   - a registry barrel (`index.ts`) that re-exports all seeds plus
 *     a `resolve<Domain>Seed(id)` helper.
 */

export interface Seed<TData> {
  /** Stable id used by env flags + URL overrides. */
  id: string;
  /** Short label for DevTools / docs. */
  label: string;
  /** One-line description shown next to the label. */
  description: string;
  /** Build a fresh mutable copy of the fixture. */
  build(): TData;
}

/**
 * Lookup helper used by every domain registry. Falls back to the
 * `default` seed (which every domain MUST register) and warns when
 * the requested id isn't found.
 */
export function resolveSeed<TData>(
  registry: readonly Seed<TData>[],
  id: string | undefined,
  domain: string,
): Seed<TData> {
  if (id !== undefined) {
    const hit = registry.find((s) => s.id === id);
    if (hit) return hit;
    if (typeof console !== "undefined") {
      console.warn(
        `[seeds] unknown ${domain} seed "${id}", falling back to "default"`,
      );
    }
  }
  const fallback = registry.find((s) => s.id === "default");
  if (!fallback) {
    throw new Error(
      `[seeds] ${domain} registry missing required "default" seed`,
    );
  }
  return fallback;
}
