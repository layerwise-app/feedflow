import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addHighlight,
  applyFeedError,
  applyFeedRefresh,
  buildOpml,
  countNewItems,
  countStories,
  DAY_MS,
  markStoriesRead,
  removeHighlight,
  renameFeed,
  scopeExists,
  selectStories,
  splitHighlights,
  subscribeToFeed,
  uniqueFeedName,
  unsubscribeFeed
} from './reader-model.ts';
import { createEmptyReaderState } from './reader-state-utils.ts';

const now = Date.UTC(2026, 9, 14, 12);

function story(id, overrides = {}) {
  return {
    id, source: 'Alpha', initials: 'A', color: '#2340E0', title: `Story ${id}`, excerpt: 'Summary',
    time: 'Oct 14', category: 'From feed', image: 'garden', url: `https://alpha.example.org/${id}`,
    read: false, starred: false, saved: false, shared: false, publishedAt: now - id * 3_600_000, ...overrides
  };
}

function state(overrides = {}) {
  return {
    ...createEmptyReaderState(),
    feeds: [{ name: 'Alpha', url: 'https://alpha.example.org/feed' }, { name: 'Beta', url: 'https://beta.example.org/feed' }],
    folders: ['Tech'],
    feedFolders: { Alpha: 'Tech' },
    ...overrides
  };
}

function feedResult(title, items, feedUrl = 'https://alpha.example.org/feed') {
  return {
    parsed: {
      title,
      feedUrl,
      items: items.map((id) => ({ id: `item-${id}`, title: `Item ${id}`, excerpt: 'Fresh', body: 'Body', url: `https://alpha.example.org/item-${id}`, publishedAt: new Date(now).toISOString() }))
    },
    feedUrl,
    etag: '"v2"',
    notModified: false
  };
}

test('counts unread stories per view, feed, and folder', () => {
  const stories = [
    story(1),
    story(2, { read: true, starred: true }),
    story(3, { source: 'Beta', saved: true, note: 'Look again' }),
    story(4, { source: 'Beta', highlights: ['Summary'], read: true })
  ];
  const counts = countStories(stories, { Alpha: 'Tech' });
  assert.deepEqual(counts.views, { all: 2, starred: 1, later: 1, notes: 2, shared: 0, read: 2 });
  assert.deepEqual(counts.feeds, { Alpha: 1, Beta: 1 });
  assert.deepEqual(counts.folders, { Tech: 1 });
});

test('selects stories by scope, unread filter, search, and sort order', () => {
  const stories = [story(3), story(1, { read: true }), story(2, { source: 'Beta', title: 'Gardens of Alpha' })];
  const base = { query: '', unreadOnly: false, sortOrder: 'newest', feedFolders: { Alpha: 'Tech' } };
  assert.deepEqual(selectStories(stories, { ...base, scope: { type: 'folder', folder: 'Tech' } }).map((item) => item.id), [1, 3]);
  assert.deepEqual(selectStories(stories, { ...base, scope: { type: 'feed', feed: 'Alpha' }, unreadOnly: true }).map((item) => item.id), [3]);
  assert.deepEqual(
    selectStories(stories, { ...base, scope: { type: 'feed', feed: 'Alpha' }, unreadOnly: true, keepVisible: new Set([1]) }).map((item) => item.id),
    [1, 3]
  );
  assert.deepEqual(selectStories(stories, { ...base, scope: { type: 'view', view: 'all' }, sortOrder: 'oldest' }).map((item) => item.id), [3, 2, 1]);
  // Search ignores the current scope; relevance ranks title matches above source matches.
  assert.deepEqual(
    selectStories(stories, { ...base, scope: { type: 'view', view: 'starred' }, query: 'alpha', sortOrder: 'relevance' }).map((item) => item.id),
    [2, 1, 3]
  );
});

test('marks a scope read, optionally only stories older than a cutoff', () => {
  const stories = [story(1), story(30), story(50, { publishedAt: undefined }), story(60, { read: true })];
  const ids = new Set(stories.map((item) => item.id));
  const older = markStoriesRead(stories, ids, now - DAY_MS);
  assert.equal(older.changed, 1);
  assert.deepEqual(older.stories.map((item) => item.read), [false, true, false, true]);
  const all = markStoriesRead(stories, ids);
  assert.equal(all.changed, 3);
  assert.equal(markStoriesRead(all.stories, ids).stories, all.stories);
});

test('subscribes with unique names and refreshes existing subscriptions', () => {
  const first = subscribeToFeed(state({ feeds: [] }), feedResult('Alpha', [1, 2]), now, 'Tech');
  assert.equal(first.name, 'Alpha');
  assert.equal(first.added, 2);
  assert.equal(first.state.feedFolders.Alpha, 'Tech');
  assert.equal(first.state.feeds[0].lastFetchedAt, now);

  const duplicateTitle = subscribeToFeed(first.state, feedResult('Alpha', [9], 'https://other.example.org/feed'), now);
  assert.equal(duplicateTitle.name, 'Alpha (2)');

  assert.equal(countNewItems(first.state.stories, feedResult('Alpha', [2, 3])), 1);
  const again = subscribeToFeed(first.state, feedResult('Alpha', [2, 3]), now + 1);
  assert.equal(again.existing, true);
  assert.equal(again.added, 1);
  assert.equal(again.state.feeds.length, 1);
  assert.equal(uniqueFeedName([{ name: 'Alpha', url: 'https://a.example.org' }], ' ', 'https://www.example.org/feed'), 'example.org');

  const curated = subscribeToFeed(state({ feeds: [] }), feedResult('Alpha - All content', [1]), now, '', 'Alpha');
  assert.equal(curated.name, 'Alpha');
  assert.equal(curated.state.feeds[0].renamed, true);
  assert.equal(applyFeedRefresh(curated.state, 'Alpha', feedResult('Alpha - All content', [4]), now + 1).name, 'Alpha');
});

