import { createContext, useContext, type RefObject } from 'react';
import type { FeedFetchResult, ReaderCounts, ReaderScope, Story } from '~/lib/reader-model';
import type { ReaderState } from '~/lib/reader-state-utils';
import type { ReaderActions } from './use-reader-actions';

export type ReaderMode = 'account' | 'demo';
export type ReaderDialog = 'add' | 'discover' | 'manage' | 'shortcuts' | null;
export type FeedFetcher = (input: { url: string; etag?: string; lastModified?: string }) => Promise<FeedFetchResult>;

export type ReaderAccount = {
  email: string;
  name?: string;
  sync: 'saved' | 'saving' | 'error' | 'offline';
  onRetrySync: () => void;
  onSignOut: () => void;
};

export type ReaderContextValue = {
  mode: ReaderMode;
  state: ReaderState;
  now: number;
  /** Time zone for absolute dates; UTC until hydration finishes. */
  timeZone: string | undefined;
  counts: ReaderCounts;
  stories: Story[];
  scope: ReaderScope;
  scopeTitle: string;
  setScope: (scope: ReaderScope) => void;
  query: string;
  setQuery: (query: string) => void;
  unreadOnly: boolean;
  setUnreadOnly: (unreadOnly: boolean) => void;
  selectedId: number | null;
  openId: number | null;
  selectStory: (id: number, options?: { open?: boolean }) => void;
  closeStory: () => void;
  dialog: ReaderDialog;
  setDialog: (dialog: ReaderDialog) => void;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  actions: ReaderActions;
  account?: ReaderAccount;
  searchRef: RefObject<HTMLInputElement | null>;
};

export const ReaderContext = createContext<ReaderContextValue | null>(null);

export function useReader() {
  const value = useContext(ReaderContext);
  if (!value) throw new Error('useReader must be used inside ReaderApp.');
  return value;
}
