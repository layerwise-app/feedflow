import { useNavigate } from '@tanstack/react-router';
import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';
import {
  addHighlight,
  applyFeedError,
  applyFeedRefresh,
  countNewItems,
  createFolder,
  deleteFolder,
  markStoriesRead,
  moveFeedToFolder,
  removeHighlight,
  renameFeed,
  subscribeToFeed,
  unsubscribeFeed,
  type Feed,
  type FeedFetchResult,
  type Story
} from '~/lib/reader-model';
import type { ReaderLayout, ReaderState, ReadingPreferences, SortOrder } from '~/lib/reader-state-utils';
import { readOpmlFile } from './opml';
import type { FeedFetcher, ReaderMode } from './reader-context';

export type ReaderActions = ReturnType<typeof useReaderActions>;

type Options = {
  mode: ReaderMode;
  stateRef: RefObject<ReaderState>;
  setState: Dispatch<SetStateAction<ReaderState>>;
  fetcher?: FeedFetcher;
};

const REFRESH_BATCH = 5;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Every reader mutation. Network actions require a fetcher, which the demo does not have. */
export function useReaderActions({ mode, stateRef, setState, fetcher }: Options) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState<ReadonlySet<string>>(new Set());
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;

  function needsAccount() {
    toast('Create a free account to add your own feeds.', {
      action: { label: 'Sign up', onClick: () => void navigate({ to: '/sign-up' }) }
    });
  }

  function updateStory(id: number, update: (story: Story) => Story) {
    setState((current) => ({ ...current, stories: current.stories.map((story) => story.id === id ? update(story) : story) }));
  }

  function toggle(id: number, key: 'read' | 'starred' | 'saved' | 'shared') {
    updateStory(id, (story) => ({ ...story, [key]: !story[key] }));
  }

  function setRead(id: number, read: boolean) {
    updateStory(id, (story) => story.read === read ? story : { ...story, read });
  }

  function markRead(ids: number[], olderThan?: number) {
    const idSet = new Set(ids);
    const before = new Set(stateRef.current.stories.filter((story) => !story.read).map((story) => story.id));
    const { stories, changed } = markStoriesRead(stateRef.current.stories, idSet, olderThan);
    if (!changed) {
      toast('Nothing to mark as read.');
      return;
    }
    const marked = new Set(stories.filter((story) => story.read && before.has(story.id)).map((story) => story.id));
    setState((current) => ({ ...current, stories: markStoriesRead(current.stories, idSet, olderThan).stories }));
    toast(`Marked ${plural(changed, 'story', 'stories')} as read.`, {
      action: {
        label: 'Undo',
        onClick: () => setState((current) => ({
          ...current,
          stories: current.stories.map((story) => marked.has(story.id) ? { ...story, read: false } : story)
        }))
      }
    });
  }

  async function fetchAll(feeds: Feed[]) {
    const outcomes: Array<{ feed: Feed; result?: FeedFetchResult; error?: string }> = [];
    for (let index = 0; index < feeds.length; index += REFRESH_BATCH) {
      outcomes.push(...await Promise.all(feeds.slice(index, index + REFRESH_BATCH).map(async (feed) => {
        try {
          return { feed, result: await fetcher!({ url: feed.url, etag: feed.etag, lastModified: feed.lastModified }) };
        } catch (error) {
          return { feed, error: errorMessage(error, 'Could not reach this feed.') };
        }
      })));
    }
    return outcomes;
  }

  async function refreshFeeds(urls?: string[], options: { quiet?: boolean } = {}) {
    if (!fetcher) return needsAccount();
    const targets = stateRef.current.feeds.filter((feed) => (!urls || urls.includes(feed.url)) && !refreshingRef.current.has(feed.url));
    if (!targets.length) return;
    const targetUrls = targets.map((feed) => feed.url);
    setRefreshing((current) => new Set([...current, ...targetUrls]));
    try {
      const outcomes = await fetchAll(targets);
      const fetchedAt = Date.now();
      const added = outcomes.reduce((sum, outcome) => sum + (outcome.result ? countNewItems(stateRef.current.stories, outcome.result) : 0), 0);
      setState((current) => outcomes.reduce((next, outcome) => {
        // Look feeds up by URL: the reader may have renamed one while the request was in flight.
        const feed = next.feeds.find((candidate) => candidate.url === outcome.feed.url);
        if (!feed) return next;
        return outcome.result
          ? applyFeedRefresh(next, feed.name, outcome.result, fetchedAt).state
          : applyFeedError(next, feed.name, outcome.error ?? 'Could not reach this feed.', fetchedAt);
      }, current));
      const failed = outcomes.filter((outcome) => outcome.error);
      if (options.quiet) return;
      if (failed.length) {
        toast.error(failed.length === 1 ? `${failed[0].feed.name}: ${failed[0].error}` : `${plural(failed.length, 'feed')} could not be refreshed.`);
      } else {
        toast(added ? `${plural(added, 'new story', 'new stories')}.` : 'You’re up to date.');
      }
    } finally {
      setRefreshing((current) => new Set([...current].filter((url) => !targetUrls.includes(url))));
    }
  }

  /** Resolves with the subscribed feed's name; rejects with a readable message. */
  async function subscribe(url: string, options: { folder?: string; name?: string } = {}) {
    if (!fetcher) {
      needsAccount();
      return null;
    }
    const result = await fetcher({ url: url.trim() });
    const fetchedAt = Date.now();
    const preview = subscribeToFeed(stateRef.current, result, fetchedAt, options.folder, options.name);
    setState((current) => subscribeToFeed(current, result, fetchedAt, options.folder, options.name).state);
    toast(preview.existing ? `${preview.name} is already in your library.` : `Subscribed to ${preview.name}.`);
    return preview.name;
  }

  async function importOpml(file: File) {
    if (!fetcher) {
      needsAccount();
      return null;
    }
    const candidates = await readOpmlFile(file);
    const outcomes = await fetchAll(candidates.map((candidate) => ({ name: candidate.name, url: candidate.url })));
    const fetchedAt = Date.now();
    const failed = outcomes.filter((outcome) => !outcome.result?.parsed).map((outcome) => outcome.feed.name);
    const subscribeAll = (current: ReaderState) => outcomes.reduce((next, outcome, index) => outcome.result?.parsed
      // OPML titles are the reader's own names for feeds; keep them unless the file only had URLs.
      ? subscribeToFeed(next, outcome.result, fetchedAt, candidates[index].folder, candidates[index].name === candidates[index].url ? '' : candidates[index].name).state
      : next, current);
    const known = new Set(stateRef.current.feeds.map((feed) => feed.url));
    const imported = subscribeAll(stateRef.current).feeds.filter((feed) => !known.has(feed.url)).length;
    setState(subscribeAll);
    if (failed.length) toast.error(`Imported ${plural(imported, 'feed')}. Could not load ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}.`);
    else toast(`Imported ${plural(imported, 'feed')}.`);
    return { imported, failed };
  }

  function rename(from: string, to: string) {
    setState(renameFeed(stateRef.current, from, to));
  }

  function moveFeed(feedName: string, folder: string) {
    setState((current) => moveFeedToFolder(current, feedName, folder));
  }

  function unsubscribe(feedName: string) {
    const before = stateRef.current;
    const feed = before.feeds.find((candidate) => candidate.name === feedName);
    if (!feed) return;
    const removedStories = before.stories.filter((story) => story.source === feedName);
    const folder = before.feedFolders[feedName];
    setState((current) => unsubscribeFeed(current, feedName));
    toast(`Unsubscribed from ${feedName}.`, {
      action: {
        label: 'Undo',
        onClick: () => setState((current) => {
          if (current.feeds.some((candidate) => candidate.name === feedName)) return current;
          const kept = new Set(current.stories.map((story) => story.id));
          return {
            ...current,
            feeds: [...current.feeds, feed],
            stories: [...current.stories, ...removedStories.filter((story) => !kept.has(story.id))],
            feedFolders: folder ? { ...current.feedFolders, [feedName]: folder } : current.feedFolders
          };
        })
      }
    });
  }

  return {
    refreshing,
    toggle,
    setRead,
    markRead,
    refreshFeeds,
    subscribe,
    importOpml,
    rename,
    moveFeed,
    unsubscribe,
    needsAccount,
    reportError: (error: unknown, fallback: string) => void toast.error(errorMessage(error, fallback)),
    canFetch: mode === 'account' && Boolean(fetcher),
    addFolder: (name: string) => setState((current) => createFolder(current, name)),
    removeFolder: (name: string) => setState((current) => deleteFolder(current, name)),
    setNote: (id: number, note: string) => updateStory(id, (story) => {
      const { note: _previous, ...rest } = story;
      return note.trim() ? { ...rest, note: note.slice(0, 10_000) } : rest;
    }),
    addHighlight: (id: number, text: string) => updateStory(id, (story) => addHighlight(story, text)),
    removeHighlight: (id: number, text: string) => updateStory(id, (story) => removeHighlight(story, text)),
    setLayout: (layout: ReaderLayout) => setState((current) => ({ ...current, layout })),
    setReading: (reading: Partial<ReadingPreferences>) => setState((current) => ({ ...current, reading: { ...current.reading, ...reading } })),
    setSortOrder: (sortOrder: SortOrder) => setState((current) => ({ ...current, sortOrder })),
    setCompact: (compact: boolean) => setState((current) => ({ ...current, compact })),
    setAutoMarkRead: (autoMarkRead: boolean) => setState((current) => ({ ...current, autoMarkRead })),
    setAutoRefresh: (autoRefreshMinutes: number) => setState((current) => ({ ...current, autoRefreshMinutes }))
  };
}