test('refresh renames to the feed title unless the reader renamed it, and clears errors', () => {
  const initial = state({ stories: [story(1)], feeds: [{ name: 'Alpha', url: 'https://alpha.example.org/feed', error: 'Timed out' }] });
  const refreshed = applyFeedRefresh(initial, 'Alpha', feedResult('Alpha Weekly', [5]), now);
  assert.equal(refreshed.name, 'Alpha Weekly');
  assert.equal(refreshed.state.feeds[0].error, undefined);
  assert.equal(refreshed.state.feedFolders['Alpha Weekly'], 'Tech');
  assert.ok(refreshed.state.stories.every((item) => item.source === 'Alpha Weekly'));

  const renamed = renameFeed(initial, 'Alpha', 'My Alpha');
  assert.equal(renamed.feeds[0].renamed, true);
  assert.equal(renamed.feedFolders['My Alpha'], 'Tech');
  assert.equal(renamed.stories[0].source, 'My Alpha');
  const kept = applyFeedRefresh(renamed, 'My Alpha', feedResult('Alpha Weekly', [5]), now);
  assert.equal(kept.name, 'My Alpha');
  assert.throws(() => renameFeed(state(), 'Alpha', 'Beta'), /already/);

  const notModified = applyFeedRefresh(initial, 'Alpha', { parsed: null, feedUrl: 'https://alpha.example.org/feed', notModified: true }, now);
  assert.equal(notModified.added, 0);
  assert.equal(notModified.state.feeds[0].lastFetchedAt, now);

  const failed = applyFeedError(state(), 'Beta', 'Feed returned 500', now);
  assert.equal(failed.feeds[1].error, 'Feed returned 500');
});

test('unsubscribing keeps starred, saved, and annotated stories', () => {
  const initial = state({ stories: [story(1), story(2, { starred: true }), story(3, { note: 'Keep' }), story(4, { source: 'Beta' })] });
  const next = unsubscribeFeed(initial, 'Alpha');
  assert.deepEqual(next.feeds.map((feed) => feed.name), ['Beta']);
  assert.deepEqual(next.stories.map((item) => item.id), [2, 3, 4]);
  assert.equal(next.feedFolders.Alpha, undefined);
});

test('adds, removes, and renders highlights', () => {
  const highlighted = addHighlight(story(1), '  quick   brown fox ');
  assert.deepEqual(highlighted.highlights, ['quick brown fox']);
  assert.equal(addHighlight(highlighted, 'quick brown fox'), highlighted);
  assert.equal('highlights' in removeHighlight(highlighted, 'quick brown fox'), false);
  assert.deepEqual(splitHighlights('The quick brown fox jumps', ['quick brown', 'brown fox']), [
    { text: 'The ', highlight: false },
    { text: 'quick brown fox', highlight: true },
    { text: ' jumps', highlight: false }
  ]);
});

test('exports subscriptions as escaped OPML grouped by folder', () => {
  const opml = buildOpml({
    feeds: [{ name: 'A & B', url: 'https://alpha.example.org/feed?a=1&b=2' }, { name: 'Loose', url: 'https://loose.example.org/rss' }],
    folders: ['Tech', 'Empty'],
    feedFolders: { 'A & B': 'Tech' }
  });
  assert.match(opml, /<outline text="Tech" title="Tech">\n {6}<outline type="rss" text="A &amp; B"/);
  assert.match(opml, /xmlUrl="https:\/\/alpha.example.org\/feed\?a=1&amp;b=2"/);
  assert.doesNotMatch(opml, /Empty/);
  assert.match(opml, /\n {4}<outline type="rss" text="Loose"/);
});

test('feed and folder scopes are valid only while they exist', () => {
  const state = { feeds: [{ name: 'Alpha', url: 'https://alpha.example.org/feed' }], folders: ['Empty'], feedFolders: { Alpha: 'Tech' } };
  assert.equal(scopeExists({ type: 'view', view: 'all' }, state), true);
  assert.equal(scopeExists({ type: 'feed', feed: 'Alpha' }, state), true);
  assert.equal(scopeExists({ type: 'feed', feed: 'Gone' }, state), false);
  assert.equal(scopeExists({ type: 'folder', folder: 'Tech' }, state), true);
  assert.equal(scopeExists({ type: 'folder', folder: 'Empty' }, state), true);
  assert.equal(scopeExists({ type: 'folder', folder: 'Deleted' }, state), false);
});
