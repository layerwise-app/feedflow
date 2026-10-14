import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { loadReaderState, saveReaderState } from '~/lib/reader-state.functions';
import {
  createEmptyReaderState,
  createLatestSaveQueue,
  normalizeReaderSnapshot,
  parseReaderSnapshot,
  removeLegacyDemoFeeds,
  removeLegacyDemoStories,
  shouldImportLegacyReaderState,
  validateReaderSnapshot,
  type ReaderSnapshot,
  type ReaderState
} from '~/lib/reader-state-utils';
import type { ReaderAccount } from './reader-context';

// Storage keys predate the Feedflow name; keeping them preserves readers' existing local libraries.
const storageKey = (userId: string) => `stillread:reader:v2:${userId}`;
const LEGACY_KEY = 'stillread:reader:v1';
const MIGRATION_KEY = 'stillread:reader:legacy-owner';
const SAVE_DELAY_MS = 800;

export type ReaderLibrary =
  | { kind: 'signed-out' }
  | { kind: 'ready'; state: ReaderState; persisted: string; cloudFailed: boolean };

function readLocal(key: string): ReaderSnapshot | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    return parseReaderSnapshot(saved);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function withoutLegacyDemo(snapshot: ReaderSnapshot): ReaderSnapshot {
  const stories = removeLegacyDemoStories(snapshot.stories);
  return { ...snapshot, stories, feeds: removeLegacyDemoFeeds(snapshot.feeds, stories) };
}

/** Loads the account library: the cloud copy wins; a local-only library is uploaded once. */
async function loadLibrary(userId: string): Promise<ReaderLibrary> {
  const key = storageKey(userId);
  const migrationOwner = localStorage.getItem(MIGRATION_KEY);
  let local = readLocal(key);
  if (!local && shouldImportLegacyReaderState(userId, migrationOwner)) local = readLocal(LEGACY_KEY);
  const localState = local ? normalizeReaderSnapshot(withoutLegacyDemo(local)) : createEmptyReaderState();

  try {
    const cloud = await loadReaderState({ data: { userId } });
    if (!cloud.authenticated) return { kind: 'signed-out' };
    if (cloud.state) {
      const snapshot = withoutLegacyDemo(parseReaderSnapshot(cloud.state));
      localStorage.setItem(key, JSON.stringify(snapshot));
      if (!migrationOwner) localStorage.setItem(MIGRATION_KEY, userId);
      return { kind: 'ready', state: normalizeReaderSnapshot(snapshot), persisted: cloud.state, cloudFailed: false };
    }
    if (local) {
      const serialized = validateReaderSnapshot(localState);
      const saved = await saveReaderState({ data: { userId, state: serialized } });
      if (!saved.authenticated) return { kind: 'signed-out' };
      localStorage.setItem(key, serialized);
      if (!migrationOwner) localStorage.setItem(MIGRATION_KEY, userId);
      return { kind: 'ready', state: localState, persisted: serialized, cloudFailed: false };
    }
    return { kind: 'ready', state: localState, persisted: '', cloudFailed: false };
  } catch {
    toast.error('Could not load your synced library. Showing the copy on this device.');
    return { kind: 'ready', state: localState, persisted: '', cloudFailed: true };
  }
}

export function useReaderLibrary(userId: string) {
  return useQuery({
    queryKey: ['reader-library', userId],
    queryFn: () => loadLibrary(userId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

/**
 * Persists every change to this device immediately and to the account after a short pause.
 * Saves are serialized so an older snapshot never overwrites a newer one.
 */
export function useReaderSync({ userId, library, onSignedOut, onReload }: {
  userId: string;
  library: Extract<ReaderLibrary, { kind: 'ready' }>;
  onSignedOut: () => void;
  onReload: () => void;
}) {
  const [sync, setSync] = useState<ReaderAccount['sync']>(library.cloudFailed ? 'offline' : 'saved');
  const persistedRef = useRef(library.persisted);
  const latestRef = useRef<string | null>(null);
  const timerRef = useRef(0);
  const queueRef = useRef<((serialized: string) => Promise<void>) | null>(null);

  queueRef.current ??= createLatestSaveQueue(async (serialized: string) => {
    try {
      const result = await saveReaderState({ data: { userId, state: serialized } });
      if (!result.authenticated) {
        onSignedOut();
        return;
      }
      persistedRef.current = serialized;
      if (latestRef.current === serialized) setSync('saved');
    } catch {
      setSync('error');
      toast.error('Sync failed. Your changes are saved on this device.');
    }
  });

  function queueSave() {
    const latest = latestRef.current;
    if (!latest || latest === persistedRef.current) {
      setSync('saved');
      return;
    }
    setSync('saving');
    void queueRef.current!(latest);
  }

  function persist(state: ReaderState) {
    let serialized: string;
    try {
      serialized = validateReaderSnapshot(state);
    } catch (error) {
      setSync('error');
      toast.error(error instanceof Error ? error.message : 'Your library could not be saved.');
      return;
    }
    latestRef.current = serialized;
    try {
      localStorage.setItem(storageKey(userId), serialized);
    } catch {
      // Storage can be full or disabled; the account copy still saves.
    }
    if (library.cloudFailed) return;
    window.clearTimeout(timerRef.current);
    if (serialized === persistedRef.current) {
      setSync('saved');
      return;
    }
    setSync('saving');
    timerRef.current = window.setTimeout(queueSave, SAVE_DELAY_MS);
  }

  return {
    persist,
    sync,
    // An unreachable account reloads the library; a failed save simply tries again.
    retry: library.cloudFailed ? onReload : queueSave
  };
}
