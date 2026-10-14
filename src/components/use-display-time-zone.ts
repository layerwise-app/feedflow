import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * 'UTC' while rendering on the server and hydrating, then undefined (the viewer's own zone).
 * Absolute dates formatted with it match between the two renders and then switch to local time.
 */
export function useDisplayTimeZone(): string | undefined {
  return useSyncExternalStore<string | undefined>(subscribe, () => undefined, () => 'UTC');
}
