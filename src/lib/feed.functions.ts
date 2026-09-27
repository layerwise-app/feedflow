import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createFeedRequestHeaders, findFeedLink, parseFeed, validatePublicFeedUrl } from '~/lib/feed-utils';
import { fetchLimitedText } from '~/lib/feed-http';
import { auth } from '~/lib/auth';

const LOOKUP_TIMEOUT_MS = 20_000;

async function discoverFeed(url: URL) {
  const deadline = Date.now() + LOOKUP_TIMEOUT_MS;
  let pageResponse: Awaited<ReturnType<typeof fetchLimitedText>> | null = null;
  try {
    pageResponse = await fetchLimitedText(url, deadline, {}, fetch, validatePublicFeedUrl);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('404')) throw error;
  }

  if (pageResponse?.notModified) return pageResponse;
  if (pageResponse && parseFeed(pageResponse.text, pageResponse.url)) return pageResponse;
  if (pageResponse && /text\/html|<html\b/i.test(`${pageResponse.contentType} ${pageResponse.text.slice(0, 500)}`)) {
    const discovered = findFeedLink(pageResponse.text, pageResponse.url);
    if (discovered) {
      const feedResponse = await fetchLimitedText(discovered, deadline, {}, fetch, validatePublicFeedUrl);
      if (parseFeed(feedResponse.text, feedResponse.url)) return feedResponse;
    }
  }

  const possiblePaths = ['/feed', '/feed.xml', '/rss.xml', '/atom.xml'];
  const suppliedPath = url.pathname.replace(/\/$/, '');
  if (suppliedPath.includes('.')) possiblePaths.unshift(`${suppliedPath}/feed`);
  for (const path of possiblePaths) {
    const candidate = validatePublicFeedUrl(path, url.origin);
    if (candidate.href === url.href) continue;
    try {
      const response = await fetchLimitedText(candidate, deadline, {}, fetch, validatePublicFeedUrl);
      if (response.notModified || parseFeed(response.text, response.url)) return response;
    } catch {
      continue;
    }
  }
  throw new Error('No RSS or Atom feed was found. Try pasting its direct feed URL.');
}

const fetchFeedValidator = (input: unknown) => {
  if (!input || typeof input !== 'object' || !('url' in input) || typeof input.url !== 'string' || input.url.length > 2048) {
    throw new Error('Enter a valid feed or website URL.');
  }
  const inputRecord = input as { url: string; etag?: unknown; lastModified?: unknown };
  const optionalToken = (key: 'etag' | 'lastModified') => {
    const raw = inputRecord[key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value.length > 512 || /[\r\n]/.test(value)) throw new Error('Invalid feed cache validator.');
    return value || undefined;
  };
  return { url: inputRecord.url.trim(), etag: optionalToken('etag'), lastModified: optionalToken('lastModified') };
};

export const fetchFeed = createServerFn({ method: 'POST' })
  .validator(fetchFeedValidator)
  .handler(async ({ data }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() });
    if (!session) throw new Error('Sign in to manage subscriptions.');
    const sourceUrl = validatePublicFeedUrl(data.url);
    const deadline = Date.now() + LOOKUP_TIMEOUT_MS;
    const response = await fetchLimitedText(sourceUrl, deadline, { etag: data.etag, lastModified: data.lastModified }, fetch, validatePublicFeedUrl);
    if (response.notModified) {
      return {
        parsed: null,
        feedUrl: response.url.href,
        etag: response.etag,
        lastModified: response.lastModified,
        notModified: true as const
      };
    }
    const parsed = parseFeed(response.text, response.url);
    if (parsed) {
      return {
        parsed,
        feedUrl: parsed.feedUrl,
        etag: response.etag,
        lastModified: response.lastModified,
        notModified: false as const
      };
    }
    if (/text\/html|<html\b/i.test(`${response.contentType} ${response.text.slice(0, 500)}`)) {
      const discovered = findFeedLink(response.text, response.url);
      if (discovered) {
        const feedResponse = await fetchLimitedText(discovered, deadline, {}, fetch, validatePublicFeedUrl);
        const discoveredFeed = parseFeed(feedResponse.text, feedResponse.url);
        if (discoveredFeed) {
          return {
            parsed: discoveredFeed,
            feedUrl: discoveredFeed.feedUrl,
            etag: feedResponse.etag,
            lastModified: feedResponse.lastModified,
            notModified: false as const
          };
        }
      }
    }
    throw new Error('No RSS or Atom articles were found at that address.');
  });
