const MAX_FEED_ITEMS = 40;

export type FeedItem = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  url: string;
  publishedAt: string;
};

export type ParsedFeed = {
  title: string;
  feedUrl: string;
  items: FeedItem[];
};

export type FeedValidators = {
  etag?: string;
  lastModified?: string;
};

export function mergeFeedValidators<T extends FeedValidators>(stored: T, received: FeedValidators): T {
  return {
    ...stored,
    etag: received.etag ?? stored.etag,
    lastModified: received.lastModified ?? stored.lastModified
  };
}

export function createFeedRequestHeaders(validators: FeedValidators = {}) {
  return {
    Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
    'User-Agent': 'Feedflow/1.0 (feed reader)',
    ...(validators.etag ? { 'If-None-Match': validators.etag } : {}),
    ...(validators.lastModified ? { 'If-Modified-Since': validators.lastModified } : {})
  };
}

export function validatePublicFeedUrl(value: string, base?: string) {
  let url: URL;
  try {
    url = base ? new URL(value, base) : new URL(value);
  } catch {
    throw new Error('Enter a valid feed or website URL.');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const localResolutionDomains = [
    'nip.io',
    'sslip.io',
    'xip.io',
    'localtest.me',
    'lvh.me',
    'vcap.me',
    'localhost.direct'
  ];
  const isIpv4Address = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const ipv4Octets = isIpv4Address ? hostname.split('.').map(Number) : [];
  const isPrivateIpv4 = isIpv4Address && (
    ipv4Octets[0] === 0 ||
    ipv4Octets[0] === 10 ||
    ipv4Octets[0] === 127 ||
    (ipv4Octets[0] === 169 && ipv4Octets[1] === 254) ||
    (ipv4Octets[0] === 172 && ipv4Octets[1] >= 16 && ipv4Octets[1] <= 31) ||
    (ipv4Octets[0] === 192 && ipv4Octets[1] === 168) ||
    (ipv4Octets[0] === 100 && ipv4Octets[1] >= 64 && ipv4Octets[1] <= 127) ||
    ipv4Octets[0] >= 224
  );
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    (url.port !== '' && url.port !== '80' && url.port !== '443') ||
    url.username ||
    url.password ||
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.test') ||
    hostname.endsWith('.invalid') ||
    hostname.endsWith('.example') ||
    localResolutionDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ||
    hostname.includes(':') ||
    isPrivateIpv4 ||
    isIpv4Address ||
    !hostname.includes('.')
  ) {
    throw new Error('Use a public HTTPS feed or website URL.');
  }

  return url;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d', middot: '\u00b7', bull: '\u2022', copy: '\u00a9', laquo: '\u00ab', raquo: '\u00bb'
};

function decodeEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    if (token[0] !== '#') return NAMED_ENTITIES[token.toLowerCase()] ?? entity;
    const codePoint = token[1].toLowerCase() === 'x'
      ? Number.parseInt(token.slice(2), 16)
      : Number.parseInt(token.slice(1), 10);
    try {
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
    } catch {
      return '';
    }
  });
}

