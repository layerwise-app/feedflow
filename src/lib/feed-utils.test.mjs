import assert from 'node:assert/strict';
import test from 'node:test';
import { createFeedRequestHeaders, findFeedLink, mergeFeedValidators, parseFeed, validatePublicFeedUrl } from './feed-utils.ts';
import { mergeFeedStories } from './feed-story-merge.ts';
import { fetchLimitedText } from './feed-http.ts';

test('accepts public URLs and rejects local or ambiguous destinations', () => {
  assert.equal(validatePublicFeedUrl('https://feeds.example.org/').hostname, 'feeds.example.org');
  for (const url of [
    'file:///etc/passwd',
    'http://localhost/feed.xml',
    'http://127.0.0.1/feed.xml',
    'http://192.168.1.10/feed.xml',
    'http://10.1.2.3/feed.xml',
    'https://site.local./feed.xml',
    'https://127.0.0.1.nip.io/feed.xml',
    'https://public.example:8443/feed.xml',
    'https://user:password@example.org/feed.xml'
  ]) {
    assert.throws(() => validatePublicFeedUrl(url), /public HTTPS/);
  }
});

test('parses namespaced RSS, retains GUID identity, permalink URLs, and paragraphs', () => {
  const rss = `<?xml version="1.0"?><rss xmlns:content="urn:content"><channel><title>Field Notes &amp; Co</title><item><guid>entry-7</guid><title>Gardens &amp;amp; cities</title><link>https://stories.example.org/gardens</link><description><![CDATA[<p>First paragraph<br/>with a line.</p><p>Second paragraph<script>alert(1)</script></p>]]></description><pubDate>Tue, 22 Sep 2026 10:00:00 GMT</pubDate></item><item><guid>https://stories.example.org/permalink</guid><title>Permalink GUID</title></item><item><guid isPermaLink="false">entry-8</guid><title>No link fallback</title></item></channel></rss>`;
  const parsed = parseFeed(rss, new URL('https://feeds.example.org/rss.xml'));
  assert.ok(parsed);
  if (!parsed) throw new Error('Expected an RSS feed to parse.');
  assert.equal(parsed.title, 'Field Notes & Co');
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items[0].id, 'entry-7');
  assert.equal(parsed.items[0].url, 'https://stories.example.org/gardens');
  assert.equal(parsed.items[0].title, 'Gardens & cities');
  assert.equal(parsed.items[0].body, 'First paragraph\n\nwith a line.\n\nSecond paragraph');
  assert.equal(parsed.items[1].id, 'https://stories.example.org/permalink');
  assert.equal(parsed.items[1].url, 'https://stories.example.org/permalink');
  assert.equal(parsed.items[2].id, 'entry-8');
  assert.equal(parsed.items[2].url, 'https://feeds.example.org/rss.xml');
});

test('parses Atom alternate links and uses the canonical feed path', () => {
  const atom = `<a:feed xmlns:a="urn:atom"><a:title>Quiet Reader</a:title><a:entry><a:id>tag:quiet.example.org,2026:post/1</a:id><a:title>A note</a:title><a:link rel="self" href="https://feeds.example.org/atom.xml"/><a:link rel="alternate" href="https://quiet.example.org/post/1"/><a:summary>Read this &amp; save it.</a:summary><a:updated>2026-09-20T12:00:00Z</a:updated></a:entry></a:feed>`;
  const parsed = parseFeed(atom, new URL('https://feeds.example.org/atom.xml'));
  assert.ok(parsed);
  if (!parsed) throw new Error('Expected an Atom feed to parse.');
  assert.equal(parsed.items[0].id, 'tag:quiet.example.org,2026:post/1');
  assert.equal(parsed.items[0].url, 'https://quiet.example.org/post/1');
  assert.equal(parsed.items[0].excerpt, 'Read this & save it.');
});

test('decodes typographic entities and drops WordPress summary footers', () => {
  const rss = '<rss><channel><title>Quanta</title><item><guid>q-1</guid><title>Big &amp;mdash; small</title><link>https://feeds.example.org/q-1</link><description>Attention matters &amp;mdash; a lot&amp;hellip; The post Big &amp;#8212; small first appeared on Quanta Magazine.</description></item></channel></rss>';
  const [item] = parseFeed(rss, new URL('https://feeds.example.org/rss.xml')).items;
  assert.equal(item.title, 'Big \u2014 small');
  assert.equal(item.body, 'Attention matters \u2014 a lot\u2026');
  assert.equal(item.excerpt, item.body);
});

