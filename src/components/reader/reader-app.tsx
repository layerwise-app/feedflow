import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '~/components/ui/sheet';
import { ALL_ITEMS, countStories, isSameScope, scopeExists, selectStories, type ReaderScope, type ReaderView } from '~/lib/reader-model';
import { READER_LAYOUTS, type ReaderState } from '~/lib/reader-state-utils';
import { cn } from '~/lib/utils';
import { useDisplayTimeZone } from '~/components/use-display-time-zone';
import { AddFeedDialog } from './add-feed-dialog';
import { DiscoverDialog } from './discover-dialog';
import { ManageFeedsDialog } from './manage-feeds-dialog';
import { ReaderContext, type FeedFetcher, type ReaderAccount, type ReaderContextValue, type ReaderDialog, type ReaderMode } from './reader-context';
import { ReaderSidebar } from './reader-sidebar';
import { ReadingPane } from './reading-pane';
import { ShortcutsDialog } from './shortcuts-dialog';
import { StoryList } from './story-list';
import { StoryToolbar } from './story-toolbar';
import { useReaderActions } from './use-reader-actions';
import { useReaderShortcuts } from './use-reader-shortcuts';

export type ReaderAppProps = {
  mode: ReaderMode;
  initialState: ReaderState;
  /** Server-provided clock so relative dates match between server and client renders. */
  initialNow: number;
  fetcher?: FeedFetcher;
  onStateChange?: (state: ReaderState) => void;
  account?: ReaderAccount;
};

const VIEW_TITLES: Record<ReaderView, string> = {
  all: 'All items',
  starred: 'Starred',
  later: 'Read later',
  notes: 'Notes',
  shared: 'Shared',
  read: 'Recently read'
};
const STALE_FEED_MS = 15 * 60_000;

function scopeTitle(scope: ReaderScope, query: string) {
  if (query.trim()) return 'Search';
  if (scope.type === 'view') return VIEW_TITLES[scope.view];
  return scope.type === 'feed' ? scope.feed : scope.folder;
}

