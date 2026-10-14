import { mergeFeedStories } from './feed-story-merge.ts';
import type { ParsedFeed } from './feed-utils.ts';
import { MAX_HIGHLIGHT_LENGTH, MAX_HIGHLIGHTS } from './reader-state-utils.ts';
import type { ReaderSnapshotFeed, ReaderSnapshotStory, ReaderState, SortOrder } from './reader-state-utils.ts';

export type Story = ReaderSnapshotStory;
export type Feed = ReaderSnapshotFeed;
export type ReaderView = 'all' | 'starred' | 'later' | 'notes' | 'shared' | 'read';
export type ReaderScope =
  | { type: 'view'; view: ReaderView }
  | { type: 'feed'; feed: string }
  | { type: 'folder'; folder: string };

/** The shape returned by the `fetchFeed` server function. */
export type FeedFetchResult = {
  parsed: ParsedFeed | null;
  feedUrl: string;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
};

export type ReaderCounts = {
  views: Record<ReaderView, number>;
  feeds: Record<string, number>;
  folders: Record<string, number>;
};

export const ALL_ITEMS: ReaderScope = { type: 'view', view: 'all' };
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
const MAX_FOLDER_NAME = 80;
const MAX_FEED_NAME = 160;

export function hasAnnotation(story: Story) {
  return Boolean(story.note?.trim()) || Boolean(story.highlights?.length);
}

/** A feed or folder scope stays valid only while that feed or folder exists. */
export function scopeExists(scope: ReaderScope, state: Pick<ReaderState, 'feeds' | 'folders' | 'feedFolders'>) {
  if (scope.type === 'feed') return state.feeds.some((feed) => feed.name === scope.feed);
  if (scope.type === 'folder') return state.folders.includes(scope.folder) || Object.values(state.feedFolders).includes(scope.folder);
  return true;
}

export function isSameScope(left: ReaderScope, right: ReaderScope) {
  if (left.type !== right.type) return false;
  if (left.type === 'view' && right.type === 'view') return left.view === right.view;
  if (left.type === 'feed' && right.type === 'feed') return left.feed === right.feed;
  return left.type === 'folder' && right.type === 'folder' && left.folder === right.folder;
}

export function storyInScope(story: Story, scope: ReaderScope, feedFolders: Record<string, string>) {
  if (scope.type === 'feed') return story.source === scope.feed;
  if (scope.type === 'folder') return feedFolders[story.source] === scope.folder;
  switch (scope.view) {
    case 'starred': return story.starred;
    case 'later': return story.saved;
    case 'notes': return hasAnnotation(story);
    case 'shared': return story.shared;
    case 'read': return story.read;
    default: return true;
  }
}

/** "Unread only" is meaningful for feeds, folders, and All items; collections show everything. */
export function scopeSupportsUnreadFilter(scope: ReaderScope) {
  return scope.type !== 'view' || scope.view === 'all';
}

function searchableText(story: Story) {
  return `${story.title} ${story.source} ${story.excerpt} ${story.body ?? ''} ${story.note ?? ''} ${(story.highlights ?? []).join(' ')}`.toLowerCase();
}

function sortByDate(stories: Story[], order: 'newest' | 'oldest') {
  const ordered = stories
    .map((story, index) => ({ story, index }))
    .sort((left, right) => {
      const leftDate = left.story.publishedAt;
      const rightDate = right.story.publishedAt;
      if (leftDate != null && rightDate != null && leftDate !== rightDate) return rightDate - leftDate;
      if (leftDate != null && rightDate == null) return -1;
      if (rightDate != null && leftDate == null) return 1;
      return left.index - right.index;
    })
    .map(({ story }) => story);
  return order === 'oldest' ? ordered.reverse() : ordered;
}

export type StorySelection = {
  scope: ReaderScope;
  query: string;
  unreadOnly: boolean;
  sortOrder: SortOrder;
  feedFolders: Record<string, string>;
  /** Stories read during this session stay listed so the list does not jump under the reader. */
  keepVisible?: ReadonlySet<number>;
};

export function selectStories(stories: Story[], selection: StorySelection) {
  const query = selection.query.trim().toLowerCase();
  const hideRead = !query && selection.unreadOnly && scopeSupportsUnreadFilter(selection.scope);
  const filtered = stories.filter((story) => {
    if (query) return searchableText(story).includes(query);
    if (!storyInScope(story, selection.scope, selection.feedFolders)) return false;
    return !hideRead || !story.read || Boolean(selection.keepVisible?.has(story.id));
  });

  if (query && selection.sortOrder === 'relevance') {
    const score = (story: Story) => (story.title.toLowerCase().includes(query) ? 8 : 0)
      + (story.source.toLowerCase().includes(query) ? 5 : 0)
      + (story.excerpt.toLowerCase().includes(query) ? 3 : 0)
      + ((story.note ?? '').toLowerCase().includes(query) ? 2 : 0)
      + ((story.body ?? '').toLowerCase().includes(query) ? 1 : 0);
    return sortByDate(filtered, 'newest').sort((left, right) => score(right) - score(left));
  }
  return sortByDate(filtered, selection.sortOrder === 'oldest' ? 'oldest' : 'newest');
}

