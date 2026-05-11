/*
 * Generic in-memory store the per-domain `mock` impls layer over.
 *
 * Two responsibilities:
 *
 *   1. Hold a mutable `state` object (typically `Map`s of entities)
 *      that the mock impl reads/writes during its async methods.
 *   2. Fan out `event`s to subscribers. The provider's `subscribe()`
 *      forwards them to consumers; the `subscribe-bridge` then turns
 *      them into `queryClient.setQueryData(...)` calls so React
 *      consumers re-render automatically.
 *
 * Generic over both `S` (the state shape) and `E` (the event shape)
 * so each domain gets a tightly typed store; the domain decides
 * which mutations broadcast which events.
 *
 * `replace(seedFactory)` lets the DevTools widget swap to a different
 * `Seed` at runtime without re-mounting the React tree.
 */

import type { Subscription } from "../types";

export class MockStore<S, E> {
  state: S;
  private listeners = new Set<(event: E) => void>();
  private factory: () => S;

  constructor(factory: () => S) {
    this.factory = factory;
    this.state = factory();
  }

  /** Apply an in-place mutation to the state. The caller is expected
   *  to call `emit()` afterwards if subscribers need to know. */
  mutate(fn: (state: S) => void): void {
    fn(this.state);
  }

  /** Broadcast an event to every active subscriber. Listeners run
   *  synchronously and in registration order — any throw is
   *  swallowed and reported via `console.error` so a single bad
   *  consumer can't take down the rest. */
  emit(event: E): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        if (typeof console !== "undefined") {
          console.error("[mock-store] listener threw", err);
        }
      }
    }
  }

  subscribe(listener: (event: E) => void): Subscription {
    this.listeners.add(listener);
    let active = true;
    return {
      unsubscribe: () => {
        if (!active) return;
        active = false;
        this.listeners.delete(listener);
      },
    };
  }

  /** Replace the underlying state with a freshly built seed. Used
   *  by `mockProvider.reset(seedId)` to switch scenarios at runtime.
   *  Listeners are NOT torn down so consumers keep their handles. */
  replace(factory: () => S): void {
    this.factory = factory;
    this.state = factory();
  }

  /** Convenience for tests: reset back to the seed used at
   *  construction time. */
  reset(): void {
    this.state = this.factory();
  }
}