test('drops a headline repeated at the start of the summary', () => {
  const atom = '<feed><title>Blog</title><entry><id>b-1</id><title>Redesigning source control</title><link href="https://blog.example.org/b-1"/><summary>&lt;p&gt;Redesigning source control&lt;/p&gt;&lt;p&gt;Interesting piece.&lt;/p&gt;</summary></entry><entry><id>b-2</id><title>Release</title><link href="https://blog.example.org/b-2"/><summary>Released today.</summary></entry></feed>';
  const [repeated, prefixOnly] = parseFeed(atom, new URL('https://blog.example.org/atom.xml')).items;
  assert.equal(repeated.body, 'Interesting piece.');
  assert.equal(prefixOnly.body, 'Released today.');
});

test('uses image title text for image-only entries', () => {
  const atom = `<feed><title>Comics</title><entry><id>c-1</id><title>Dogcatcher</title><link href="https://comics.example.org/1/"/><summary type="html">&lt;img src="https://comics.example.org/1.png" title="Voyager 2 'seemed lonely' &amp;amp; quiet." alt="Dogcatcher" /&gt;</summary></entry><entry><id>c-2</id><title>Blank</title><link href="https://comics.example.org/2/"/><summary type="html">&lt;img src="https://comics.example.org/2.png" /&gt;</summary></entry></feed>`;
  const [captioned, blank] = parseFeed(atom, new URL('https://comics.example.org/atom.xml')).items;
  assert.equal(captioned.body, "Voyager 2 'seemed lonely' & quiet.");
  assert.equal(blank.body, '');
  assert.equal(blank.excerpt, '');
});

test('rejects executable article schemes and truncates large feeds', () => {
  const items = Array.from({ length: 44 }, (_, index) => `<item><guid>${index}</guid><title>Story ${index}</title><link>javascript:alert(${index})</link></item>`).join('');
  const parsed = parseFeed(`<rss><channel><title>Bounded</title>${items}</channel></rss>`, new URL('https://feeds.example.org/feed.xml'));
  assert.ok(parsed);
  if (!parsed) throw new Error('Expected RSS entries to parse.');
  assert.equal(parsed.items.length, 40);
  assert.equal(parsed.items[0].url, 'https://feeds.example.org/feed.xml');
});

test('discovers only valid public alternate feed links', () => {
  const page = new URL('https://journal.example.org/notes/');
  const discovered = findFeedLink(`<link rel="alternate" type="application/rss+xml" href="https://journal.example.org/feed.xml"><link rel="alternate" type="application/atom+xml" href="http://127.0.0.1/private">`, page);
  assert.equal(discovered?.href, 'https://journal.example.org/feed.xml');
  assert.equal(findFeedLink('<html><head></head></html>', page), null);
});

test('sends and retains conditional refresh validators', () => {
  const previous = { name: 'Field Notes', url: 'https://feeds.example.org/rss.xml', etag: '"v17"', lastModified: 'Tue, 22 Sep 2026 10:00:00 GMT' };
  const headers = createFeedRequestHeaders(previous);
  assert.equal(headers['If-None-Match'], '"v17"');
  assert.equal(headers['If-Modified-Since'], previous.lastModified);
  assert.equal(headers.Accept.includes('application/atom+xml'), true);
  assert.deepEqual(mergeFeedValidators(previous, { etag: '"v18"' }), {
    ...previous,
    etag: '"v18"'
  });
  assert.deepEqual(mergeFeedValidators(previous, {}), previous);
});