export function countStories(stories: Story[], feedFolders: Record<string, string>): ReaderCounts {
  const counts: ReaderCounts = {
    views: { all: 0, starred: 0, later: 0, notes: 0, shared: 0, read: 0 },
    feeds: {},
    folders: {}
  };
  for (const story of stories) {
    if (story.starred) counts.views.starred += 1;
    if (story.saved) counts.views.later += 1;
    if (story.shared) counts.views.shared += 1;
    if (hasAnnotation(story)) counts.views.notes += 1;
    if (story.read) {
      counts.views.read += 1;
      continue;
    }
    counts.views.all += 1;
    counts.feeds[story.source] = (counts.feeds[story.source] ?? 0) + 1;
    const folder = feedFolders[story.source];
    if (folder) counts.folders[folder] = (counts.folders[folder] ?? 0) + 1;
  }
  return counts;
}

/**
 * Marks the given stories read. With `olderThan`, only stories published before that
 * timestamp change; undated stories are left alone because their age is unknown.
 */
export function markStoriesRead(stories: Story[], ids: ReadonlySet<number>, olderThan?: number) {
  let changed = 0;
  const next = stories.map((story) => {
    if (story.read || !ids.has(story.id)) return story;
    if (olderThan !== undefined && (story.publishedAt === undefined || story.publishedAt >= olderThan)) return story;
    changed += 1;
    return { ...story, read: true };
  });
  return { stories: changed ? next : stories, changed };
}

