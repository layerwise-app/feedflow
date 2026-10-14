import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestSaveQueue, normalizeReaderSnapshot, parseReaderSnapshot, removeLegacyDemoFeeds, removeLegacyDemoStories, shouldImportLegacyReaderState, validateReaderSnapshot } from './reader-state-utils.ts';

const validSnapshot = {
  stories: [{
    id: 1, source: 'Field Notes', initials: 'F', color: '#315f88', title: 'A saved story',
    excerpt: 'A short summary', time: 'Sep 23', category: 'Ideas', image: 'garden',
    url: 'https://stories.example.org/item/1', read: false, starred: false, saved: false, shared: false
  }],
  feeds: [{ name: 'Field Notes', url: 'https://feed.example.org/rss.xml', etag: '"17"' }],
  folders: ['Design'],
  feedFolders: { 'Field Notes': 'Design' },
  compact: false,
  autoMarkRead: true,
  sortOrder: 'newest'
};

test('serializes and parses a bounded reader snapshot', () => {
  const serialized = validateReaderSnapshot(validSnapshot);
  assert.deepEqual(parseReaderSnapshot(serialized), validSnapshot);
});

test('accepts older snapshots and fills new preferences with defaults', () => {
  const state = normalizeReaderSnapshot(parseReaderSnapshot(validateReaderSnapshot(validSnapshot)));
  assert.equal(state.layout, 'list');
  assert.deepEqual(state.reading, { fontSize: 18, font: 'serif', width: 'medium' });
  assert.equal(state.autoRefreshMinutes, 0);
  assert.equal(state.autoMarkRead, true);
});

test('round-trips layout, reading preferences, feed status, and highlights', () => {
  const snapshot = {
    ...validSnapshot,
    layout: 'magazine',
    reading: { fontSize: 20, font: 'sans', width: 'wide' },
    autoRefreshMinutes: 30,
    stories: [{ ...validSnapshot.stories[0], note: 'Follow up', highlights: ['A short summary'] }],
    feeds: [{ ...validSnapshot.feeds[0], lastFetchedAt: 1_700_000_000_000, error: 'Timed out', renamed: true }]
  };
  const parsed = parseReaderSnapshot(validateReaderSnapshot(snapshot));
  assert.deepEqual(parsed, snapshot);
  assert.deepEqual(normalizeReaderSnapshot(parsed).reading, snapshot.reading);
});

test('rejects invalid layout, reading, refresh, highlight, and feed status values', () => {
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, layout: 'grid' }), /layout/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, reading: { fontSize: 40, font: 'serif', width: 'medium' } }), /reading/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, reading: { fontSize: 18, font: 'mono', width: 'medium' } }), /reading/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, reading: { fontSize: 18, font: 'serif' } }), /reading/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, autoRefreshMinutes: 5 }), /auto-refresh/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: [{ ...validSnapshot.stories[0], highlights: 'text' }] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: [{ ...validSnapshot.stories[0], highlights: ['  '] }] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: [{ ...validSnapshot.stories[0], highlights: Array(51).fill('x') }] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, feeds: [{ ...validSnapshot.feeds[0], lastFetchedAt: 'today' }] }), /Subscription list/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, feeds: [{ ...validSnapshot.feeds[0], error: 'x'.repeat(301) }] }), /Subscription list/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, feeds: [{ ...validSnapshot.feeds[0], renamed: 'yes' }] }), /Subscription list/);
});

test('removes only old demo articles, not fetched or user-added articles', () => {
  const demo = { title: 'The quiet joy of making things just for yourself', url: 'https://www.theverge.com/' };
  const real = { title: demo.title, url: 'https://www.theverge.com/actual-story' };
  assert.deepEqual(removeLegacyDemoStories([demo, real]), [real]);
});

test('drops legacy seed subscriptions without removing active feeds or user subscriptions', () => {
  const verge = { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' };
  const custom = { name: 'My Feed', url: 'https://example.org/rss.xml' };
  assert.deepEqual(removeLegacyDemoFeeds([verge, custom], []), [custom]);
  assert.deepEqual(removeLegacyDemoFeeds([verge], [{ source: 'The Verge', feedItemId: 'real-entry' }]), [verge]);
});

test('rejects malformed state structures and preference values', () => {
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: ['not an object'] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: [{ ...validSnapshot.stories[0], id: 'one' }] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: [{ ...validSnapshot.stories[0], read: 'false' }] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, feeds: Array(501).fill({ name: 'large' }) }), /Subscription list/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, feeds: [{ name: 'Local', url: 'http://127.0.0.1/private' }] }), /Subscription list/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, feedFolders: { 'Field Notes': 42 } }), /folder assignments/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, sortOrder: 'random' }), /sort order/);
});

test('rejects saved snapshots that exceed the storage limit', () => {
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: [{ ...validSnapshot.stories[0], note: 'x'.repeat(12_001) }] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: [{ ...validSnapshot.stories[0], body: 'x'.repeat(12_001) }] }), /library/);
  assert.throws(() => validateReaderSnapshot({ ...validSnapshot, stories: Array(10_000).fill(validSnapshot.stories[0]) }), /1.5 MB/);
  assert.throws(() => parseReaderSnapshot('{broken json'), /JSON/);
});

test('keeps account migration markers isolated by identity', () => {
  assert.equal(shouldImportLegacyReaderState(null, null), false);
  assert.equal(shouldImportLegacyReaderState('user-a', null), false);
  assert.equal(shouldImportLegacyReaderState('user-a', 'user-a'), true);
  assert.equal(shouldImportLegacyReaderState('user-b', 'user-a'), false);
});

test('serializes cloud snapshots and coalesces unsent intermediate states', async () => {
  const writes = [];
  let releaseFirst;
  const firstWrite = new Promise((resolve) => { releaseFirst = resolve; });
  const queue = createLatestSaveQueue(async (state) => {
    writes.push(state);
    if (state === 'first') await firstWrite;
  });

  const first = queue('first');
  const second = queue('second');
  const latest = queue('latest');
  releaseFirst();
  await Promise.all([first, second, latest]);
  assert.deepEqual(writes, ['first', 'latest']);
});