test('returns 304 without a body and preserves validators', async () => {
  let requestHeaders;
  const fetcher = async (_url, options) => {
    requestHeaders = options.headers;
    return new Response(null, { status: 304, headers: { etag: '"same"' } });
  };
  const result = await fetchLimitedText(
    new URL('https://feed.example.org/rss.xml'),
    Date.now() + 2_000,
    { etag: '"same"', lastModified: 'Tue, 22 Sep 2026 10:00:00 GMT' },
    fetcher
  );
  assert.equal(requestHeaders.get('if-none-match'), '"same"');
  assert.equal(requestHeaders.get('if-modified-since'), 'Tue, 22 Sep 2026 10:00:00 GMT');
  assert.equal(result.notModified, true);
  assert.equal(result.text, '');
  assert.equal(result.etag, '"same"');
});

test('returns 304 immediately during feed discovery without probing alternate paths', async () => {
  let requestCount = 0;
  const fetcher = async () => {
    requestCount += 1;
    return new Response(null, { status: 304 });
  };
  const response = await fetchLimitedText(
    new URL('https://feed.example.org/rss.xml'),
    Date.now() + 2_000,
    { etag: '"cached"' },
    fetcher,
    validatePublicFeedUrl
  );
  assert.equal(response.notModified, true);
  assert.equal(requestCount, 1);
});

test('validates redirects and strips conditional tokens across origins', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url: url.href, headers: options.headers });
    if (requests.length === 1) return new Response(null, { status: 302, headers: { location: 'https://cdn.example.net/feed.xml' } });
    return new Response('<rss><channel><title>Redirected</title><item><guid>1</guid><title>Entry</title></item></channel></rss>', {
      status: 200,
      headers: { 'content-type': 'application/rss+xml', etag: '"cdn"' }
    });
  };
  await fetchLimitedText(
    new URL('https://feed.example.org/rss.xml'),
    Date.now() + 2_000,
    { etag: '"origin"' },
    fetcher,
    validatePublicFeedUrl
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.get('if-none-match'), '"origin"');
  assert.equal(requests[1].headers.has('if-none-match'), false);

  let redirectedToPrivateHost = false;
  const privateRedirectFetcher = async () => new Response(null, {
    status: 302,
    headers: { location: 'http://127.0.0.1/secret' }
  });
  try {
    await fetchLimitedText(
      new URL('https://feed.example.org/rss.xml'),
      Date.now() + 2_000,
      {},
      privateRedirectFetcher,
      validatePublicFeedUrl
    );
  } catch {
    redirectedToPrivateHost = true;
  }
  assert.equal(redirectedToPrivateHost, true);
});

test('merges refreshed entries while preserving reader state and separating feeds', () => {
  const baseFeed = {
    title: 'North Journal',
    feedUrl: 'https://north.example.org/feed.xml',
    items: [{
      id: 'post-1', title: 'Revised title', excerpt: 'Updated summary', body: 'Updated article body',
      url: 'https://shared.example.org/story/1', publishedAt: '2026-09-22T10:00:00Z'
    }]
  };
  const existing = {
    id: 8, source: 'North Journal', feedUrl: baseFeed.feedUrl, feedItemId: 'post-1',
    initials: 'N', color: '#315f88', title: 'Old title', excerpt: 'Old summary', body: 'Old body',
    time: 'Sep 1', category: 'From feed', read: true, starred: true, saved: true, shared: true,
    note: 'Keep this quote', image: 'garden', url: 'https://shared.example.org/story/1'
  };
  const updated = mergeFeedStories([existing], baseFeed);
  assert.equal(updated.added, 0);
  assert.equal(updated.stories.length, 1);
  assert.equal(updated.stories[0].title, 'Revised title');
  assert.equal(updated.stories[0].read, true);
  assert.equal(updated.stories[0].starred, true);
  assert.equal(updated.stories[0].saved, true);
  assert.equal(updated.stories[0].shared, true);
  assert.equal(updated.stories[0].note, 'Keep this quote');

  const syndicated = mergeFeedStories(updated.stories, {
    ...baseFeed,
    title: 'South Journal',
    feedUrl: 'https://south.example.org/feed.xml',
    items: [{ ...baseFeed.items[0], id: 'different-post-id', title: 'Syndicated title' }]
  });
  assert.equal(syndicated.added, 1);
  assert.equal(syndicated.stories.length, 2);
  assert.equal(syndicated.stories[0].source, 'South Journal');
  assert.equal(syndicated.stories[1].source, 'North Journal');
});
