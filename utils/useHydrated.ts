import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// false while prerendering and hydrating, true afterwards.
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