function decodeNestedEntities(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function decodeXml(value: string) {
  return decodeNestedEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function plainText(value: string) {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<!--[\s\S]*?-->/g, ' ');
  for (let pass = 0; pass < 2; pass += 1) {
    text = decodeNestedEntities(text)
      .replace(/<(script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<(?:br|hr)\b[^>]*\/?\s*>/gi, '\n')
      .replace(/<\/(?:p|div|section|article|blockquote|li|h[1-6]|tr)\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ');
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 12_000);
}

// Image-only items (comics, photo blogs) carry their words in the image's title or alt text.
function imageText(value: string) {
  const markup = decodeNestedEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
  const captions = [...markup.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => {
    const attribute = (name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((part) => part !== undefined) ?? '';
    return decodeNestedEntities(attribute('title') || attribute('alt')).replace(/\s+/g, ' ').trim();
  });
  return [...new Set(captions.filter(Boolean))].join('\n\n').slice(0, 12_000);
}

// WordPress appends "The post <title> first appeared on <site>." to every item summary.
function stripFeedFooter(text: string) {
  return text.replace(/\s*The post .{1,400}? (?:first )?appeared (?:first )?on .{1,200}?\.?$/s, '').trim();
}

// Link blogs often repeat the headline as the first line of the summary.
function stripLeadingTitle(text: string, title: string) {
  const heading = title.trim();
  if (!heading || text.slice(0, heading.length).toLowerCase() !== heading.toLowerCase()) return text;
  const rest = text.slice(heading.length);
  return rest && /^[\s:.–—-]/.test(rest) ? rest.replace(/^[\s:.–—-]+/, '') : text;
}

function tagValue(markup: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markup.match(new RegExp(`<(?:(?:[\\w.-]+):)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`, 'i'));
  return match?.[1] ?? '';
}

function attributeValue(tag: string, attribute: string) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? '';
}

export function parseFeed(markup: string, pageUrl: URL): ParsedFeed | null {
  const channelTitle = tagValue(markup, 'title');
  const rssItems = [...markup.matchAll(/<(?:[\w.-]+:)?item\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?item\s*>/gi)];
  const atomEntries = [...markup.matchAll(/<(?:[\w.-]+:)?entry\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?entry\s*>/gi)];
  const isAtom = atomEntries.length > 0 || /<(?:[\w.-]+:)?feed\b/i.test(markup);
  const entries = isAtom ? atomEntries : rssItems;
  if (!entries.length) return null;

  const items = entries.slice(0, MAX_FEED_ITEMS).map(([, entry]) => {
    const rawTitle = tagValue(entry, 'title');
    const rawDescription = tagValue(entry, 'description') || tagValue(entry, 'summary') || tagValue(entry, 'content:encoded') || tagValue(entry, 'content');
    const links = [...entry.matchAll(/<(?:[\w.-]+:)?link\b[^>]*>/gi)].map(([tag]) => tag);
    const linkTag = links.find((tag) => !attributeValue(tag, 'rel') || attributeValue(tag, 'rel').toLowerCase() === 'alternate') ?? links[0] ?? '';
    const atomId = tagValue(entry, 'id');
    const rssGuidTag = entry.match(/<guid\b[^>]*>[\s\S]*?<\/guid\s*>/i)?.[0] ?? '';
    const rssGuid = tagValue(entry, 'guid');
    const rssGuidIsPermalink = attributeValue(rssGuidTag, 'isPermaLink').toLowerCase() !== 'false';
    const rawUrl = isAtom
      ? attributeValue(linkTag, 'href') || atomId
      : tagValue(entry, 'link') || (/^https?:\/\//i.test(decodeXml(rssGuid)) && rssGuidIsPermalink ? rssGuid : '');
    let itemUrl = pageUrl.href;
    try {
      const parsedUrl = new URL(decodeXml(rawUrl), pageUrl.href);
      itemUrl = ['https:', 'http:'].includes(parsedUrl.protocol) ? parsedUrl.href : pageUrl.href;
    } catch {
      itemUrl = pageUrl.href;
    }
    const title = decodeXml(rawTitle);
    const body = stripLeadingTitle(stripFeedFooter(plainText(rawDescription) || imageText(rawDescription)), title);
    return {
      id: decodeXml(isAtom ? atomId : rssGuid) || itemUrl,
      title: title || 'Untitled article',
      body,
      excerpt: body.slice(0, 360),
      url: itemUrl,
      publishedAt: decodeXml(tagValue(entry, 'pubDate') || tagValue(entry, 'published') || tagValue(entry, 'updated') || tagValue(entry, 'date'))
    };
  });

  return {
    title: decodeXml(isAtom ? channelTitle : tagValue(markup.match(/<(?:[\w.-]+:)?channel\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?channel\s*>/i)?.[1] ?? markup, 'title')) || pageUrl.hostname.replace(/^www\./, ''),
    feedUrl: pageUrl.href,
    items
  };
}

export function findFeedLink(html: string, pageUrl: URL) {
  for (const [tag] of html.matchAll(/<(?:[\w.-]+:)?link\b[^>]*>/gi)) {
    const type = attributeValue(tag, 'type').toLowerCase();
    const rel = attributeValue(tag, 'rel').toLowerCase().split(/\s+/);
    const href = attributeValue(tag, 'href');
    if (!href || !rel.includes('alternate') || !/rss|atom|xml/.test(type)) continue;
    try {
      const discovered = validatePublicFeedUrl(decodeXml(href), pageUrl.href);
      if (discovered.port && discovered.port !== '80' && discovered.port !== '443') continue;
      return discovered;
    } catch {
      continue;
    }
  }
  return null;
}
