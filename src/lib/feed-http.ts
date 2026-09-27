const MAX_FEED_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 5_000;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type FeedValidators = { etag?: string; lastModified?: string };

export type FeedHttpResult = {
  text: string;
  contentType: string;
  url: URL;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
};

type Fetcher = typeof fetch;
type UrlValidator = (value: string, base?: string) => URL;

async function fetchWithRetry(url: URL, deadline: number, validators: FeedValidators, fetcher: Fetcher) {
  let lastNetworkError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Feed lookup took too long. Check the address and try again.');
    try {
      const headers = new Headers({
        Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
        'User-Agent': 'Stillread/1.0 (feed reader)'
      });
      if (validators.etag) headers.set('If-None-Match', validators.etag);
      if (validators.lastModified) headers.set('If-Modified-Since', validators.lastModified);
      const response = await fetcher(url, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining))
      });

      if (!TRANSIENT_STATUSES.has(response.status) || attempt === 1) return response;
      const retryAfter = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
      const waitFromHeader = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : retryAfter ? Date.parse(retryAfter) - Date.now() : Number.NaN;
      const backoff = Math.min(1_500, Number.isFinite(waitFromHeader) && waitFromHeader > 0 ? waitFromHeader : 250 * (2 ** attempt));
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, Math.min(backoff, Math.max(0, deadline - Date.now()))));
    } catch (error) {
      lastNetworkError = error;
      if (attempt === 1 || Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 * (2 ** attempt), Math.max(0, deadline - Date.now()))));
    }
  }

  if (lastNetworkError) throw new Error('Could not reach that feed. Check the address and try again.');
  throw new Error('The feed server is temporarily unavailable. Try again in a moment.');
}

export async function fetchLimitedText(
  url: URL,
  deadline: number,
  initialValidators: FeedValidators = {},
  fetcher: Fetcher = fetch,
  validateUrl: UrlValidator = (value, base) => new URL(value, base)
): Promise<FeedHttpResult> {
  let requestUrl = url;
  let validators = initialValidators;

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetchWithRetry(requestUrl, deadline, validators, fetcher);

    if (response.status === 304) {
      return {
        text: '',
        contentType: response.headers.get('content-type') || '',
        url: requestUrl,
        etag: response.headers.get('etag') || validators.etag,
        lastModified: response.headers.get('last-modified') || validators.lastModified,
        notModified: true
      };
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === 3) throw new Error('The feed redirected too many times.');
      const redirectedUrl = validateUrl(location, requestUrl.href);
      if (redirectedUrl.origin !== requestUrl.origin) validators = {};
      if (!['https:', 'http:'].includes(redirectedUrl.protocol)) throw new Error('The feed redirected to an unsupported address.');
      requestUrl = redirectedUrl;
      continue;
    }

    if (!response.ok) throw new Error(`The server returned ${response.status}.`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_FEED_BYTES) throw new Error('The feed is larger than 1 MB.');
    if (!response.body) throw new Error('The feed response was empty.');

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new Error('The feed is larger than 1 MB.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
      contentType: response.headers.get('content-type') || '',
      url: requestUrl,
      etag: response.headers.get('etag') || undefined,
      lastModified: response.headers.get('last-modified') || undefined,
      notModified: false
    };
  }

  throw new Error('Could not load the feed.');
}
