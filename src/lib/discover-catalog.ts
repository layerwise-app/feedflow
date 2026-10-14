export type DiscoverCategory = 'Tech' | 'Design' | 'Science' | 'News' | 'Culture';

export type DiscoverFeed = {
  name: string;
  url: string;
  site: string;
  description: string;
  category: DiscoverCategory;
};

export const DISCOVER_CATEGORIES: DiscoverCategory[] = ['Tech', 'Design', 'Science', 'News', 'Culture'];

/** Public feeds checked by hand; every URL returns RSS or Atom without a login. */
export const DISCOVER_FEEDS: DiscoverFeed[] = [
  { category: 'Tech', name: 'The Verge', site: 'theverge.com', url: 'https://www.theverge.com/rss/index.xml', description: 'Technology, science, and culture news.' },
  { category: 'Tech', name: 'Ars Technica', site: 'arstechnica.com', url: 'https://feeds.arstechnica.com/arstechnica/index', description: 'In-depth technology reporting and reviews.' },
  { category: 'Tech', name: 'WIRED', site: 'wired.com', url: 'https://www.wired.com/feed/rss', description: 'How technology is changing every part of life.' },
  { category: 'Tech', name: 'MIT Technology Review', site: 'technologyreview.com', url: 'https://www.technologyreview.com/feed/', description: 'Emerging technology and its impact.' },
  { category: 'Tech', name: 'Stratechery', site: 'stratechery.com', url: 'https://stratechery.com/feed/', description: 'Ben Thompson on the business of technology.' },
  { category: 'Tech', name: 'Daring Fireball', site: 'daringfireball.net', url: 'https://daringfireball.net/feeds/main', description: 'John Gruber on Apple, design, and the web.' },
  { category: 'Tech', name: 'Hacker News', site: 'news.ycombinator.com', url: 'https://hnrss.org/frontpage', description: 'The Hacker News front page.' },
  { category: 'Tech', name: 'Simon Willison', site: 'simonwillison.net', url: 'https://simonwillison.net/atom/everything/', description: 'Notes on LLMs, Python, and open source.' },
  { category: 'Tech', name: 'Julia Evans', site: 'jvns.ca', url: 'https://jvns.ca/atom.xml', description: 'Clear explanations of programming topics.' },
  { category: 'Tech', name: 'The Cloudflare Blog', site: 'blog.cloudflare.com', url: 'https://blog.cloudflare.com/rss/', description: 'Engineering deep dives from Cloudflare.' },
  { category: 'Design', name: 'Smashing Magazine', site: 'smashingmagazine.com', url: 'https://www.smashingmagazine.com/feed/', description: 'Practical articles for designers and developers.' },
  { category: 'Design', name: 'A List Apart', site: 'alistapart.com', url: 'https://alistapart.com/main/feed/', description: 'Design, development, and meaning of web content.' },
  { category: 'Design', name: 'Nielsen Norman Group', site: 'nngroup.com', url: 'https://www.nngroup.com/feed/rss/', description: 'Evidence-based user experience research.' },
  { category: 'Design', name: 'Dezeen', site: 'dezeen.com', url: 'https://www.dezeen.com/feed/', description: 'Architecture, interiors, and design news.' },
  { category: 'Design', name: 'Sidebar', site: 'sidebar.io', url: 'https://sidebar.io/feed.xml', description: 'Five design links, every day.' },
  { category: 'Science', name: 'Quanta Magazine', site: 'quantamagazine.org', url: 'https://www.quantamagazine.org/feed/', description: 'Mathematics, physics, biology, and computer science.' },
  { category: 'Science', name: 'NASA', site: 'nasa.gov', url: 'https://www.nasa.gov/news-release/feed/', description: 'News releases from NASA.' },
  { category: 'Science', name: 'ScienceDaily', site: 'sciencedaily.com', url: 'https://www.sciencedaily.com/rss/all.xml', description: 'Latest research news across the sciences.' },
  { category: 'Science', name: 'New Scientist', site: 'newscientist.com', url: 'https://www.newscientist.com/feed/', description: 'Science and technology news.' },
  { category: 'Science', name: 'Phys.org', site: 'phys.org', url: 'https://phys.org/rss-feed/', description: 'Physics, space, and earth science news.' },
  { category: 'News', name: 'BBC News', site: 'bbc.co.uk', url: 'https://feeds.bbci.co.uk/news/rss.xml', description: 'Top stories from the BBC.' },
  { category: 'News', name: 'NPR News', site: 'npr.org', url: 'https://feeds.npr.org/1001/rss.xml', description: 'National and world news from NPR.' },
  { category: 'News', name: 'The Guardian World', site: 'theguardian.com', url: 'https://www.theguardian.com/world/rss', description: 'World news from The Guardian.' },
  { category: 'News', name: 'The New York Times', site: 'nytimes.com', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', description: 'Home page headlines.' },
  { category: 'News', name: 'Al Jazeera', site: 'aljazeera.com', url: 'https://www.aljazeera.com/xml/rss/all.xml', description: 'Breaking news and global coverage.' },
  { category: 'Culture', name: 'The Marginalian', site: 'themarginalian.org', url: 'https://www.themarginalian.org/feed/', description: 'Maria Popova on art, science, and meaning.' },
  { category: 'Culture', name: 'kottke.org', site: 'kottke.org', url: 'https://feeds.kottke.org/main', description: 'Jason Kottke’s long-running link blog.' },
  { category: 'Culture', name: 'Aeon', site: 'aeon.co', url: 'https://aeon.co/feed.rss', description: 'Essays on philosophy, science, and culture.' },
  { category: 'Culture', name: 'Longreads', site: 'longreads.com', url: 'https://longreads.com/feed/', description: 'The best long-form storytelling.' },
  { category: 'Culture', name: 'Open Culture', site: 'openculture.com', url: 'https://www.openculture.com/feed', description: 'Free cultural and educational media.' }
];

/** Feed URLs often change slightly after discovery (redirects, trailing slashes), so compare loosely. */
export function feedUrlKey(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
