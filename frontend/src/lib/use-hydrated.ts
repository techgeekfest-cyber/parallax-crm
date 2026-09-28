import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while React is hydrating server-rendered HTML, true afterwards (and on every render that isn't a hydration,
 * such as a client-side navigation). Anything the server can't know — like data fetched in the browser — must wait for
 * this, or the first client render can differ from the server's HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
