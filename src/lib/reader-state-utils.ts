import { validatePublicFeedUrl } from './feed-utils.ts';

export type ReaderSnapshot = {
  stories: ReaderSnapshotStory[];
  feeds: ReaderSnapshotFeed[];
  folders: string[];
  feedFolders: Record<string, string>;
  compact: boolean;
  autoMarkRead: boolean;
  sortOrder: 'newest' | 'oldest' | 'relevance';
};

export type ReaderSnapshotStory = {
  id: number;
  source: string;
  initials: string;
  color: string;
  title: string;
  feedItemId?: string;
  excerpt: string;
  time: string;
  publishedAt?: number;
  category: string;
  read: boolean;
  starred: boolean;
  saved: boolean;
  shared: boolean;
  image: string;
  url: string;
  feedUrl?: string;
  body?: string;
  note?: string;
};

export type ReaderSnapshotFeed = {
  name: string;
  url: string;
  etag?: string;
  lastModified?: string;
};

const legacyDemoStories = new Set([
  'https://www.theverge.com/|The quiet joy of making things just for yourself',
  'https://www.densediscovery.com/|A field guide to noticing the small things',
  'https://www.themarginalian.org/|Mary Oliver on the measure of a life',
  'https://alistapart.com/|The web is a garden, not a marketplace',
  'https://thebrowser.com/|Why old maps still feel like invitations',
  'https://www.theverge.com/|The internet used to feel like a place'
]);

const legacyDemoFeeds = new Map([
  ['The Verge', 'https://www.theverge.com/rss/index.xml'],
  ['Dense Discovery', 'https://www.densediscovery.com/rss.xml'],
  ['The Marginalian', 'https://www.themarginalian.org/feed/'],
  ['A List Apart', 'https://alistapart.com/main/feed/'],
  ['The Browser', 'https://thebrowser.com/feed/']
]);

export function removeLegacyDemoStories<T extends { title: string; url: string }>(stories: T[]): T[] {
  return stories.filter((story) => !legacyDemoStories.has(`${story.url}|${story.title}`));
}

export function removeLegacyDemoFeeds<T extends { name: string; url: string }>(feeds: T[], stories: ReaderSnapshotStory[]): T[] {
  return feeds.filter((feed) => legacyDemoFeeds.get(feed.name) !== feed.url
    || stories.some((story) => story.source === feed.name && !!story.feedItemId));
}

const MAX_STATE_BYTES = 1_500_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => asRecord(item) !== null);
}

function isBoundedString(value: unknown, limit: number, allowEmpty = true): value is string {
  return typeof value === 'string' && value.length <= limit && (allowEmpty || value.trim().length > 0);
}

function assertStory(value: Record<string, unknown>): value is ReaderSnapshotStory & Record<string, unknown> {
  const booleans = ['read', 'starred', 'saved', 'shared'];
  if (!Number.isSafeInteger(value.id) || (value.id as number) < 0) return false;
  if (!['source', 'initials', 'color', 'title', 'excerpt', 'time', 'category', 'image', 'url'].every((key) => isBoundedString(value[key], key === 'excerpt' ? 2_000 : 2_048, key === 'excerpt'))) return false;
  if (!booleans.every((key) => typeof value[key] === 'boolean')) return false;
  if (value.feedItemId !== undefined && !isBoundedString(value.feedItemId, 2_048)) return false;
  if (value.feedUrl !== undefined && !isBoundedString(value.feedUrl, 2_048)) return false;
  if (value.body !== undefined && !isBoundedString(value.body, 12_000)) return false;
  if (value.note !== undefined && !isBoundedString(value.note, 10_000)) return false;
  return value.publishedAt === undefined || (typeof value.publishedAt === 'number' && Number.isFinite(value.publishedAt));
}

function assertFeed(value: Record<string, unknown>): value is ReaderSnapshotFeed & Record<string, unknown> {
  if (!isBoundedString(value.name, 160, false) || !isBoundedString(value.url, 2_048, false)) return false;
  try {
    validatePublicFeedUrl(value.url);
  } catch {
    return false;
  }
  return (value.etag === undefined || isBoundedString(value.etag, 512))
    && (value.lastModified === undefined || isBoundedString(value.lastModified, 512));
}

export function validateReaderSnapshot(input: unknown): string {
  const state = asRecord(input);
  if (!state) throw new Error('Invalid reader state.');
  if (!isRecordArray(state.stories) || state.stories.length > 10_000 || !state.stories.every(assertStory)) throw new Error('Reader library is too large or invalid.');
  if (!isRecordArray(state.feeds) || state.feeds.length > 500 || !state.feeds.every(assertFeed)) throw new Error('Subscription list is too large or invalid.');
  if (!Array.isArray(state.folders) || state.folders.length > 200 || !state.folders.every((item) => typeof item === 'string')) {
    throw new Error('Folder list is too large or invalid.');
  }
  const feedFolders = asRecord(state.feedFolders);
  if (!feedFolders || Object.values(feedFolders).some((folder) => typeof folder !== 'string')) throw new Error('Invalid folder assignments.');
  if (typeof state.compact !== 'boolean' || typeof state.autoMarkRead !== 'boolean') throw new Error('Invalid reader preferences.');
  if (!['newest', 'oldest', 'relevance'].includes(String(state.sortOrder))) throw new Error('Invalid reader sort order.');

  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) throw new Error('Reader state exceeds the 1.5 MB limit.');
  return serialized;
}

export function parseReaderSnapshot(serialized: string): ReaderSnapshot {
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) throw new Error('Saved reader state exceeds the size limit.');
  const parsed = JSON.parse(serialized) as unknown;
  validateReaderSnapshot(parsed);
  return parsed as ReaderSnapshot;
}

export function shouldImportLegacyReaderState(userId: string | null, migrationOwner: string | null) {
  return userId !== null && migrationOwner === userId;
}

export function createLatestSaveQueue<T>(save: (value: T) => Promise<void>) {
  let pendingValue: T | undefined;
  let draining: Promise<void> | null = null;

  async function drain() {
    while (pendingValue !== undefined) {
      const current = pendingValue;
      pendingValue = undefined;
      await save(current);
    }
    draining = null;
    if (pendingValue !== undefined) {
      draining = drain();
      await draining;
    }
  }

  return (value: T) => {
    pendingValue = value;
    if (!draining) draining = drain();
    return draining;
  };
}
