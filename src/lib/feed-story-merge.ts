import type { ParsedFeed } from './feed-utils';

export type FeedStory = {
  id: number;
  source: string;
  feedUrl?: string;
  feedItemId?: string;
  initials: string;
  color: string;
  title: string;
  excerpt: string;
  body?: string;
  time: string;
  publishedAt?: number;
  category: string;
  read: boolean;
  starred: boolean;
  saved: boolean;
  shared: boolean;
  note?: string;
  image: string;
  url: string;
};

const COLORS = ['#d74735', '#427c68', '#80719a', '#315f88', '#c1803d'];

function formatPublishedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just added';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function mergeFeedStories(current: FeedStory[], feed: ParsedFeed) {
  const byIdentity = new Map(current.map((story) => [`${story.feedUrl ?? story.source}\u001f${story.feedItemId ?? story.url}`, story]));
  let nextId = current.reduce((highest, story) => Math.max(highest, story.id), 0) + 1;
  const additions: FeedStory[] = [];
  const updates = new Map<number, Partial<FeedStory>>();

  for (const [index, item] of feed.items.entries()) {
    const identity = `${feed.feedUrl}\u001f${item.id}`;
    const existing = byIdentity.get(identity);
    const publishedAt = item.publishedAt ? Date.parse(item.publishedAt) || undefined : undefined;
    const content: Partial<FeedStory> = {
      source: feed.title,
      feedUrl: feed.feedUrl,
      initials: feed.title.slice(0, 1).toUpperCase(),
      title: item.title,
      excerpt: item.excerpt || 'Open the original article to continue reading.',
      body: item.body,
      feedItemId: item.id,
      time: publishedAt ? formatPublishedDate(item.publishedAt) : existing?.time ?? 'Just added',
      publishedAt: publishedAt ?? existing?.publishedAt,
      url: item.url
    };

    if (existing) {
      updates.set(existing.id, content);
      continue;
    }

    const id = nextId++;
    additions.push({
      id,
      ...(content as Omit<FeedStory, 'id' | 'color' | 'category' | 'read' | 'starred' | 'saved' | 'shared' | 'image'>),
      color: COLORS[(id + index) % COLORS.length],
      category: 'From feed',
      read: false,
      starred: false,
      saved: false,
      shared: false,
      image: 'garden'
    });
  }

  return {
    stories: [...additions, ...current.map((story) => ({ ...story, ...updates.get(story.id) }))],
    added: additions.length
  };
}
