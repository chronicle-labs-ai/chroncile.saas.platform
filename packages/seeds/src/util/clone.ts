/*
 * Defensive clone helpers used by every seed's `build()` so the
 * `mock` impl can mutate state freely without poisoning the next
 * boot.
 *
 * `structuredClone` is available in every runtime we target (Node
 * >= 17, evergreen browsers, jsdom 22+) so we use it directly.
 * The wrappers exist mostly to give call sites a tighter,
 * domain-named API.
 */

export function cloneArray<T>(source: readonly T[]): T[] {
  return structuredClone(source) as T[];
}

export function cloneRecord<V>(
  source: Readonly<Record<string, V>>,
): Record<string, V> {
  return structuredClone(source);
}

export function cloneValue<T>(source: T): T {
  return structuredClone(source);
}