export function uniqueFeedName(feeds: Feed[], title: string, url: string) {
  const base = title.trim().slice(0, MAX_FEED_NAME - 4) || new URL(url).hostname.replace(/^www\./, '');
  const taken = (name: string) => feeds.some((feed) => feed.name === name && feed.url !== url);
  if (!taken(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} (${suffix})`;
    if (!taken(candidate)) return candidate;
  }
}

function renameReferences(state: ReaderState, from: string, to: string): ReaderState {
  const feedFolders = { ...state.feedFolders };
  if (from in feedFolders) {
    feedFolders[to] = feedFolders[from];
    delete feedFolders[from];
  }
  return {
    ...state,
    feeds: state.feeds.map((feed) => feed.name === from ? { ...feed, name: to } : feed),
    stories: state.stories.map((story) => story.source === from
      ? { ...story, source: to, initials: to.slice(0, 1).toUpperCase() }
      : story),
    feedFolders
  };
}

function withoutError(feed: Feed): Feed {
  const { error: _error, ...rest } = feed;
  return rest;
}

/** Applies a successful fetch to an existing subscription, keeping read/star/note state. */
export function applyFeedRefresh(state: ReaderState, feedName: string, result: FeedFetchResult, now: number) {
  const feed = state.feeds.find((candidate) => candidate.name === feedName);
  if (!feed) return { state, name: feedName, added: 0 };

  let name = feed.name;
  const incomingTitle = result.parsed?.title.trim();
  if (incomingTitle && !feed.renamed && incomingTitle !== feed.name
    && !state.feeds.some((candidate) => candidate.name === incomingTitle)) {
    name = incomingTitle.slice(0, MAX_FEED_NAME);
  }

  let next = name === feed.name ? state : renameReferences(state, feed.name, name);
  next = {
    ...next,
    feeds: next.feeds.map((candidate) => candidate.name === name
      ? {
          ...withoutError(candidate),
          url: result.feedUrl,
          etag: result.etag ?? candidate.etag,
          lastModified: result.lastModified ?? candidate.lastModified,
          lastFetchedAt: now
        }
      : candidate)
  };
  if (!result.parsed) return { state: next, name, added: 0 };

  const merged = mergeFeedStories(next.stories, { ...result.parsed, title: name });
  return { state: { ...next, stories: merged.stories }, name, added: merged.added };
}

/** Counts fetched items the library does not have yet, using the same identity as mergeFeedStories. */
export function countNewItems(stories: Story[], result: FeedFetchResult) {
  if (!result.parsed) return 0;
  const known = new Set(stories.map((story) => `${story.feedUrl ?? story.source}\u001f${story.feedItemId ?? story.url}`));
  return result.parsed.items.filter((item) => !known.has(`${result.parsed!.feedUrl}\u001f${item.id}`)).length;
}

export function applyFeedError(state: ReaderState, feedName: string, message: string, now: number): ReaderState {
  return {
    ...state,
    feeds: state.feeds.map((feed) => feed.name === feedName
      ? { ...feed, error: message.slice(0, 300), lastFetchedAt: now }
      : feed)
  };
}

/**
 * Adds a subscription from a fetch result. `preferredName` (a curated or OPML title) wins over
 * the feed's own title and is kept on later refreshes.
 */
export function subscribeToFeed(state: ReaderState, result: FeedFetchResult, now: number, folder = '', preferredName = '') {
  if (!result.parsed) throw new Error('That feed returned no stories. Try again in a moment.');
  const existing = state.feeds.find((feed) => feed.url === result.feedUrl);
  if (existing) return { ...applyFeedRefresh(state, existing.name, result, now), existing: true };

  const preferred = preferredName.trim();
  const name = uniqueFeedName(state.feeds, preferred || result.parsed.title, result.feedUrl);
  const merged = mergeFeedStories(state.stories, { ...result.parsed, title: name });
  const feed: Feed = { name, url: result.feedUrl, etag: result.etag, lastModified: result.lastModified, lastFetchedAt: now };
  let next: ReaderState = {
    ...state,
    feeds: [...state.feeds, preferred ? { ...feed, renamed: true } : feed],
    stories: merged.stories
  };
  if (folder) next = moveFeedToFolder(next, name, folder);
  return { state: next, name, added: merged.added, existing: false };
}

export function renameFeed(state: ReaderState, from: string, to: string): ReaderState {
  const name = to.trim();
  if (!name) throw new Error('Enter a name.');
  if (name.length > MAX_FEED_NAME) throw new Error('Use a shorter name.');
  if (name === from) return state;
  if (state.feeds.some((feed) => feed.name === name)) throw new Error('Another feed already uses that name.');
  const next = renameReferences(state, from, name);
  return { ...next, feeds: next.feeds.map((feed) => feed.name === name ? { ...feed, renamed: true } : feed) };
}

export function createFolder(state: ReaderState, rawName: string): ReaderState {
  const name = rawName.trim().slice(0, MAX_FOLDER_NAME);
  if (!name || state.folders.includes(name)) return state;
  return { ...state, folders: [...state.folders, name] };
}

export function moveFeedToFolder(state: ReaderState, feedName: string, folder: string): ReaderState {
  const feedFolders = { ...state.feedFolders };
  if (folder) feedFolders[feedName] = folder;
  else delete feedFolders[feedName];
  const withFolder = folder ? createFolder(state, folder) : state;
  return { ...withFolder, feedFolders };
}

export function deleteFolder(state: ReaderState, folder: string): ReaderState {
  return {
    ...state,
    folders: state.folders.filter((candidate) => candidate !== folder),
    feedFolders: Object.fromEntries(Object.entries(state.feedFolders).filter(([, assigned]) => assigned !== folder))
  };
}

/** Removes a subscription. Starred, saved, and annotated stories are kept. */
export function unsubscribeFeed(state: ReaderState, feedName: string): ReaderState {
  const feedFolders = { ...state.feedFolders };
  delete feedFolders[feedName];
  return {
    ...state,
    feeds: state.feeds.filter((feed) => feed.name !== feedName),
    stories: state.stories.filter((story) => story.source !== feedName || story.starred || story.saved || hasAnnotation(story)),
    feedFolders
  };
}

export function normalizeHighlight(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function addHighlight(story: Story, text: string): Story {
  const highlight = normalizeHighlight(text);
  const current = story.highlights ?? [];
  if (highlight.length < 2 || highlight.length > MAX_HIGHLIGHT_LENGTH) return story;
  if (current.includes(highlight) || current.length >= MAX_HIGHLIGHTS) return story;
  return { ...story, highlights: [...current, highlight] };
}

export function removeHighlight(story: Story, text: string): Story {
  const highlights = (story.highlights ?? []).filter((highlight) => highlight !== text);
  if (highlights.length) return { ...story, highlights };
  const { highlights: _removed, ...rest } = story;
  return rest;
}

/** Splits a paragraph into plain and highlighted segments; overlapping highlights merge. */
export function splitHighlights(paragraph: string, highlights: string[] = []) {
  const ranges: Array<[number, number]> = [];
  for (const highlight of highlights) {
    if (!highlight) continue;
    for (let start = paragraph.indexOf(highlight); start !== -1; start = paragraph.indexOf(highlight, start + highlight.length)) {
      ranges.push([start, start + highlight.length]);
    }
  }
  if (!ranges.length) return [{ text: paragraph, highlight: false }];
  ranges.sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const segments: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: paragraph.slice(cursor, start), highlight: false });
    segments.push({ text: paragraph.slice(start, end), highlight: true });
    cursor = end;
  }
  if (cursor < paragraph.length) segments.push({ text: paragraph.slice(cursor), highlight: false });
  return segments;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character] ?? character);
}

export function buildOpml(state: Pick<ReaderState, 'feeds' | 'folders' | 'feedFolders'>) {
  const outline = (feed: Feed, indent: string) =>
    `${indent}<outline type="rss" text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" xmlUrl="${escapeXml(feed.url)}" />`;
  const folders = [...new Set([...state.folders, ...Object.values(state.feedFolders)])];
  const lines = folders.flatMap((folder) => {
    const feeds = state.feeds.filter((feed) => state.feedFolders[feed.name] === folder);
    if (!feeds.length) return [];
    return [
      `    <outline text="${escapeXml(folder)}" title="${escapeXml(folder)}">`,
      ...feeds.map((feed) => outline(feed, '      ')),
      '    </outline>'
    ];
  });
  lines.push(...state.feeds.filter((feed) => !state.feedFolders[feed.name]).map((feed) => outline(feed, '    ')));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head><title>Feedflow subscriptions</title></head>',
    '  <body>',
    ...lines,
    '  </body>',
    '</opml>'
  ].join('\n');
}