export function ReaderApp({ mode, initialState, initialNow, fetcher, onStateChange, account }: ReaderAppProps) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const actions = useReaderActions({ mode, stateRef, setState, fetcher });
  const [now, setNow] = useState(initialNow);
  const timeZone = useDisplayTimeZone();
  const [scopeState, setScopeState] = useState<ReaderScope>(ALL_ITEMS);
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  // Stories read during this visit stay listed under "Unread" so the list does not shift.
  const [keepVisible, setKeepVisible] = useState<ReadonlySet<number>>(new Set());
  const [dialog, setDialog] = useState<ReaderDialog>(null);
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Unsubscribing from the open feed or deleting the open folder falls back to All items.
  const scope = scopeExists(scopeState, state) ? scopeState : ALL_ITEMS;
  const stories = selectStories(state.stories, {
    scope,
    query,
    unreadOnly,
    sortOrder: state.sortOrder,
    feedFolders: state.feedFolders,
    keepVisible
  });
  const counts = countStories(state.stories, state.feedFolders);
  const currentId = openId ?? selectedId;
  const current = state.stories.find((story) => story.id === currentId) ?? null;

  const persistRef = useRef(onStateChange);
  persistRef.current = onStateChange;
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    persistRef.current?.(state);
  }, [state]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    setNow(Date.now());
    return () => window.clearInterval(timer);
  }, []);

  const refreshRef = useRef(actions.refreshFeeds);
  refreshRef.current = actions.refreshFeeds;
  useEffect(() => {
    if (!actions.canFetch) return;
    // Catch up on feeds that have not been fetched recently when the reader opens.
    const stale = stateRef.current.feeds.filter((feed) => !feed.lastFetchedAt || Date.now() - feed.lastFetchedAt > STALE_FEED_MS);
    if (stale.length) void refreshRef.current(stale.map((feed) => feed.url), { quiet: true });
  }, [actions.canFetch]);

  useEffect(() => {
    if (!actions.canFetch || !state.autoRefreshMinutes) return;
    const timer = window.setInterval(() => void refreshRef.current(undefined, { quiet: true }), state.autoRefreshMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [actions.canFetch, state.autoRefreshMinutes]);

  function setScope(next: ReaderScope) {
    if (!isSameScope(scope, next) || query) {
      setScopeState(next);
      setQuery('');
      setSelectedId(null);
      setOpenId(null);
      setKeepVisible(new Set());
    }
    setNavOpen(false);
  }

  function markOpened(id: number) {
    const story = stateRef.current.stories.find((candidate) => candidate.id === id);
    if (!story || story.read) return;
    actions.setRead(id, true);
    setKeepVisible((visible) => new Set(visible).add(id));
  }

  function selectStory(id: number, options: { open?: boolean } = {}) {
    setSelectedId(id);
    if (options.open) {
      setOpenId(id);
      markOpened(id);
    }
  }

  function markSeen(ids: number[]) {
    const unseen = ids.filter((id) => stateRef.current.stories.some((story) => story.id === id && !story.read));
    if (!unseen.length) return;
    setKeepVisible((visible) => new Set([...visible, ...unseen]));
    unseen.forEach((id) => actions.setRead(id, true));
  }

  function move(direction: 1 | -1, open: boolean) {
    if (!stories.length) return;
    const index = stories.findIndex((story) => story.id === (selectedId ?? openId));
    const nextIndex = index < 0 ? (direction > 0 ? 0 : stories.length - 1) : Math.max(0, Math.min(stories.length - 1, index + direction));
    selectStory(stories[nextIndex].id, { open });
  }

  function highlightSelection() {
    const selection = window.getSelection();
    const text = selection?.toString() ?? '';
    const body = document.querySelector('[data-reading-body]');
    if (!current || !text.trim() || !body || !selection?.anchorNode || !body.contains(selection.anchorNode)) return false;
    actions.addHighlight(current.id, text);
    selection.removeAllRanges();
    return true;
  }

  useReaderShortcuts({
    move,
    toggleOpen: () => {
      if (openId !== null && openId === selectedId) setOpenId(null);
      else if (selectedId !== null) selectStory(selectedId, { open: true });
      else move(1, true);
    },
    close: () => setOpenId(null),
    star: () => current && actions.toggle(current.id, 'starred'),
    later: () => current && actions.toggle(current.id, 'saved'),
    share: () => current && actions.toggle(current.id, 'shared'),
    toggleRead: () => {
      if (!current) return;
      actions.setRead(current.id, !current.read);
      setKeepVisible((visible) => new Set(visible).add(current.id));
    },
    openOriginal: () => current && window.open(current.url, '_blank', 'noopener,noreferrer'),
    markAllRead: () => actions.markRead(stories.map((story) => story.id)),
    focusSearch: () => searchRef.current?.focus(),
    goTo: (target) => target === 'discover' ? setDialog('discover') : setScope({ type: 'view', view: target }),
    refresh: () => void actions.refreshFeeds(),
    addFeed: () => setDialog('add'),
    setLayout: (index) => actions.setLayout(READER_LAYOUTS[index]),
    highlight: highlightSelection,
    showHelp: () => setDialog('shortcuts')
  }, dialog === null && !navOpen);

  const readerActions = {
    ...actions,
    rename: (from: string, to: string) => {
      actions.rename(from, to);
      // The scope names the feed, so it follows the rename.
      if (scope.type === 'feed' && scope.feed === from) setScopeState({ type: 'feed', feed: to.trim() });
    }
  };

  const value: ReaderContextValue = {
    mode,
    state,
    now,
    timeZone,
    counts,
    stories,
    scope,
    scopeTitle: scopeTitle(scope, query),
    setScope,
    query,
    setQuery: (next) => {
      setQuery(next);
      setSelectedId(null);
      setOpenId(null);
    },
    unreadOnly,
    setUnreadOnly: (next) => {
      setUnreadOnly(next);
      setKeepVisible(new Set());
    },
    selectedId,
    openId,
    selectStory,
    closeStory: () => setOpenId(null),
    dialog,
    setDialog,
    navOpen,
    setNavOpen,
    actions: readerActions,
    account,
    searchRef
  };

  const docked = state.layout === 'list';

  return (
    <ReaderContext.Provider value={value}>
      <div className='flex h-dvh overflow-hidden bg-background text-foreground'>
        <aside className='hidden w-[264px] shrink-0 border-r border-border bg-sidebar lg:flex'>
          <ReaderSidebar />
        </aside>
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side='left' showCloseButton={false} className='w-[288px] max-w-[85vw] gap-0 bg-sidebar p-0'>
            <SheetTitle className='sr-only'>Feeds and folders</SheetTitle>
            <ReaderSidebar />
          </SheetContent>
        </Sheet>
        <main className='flex min-w-0 flex-1'>
          <section className={cn('flex min-w-0 flex-1 flex-col', docked && 'xl:w-[420px] xl:flex-none xl:border-r xl:border-border 2xl:w-[460px]')}>
            <StoryToolbar />
            <StoryList onSeen={markSeen} />
          </section>
          <ReadingPane story={openId === null ? null : current} docked={docked} />
        </main>
      </div>
      <AddFeedDialog />
      <DiscoverDialog />
      <ManageFeedsDialog />
      <ShortcutsDialog />
    </ReaderContext.Provider>
  );
}
