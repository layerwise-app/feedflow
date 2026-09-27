import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  Archive,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FolderPlus,
  Globe2,
  Inbox,
  Menu,
  Plus,
  RefreshCw,
  Rss,
  Rows3,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Star,
  Upload,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchFeed } from '~/lib/feed.functions';
import { mergeFeedStories, type FeedStory } from '~/lib/feed-story-merge';
import { mergeFeedValidators, type FeedValidators } from '~/lib/feed-utils';
import { loadReaderState, saveReaderState } from '~/lib/reader-state.functions';
import { createLatestSaveQueue, parseReaderSnapshot, removeLegacyDemoFeeds, removeLegacyDemoStories, shouldImportLegacyReaderState, validateReaderSnapshot } from '~/lib/reader-state-utils';
import { signOut, useSession } from '~/lib/auth-client';
import { getAuthSession } from '~/lib/auth.functions';
import { toast } from 'sonner';
import { seo } from '~/utils/seo';

type Story = FeedStory;

type FeedSubscription = { name: string; url: string } & FeedValidators;

const navItems = [
  { label: 'All items', icon: Inbox, key: 'all' },
  { label: 'Starred', icon: Star, key: 'starred' },
  { label: 'Read later', icon: Bookmark, key: 'later' },
  { label: 'Shared items', icon: Share2, key: 'shared' },
  { label: 'Recently read', icon: Clock3, key: 'read' }
];

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character] ?? character);
}

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: '/sign-in' });
  },
  loader: () => ({
    editionDate: new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(new Date())
  }),
  head: () => ({
    meta: [
      ...seo({
        title: 'Stillread — Your reading, in one place',
        description: 'A quieter place for everything you want to read.'
      })
    ]
  }),
  component: ReaderHome
});

function ReaderHome() {
  const navigate = useNavigate();
  const { editionDate } = Route.useLoaderData();
  const { data: authSession, isPending: authPending } = useSession();
  const currentUserId = authSession?.user.id ?? null;
  const persistenceIdentity = currentUserId ?? 'anonymous';
  const persistenceKey = `stillread:reader:v2:${persistenceIdentity}`;
  const [stories, setStories] = useState<Story[]>([]);
  const [activeView, setActiveView] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [activeFeed, setActiveFeed] = useState('All items');
  const [selectedStory, setSelectedStory] = useState<number | null>(null);
  const [expandedStory, setExpandedStory] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [feedInputOpen, setFeedInputOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedError, setFeedError] = useState('');
  const [feedLoading, setFeedLoading] = useState(false);
  const [feeds, setFeeds] = useState<FeedSubscription[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'relevance'>('newest');
  const [compact, setCompact] = useState(false);
  const [autoMarkRead, setAutoMarkRead] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manageSubscriptionsOpen, setManageSubscriptionsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [feedFolders, setFeedFolders] = useState<Record<string, string>>({});
  const [folderInput, setFolderInput] = useState('');
  const [folderInputOpen, setFolderInputOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cloudAuthenticated, setCloudAuthenticated] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudLoadFailed, setCloudLoadFailed] = useState(false);
  const [cloudRetryRequest, setCloudRetryRequest] = useState(0);
  const [cloudSaveRetryRequest, setCloudSaveRetryRequest] = useState(0);
  const [hydratedIdentity, setHydratedIdentity] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const visibleStoriesRef = useRef<Story[]>([]);
  const persistedStateRef = useRef('');
  const cloudSaveQueuesRef = useRef(new Map<string, ReturnType<typeof createLatestSaveQueue<{ userId: string; state: string; snapshot: string }>>>());
  const activeUserIdRef = useRef<string | null>(currentUserId);
  activeUserIdRef.current = currentUserId;

  function queueCloudSave(state: unknown, userId: string) {
    if (!cloudSaveQueuesRef.current.has(userId)) {
      cloudSaveQueuesRef.current.set(userId, createLatestSaveQueue(async ({ userId: saveUserId, state: serializedState, snapshot }) => {
        try {
          const result = await saveReaderState({ data: { userId: saveUserId, state: serializedState } });
          if (result.authenticated && activeUserIdRef.current === saveUserId) {
            persistedStateRef.current = snapshot;
            setCloudStatus('saved');
          }
        } catch {
          if (activeUserIdRef.current === saveUserId) {
            setCloudStatus('error');
            toast.error('Reader sync failed. Your local reading state is still saved.');
          }
        }
      }));
    }
    void cloudSaveQueuesRef.current.get(userId)!({ userId, state: validateReaderSnapshot(state), snapshot: JSON.stringify(state) });
  }

  useEffect(() => {
    if (authPending) return;
    if (!currentUserId) {
      void navigate({ to: '/sign-in' });
      return;
    }
    let cancelled = false;
    setLoaded(false);
    setCloudReady(false);
    setCloudLoadFailed(false);
    setHydratedIdentity(null);
    persistedStateRef.current = '';
    setStories([]);
    setFeeds([]);
    setFolders([]);
    setFeedFolders({});
    setCompact(false);
    setAutoMarkRead(false);
    setSortOrder('newest');
    const applyState = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const state = value as {
        stories?: Story[];
        feeds?: Array<string | FeedSubscription>;
        folders?: string[];
        feedFolders?: Record<string, string>;
        compact?: boolean;
        autoMarkRead?: boolean;
        sortOrder?: 'newest' | 'oldest' | 'relevance';
      };
      const cleanedStories = Array.isArray(state.stories) ? removeLegacyDemoStories(state.stories) : [];
      if (Array.isArray(state.stories)) setStories(cleanedStories);
      if (Array.isArray(state.feeds)) {
        setFeeds(removeLegacyDemoFeeds(state.feeds.map((feed) => typeof feed === 'string'
          ? { name: feed, url: '' }
          : feed).filter((feed): feed is FeedSubscription => !!feed && typeof feed.name === 'string' && typeof feed.url === 'string'), cleanedStories));
      }
      if (Array.isArray(state.folders)) setFolders(state.folders.filter((folder): folder is string => typeof folder === 'string'));
      if (state.feedFolders && typeof state.feedFolders === 'object') setFeedFolders(state.feedFolders);
      if (typeof state.compact === 'boolean') setCompact(state.compact);
      if (typeof state.autoMarkRead === 'boolean') setAutoMarkRead(state.autoMarkRead);
      if (state.sortOrder === 'newest' || state.sortOrder === 'oldest') setSortOrder(state.sortOrder);
    };

    void (async () => {
      let localState: unknown = null;
      try {
        const saved = localStorage.getItem(persistenceKey);
        localState = saved ? JSON.parse(saved) : null;
      } catch {
        localStorage.removeItem(persistenceKey);
      }
      const migrationKey = 'stillread:reader:legacy-owner';
      let legacyState: unknown = null;
      const migrationOwner = localStorage.getItem(migrationKey);
      if (!localState && shouldImportLegacyReaderState(currentUserId, migrationOwner)) {
        try {
          const savedLegacyState = localStorage.getItem('stillread:reader:v1');
          legacyState = savedLegacyState ? JSON.parse(savedLegacyState) : null;
          localState = legacyState;
        } catch {
          localStorage.removeItem('stillread:reader:v1');
        }
      }

      try {
        const cloud = await loadReaderState({ data: { userId: currentUserId } });
        if (cancelled) return;
        if (!cloud.authenticated) {
          void navigate({ to: '/sign-in' });
          return;
        }
        setCloudAuthenticated(cloud.authenticated);
        setCloudReady(true);
        if (cloud.state) {
          const parsedCloudState = parseReaderSnapshot(cloud.state);
          applyState(parsedCloudState);
          localStorage.setItem(persistenceKey, JSON.stringify({ ...parsedCloudState, stories: removeLegacyDemoStories(parsedCloudState.stories), feeds: removeLegacyDemoFeeds(parsedCloudState.feeds, removeLegacyDemoStories(parsedCloudState.stories)) }));
          if (currentUserId && !migrationOwner) localStorage.setItem(migrationKey, currentUserId);
          persistedStateRef.current = cloud.state;
        } else {
          applyState(localState);
          if (cloud.authenticated && localState) {
            const result = await saveReaderState({ data: { userId: currentUserId, state: validateReaderSnapshot(localState) } });
            if (result.authenticated) {
              setCloudStatus('saved');
              const serializedLocalState = validateReaderSnapshot(localState);
              persistedStateRef.current = serializedLocalState;
              localStorage.setItem(persistenceKey, serializedLocalState);
              if (currentUserId && !migrationOwner) localStorage.setItem(migrationKey, currentUserId);
            }
          }
        }
      } catch {
        if (cancelled) return;
        applyState(localState);
        setCloudAuthenticated(Boolean(currentUserId));
        setCloudReady(false);
        if (currentUserId) {
          setCloudLoadFailed(true);
          setCloudStatus('error');
          toast.error('Could not load your cloud reader state. Local state is preserved.');
        }
      } finally {
        if (!cancelled) {
          setHydratedIdentity(persistenceIdentity);
          setLoaded(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [authPending, cloudRetryRequest, currentUserId, navigate, persistenceIdentity, persistenceKey]);

  useEffect(() => {
    if (!currentUserId || !loaded || hydratedIdentity !== persistenceIdentity) return;
    const state = { stories, feeds, folders, feedFolders, compact, autoMarkRead, sortOrder };
    const serialized = JSON.stringify(state);
    localStorage.setItem(persistenceKey, serialized);
    if (!cloudAuthenticated || !cloudReady || cloudLoadFailed || persistedStateRef.current === serialized) return;

    const timeoutId = window.setTimeout(() => {
      setCloudStatus('saving');
      queueCloudSave(state, currentUserId!);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [autoMarkRead, cloudAuthenticated, cloudLoadFailed, cloudReady, cloudSaveRetryRequest, compact, currentUserId, feedFolders, feeds, folders, hydratedIdentity, loaded, persistenceIdentity, persistenceKey, sortOrder, stories]);

  const visibleStories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = stories.filter((story) => {
      const inView = normalizedQuery
        ? true
        : activeView === 'starred'
          ? story.starred
          : activeView === 'later'
            ? story.saved
            : activeView === 'shared'
              ? story.shared
              : activeView === 'read'
                ? story.read
                : true;
      const matchesReadState = normalizedQuery.length > 0 || !unreadOnly || !story.read;
      const inFeed = normalizedQuery.length > 0 || activeFeed === 'All items' || story.source === activeFeed || (activeFeed.startsWith('folder:') && feedFolders[story.source] === activeFeed.slice(7));
      const matchesQuery = !normalizedQuery || `${story.title} ${story.source} ${story.excerpt} ${story.body ?? ''} ${story.note ?? ''}`.toLowerCase().includes(normalizedQuery);
      return inView && inFeed && matchesQuery && matchesReadState;
    });
    if (sortOrder === 'relevance' && normalizedQuery) {
      const score = (story: Story) => {
        const title = story.title.toLowerCase();
        const source = story.source.toLowerCase();
        const excerpt = story.excerpt.toLowerCase();
        const body = (story.body ?? '').toLowerCase();
        return (title.includes(normalizedQuery) ? 8 : 0)
          + (source.includes(normalizedQuery) ? 5 : 0)
          + (excerpt.includes(normalizedQuery) ? 3 : 0)
          + (body.includes(normalizedQuery) ? 1 : 0);
      };
      return [...filtered].sort((left, right) => score(right) - score(left));
    }
    if (sortOrder === 'relevance' && normalizedQuery) {
      return filtered;
    }
    const dated = filtered.map((story, index) => ({ story, index }));
    dated.sort((left, right) => {
      const leftDate = left.story.publishedAt;
      const rightDate = right.story.publishedAt;
      if (leftDate != null && rightDate != null) return rightDate - leftDate;
      if (leftDate != null) return -1;
      if (rightDate != null) return 1;
      return left.index - right.index;
    });
    const ordered = dated.map(({ story }) => story);
    return sortOrder === 'oldest' ? ordered.reverse() : ordered;
  }, [activeFeed, activeView, feedFolders, query, sortOrder, stories, unreadOnly]);
  visibleStoriesRef.current = visibleStories;

  useEffect(() => {
    if (!autoMarkRead || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const visibleIds = entries
        .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.7)
        .map((entry) => Number((entry.target as HTMLElement).dataset.storyId))
        .filter(Number.isFinite);
      if (!visibleIds.length) return;
      const visibleSet = new Set(visibleIds);
      setStories((current) => current.map((story) => visibleSet.has(story.id) && !story.read ? { ...story, read: true } : story));
    }, { threshold: [0.7] });

    document.querySelectorAll<HTMLElement>('.story-card:not(.is-read)').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [activeFeed, activeView, autoMarkRead, query, sortOrder, unreadOnly, visibleStories]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        const ids = new Set(visibleStoriesRef.current.map((story) => story.id));
        setStories((current) => current.map((story) => ids.has(story.id) ? { ...story, read: true } : story));
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === 's') {
        const story = stories.find((item) => item.id === selectedStory);
        if (story) updateStory(story.id, { shared: !story.shared });
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (['j', 'n', 'arrowdown', 'k', 'p', 'arrowup'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        const direction = ['j', 'n', 'arrowdown'].includes(event.key.toLowerCase()) ? 1 : -1;
        const currentStories = visibleStoriesRef.current;
        const currentIndex = currentStories.findIndex((story) => story.id === selectedStory);
        const nextIndex = currentIndex < 0
          ? direction > 0 ? 0 : currentStories.length - 1
          : Math.max(0, Math.min(currentStories.length - 1, currentIndex + direction));
        const nextStory = currentStories[nextIndex];
        if (nextStory) {
          setSelectedStory(nextStory.id);
          setExpandedStory(null);
          document.querySelector(`[data-story-id="${nextStory.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else if (selectedStory && event.key.toLowerCase() === 's') {
        const story = stories.find((item) => item.id === selectedStory);
        if (story) updateStory(story.id, { starred: !story.starred });
      } else if (selectedStory && event.key.toLowerCase() === 'm') {
        const story = stories.find((item) => item.id === selectedStory);
        if (story) updateStory(story.id, { read: !story.read });
      } else if (selectedStory && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        setExpandedStory((current) => current === selectedStory ? null : selectedStory);
      } else if (selectedStory && event.key.toLowerCase() === 'v') {
        const story = stories.find((item) => item.id === selectedStory);
        if (story) window.open(story.url, '_blank', 'noopener,noreferrer');
      } else if (event.key.toLowerCase() === 'r') {
        void refreshSubscriptions();
      } else if (event.key.toLowerCase() === 'a') {
        setFeedInputOpen(true);
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="Feed URL"]')?.focus(), 0);
      } else if (event.key === '?') {
        setHelpOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [selectedStory, stories]);

  const headingTitle = query.trim()
    ? 'Search results'
    : activeView === 'starred'
    ? 'Starred'
    : activeView === 'later'
      ? 'Read later'
      : activeView === 'shared'
        ? 'Shared items'
        : activeView === 'read'
          ? 'Recently read'
          : activeFeed.startsWith('folder:')
            ? activeFeed.slice(7)
            : activeFeed;

  function updateStory(id: number, update: Partial<Story>) {
    setStories((current) => current.map((story) => story.id === id ? { ...story, ...update } : story));
  }

  function selectView(key: string) {
    setActiveView(key);
    setActiveFeed('All items');
    setUnreadOnly(false);
    setSelectedStory(null);
    setExpandedStory(null);
    setUnreadOnly(false);
    setMobileSidebarOpen(false);
  }

  async function addFeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = feedUrl.trim();
    if (!value || feedLoading || refreshing) return;
    setFeedLoading(true);
    setFeedError('');
    try {
      const result = await fetchFeed({ data: { url: value } });
      const parsedFeed = result.parsed;
      if (!parsedFeed) throw new Error('The feed returned an empty 304 response. Try refreshing it.');
      const name = parsedFeed.title;
      setFeeds((current) => current.some((feed) => feed.name === name)
        ? current.map((feed) => feed.name === name ? { ...feed, url: result.feedUrl, etag: result.etag, lastModified: result.lastModified } : feed)
        : [...current, { name, url: result.feedUrl, etag: result.etag, lastModified: result.lastModified }]);
      setStories((current) => {
        return mergeFeedStories(current, parsedFeed).stories;
      });
      setActiveFeed(name);
      setActiveView('all');
      setSelectedStory(null);
      setExpandedStory(null);
      setFeedUrl('');
      setFeedInputOpen(false);
      setMobileSidebarOpen(false);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Could not load that feed. Try an RSS or Atom URL.');
    } finally {
      setFeedLoading(false);
    }
  }

  async function refreshSubscriptions() {
    if (refreshing || feedLoading) return;
    const refreshable = feeds.filter((feed) => feed.url);
    if (!refreshable.length) {
      setRefreshMessage('Add a feed URL to refresh subscriptions.');
      return;
    }
    setRefreshing(true);
    setRefreshMessage('Refreshing subscriptions…');
    const failures: string[] = [];
    const results = await Promise.all(refreshable.map(async (feed) => {
      try {
        const response = await fetchFeed({ data: { url: feed.url, etag: feed.etag, lastModified: feed.lastModified } });
        return { previousName: feed.name, response };
      } catch {
        failures.push(feed.name);
        return null;
      }
    }));
    const successful = results.filter((result): result is NonNullable<typeof result> => result !== null);
    const updated = successful.filter(({ response }) => response.parsed !== null);
    const renames = new Map(updated.flatMap(({ previousName, response }) => response.parsed ? [[previousName, response.parsed.title] as const] : []));
    setFeeds((current) => current.map((feed) => {
      const refreshedFeed = successful.find((result) => result.previousName === feed.name);
      if (!refreshedFeed) return feed;
      const validators = mergeFeedValidators(feed, refreshedFeed.response);
      return {
        ...validators,
        name: refreshedFeed.response.parsed?.title ?? feed.name,
        url: refreshedFeed.response.feedUrl
      };
    }).filter((feed, index, all) => all.findIndex((candidate) => candidate.name === feed.name) === index));
    const existingStoryIds = new Set(stories.map((story) => story.id));
    let updatedCount = 0;
    setStories((current) => {
      let merged = current;
      for (const { response } of updated) {
        if (!response.parsed) continue;
        const result = mergeFeedStories(merged, response.parsed);
        updatedCount += result.stories.filter((story) => !existingStoryIds.has(story.id)).length;
        for (const story of result.stories) existingStoryIds.add(story.id);
        merged = result.stories;
      }
      return merged.map((story) => ({ ...story, source: renames.get(story.source) ?? story.source }));
    });
    setFeedFolders((current) => Object.fromEntries(Object.entries(current).map(([name, folder]) => [renames.get(name) ?? name, folder])));
    setRefreshing(false);
    setRefreshMessage(failures.length
      ? `Could not refresh ${failures.join(', ')}.`
      : `All caught up${updatedCount ? ` · ${updatedCount} new ${updatedCount === 1 ? 'story' : 'stories'}` : ''}.`);
    window.setTimeout(() => setRefreshMessage(''), 5000);
  }

  function createFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderInput.trim();
    if (!name) return;
    setFolders((current) => current.includes(name) ? current : [...current, name]);
    setFolderInput('');
    setFolderInputOpen(false);
  }

  function exportSubscriptions() {
    const outlines = [...new Set([...folders, ...Object.values(feedFolders)])].map((folder) => {
      const entries = feeds.filter((feed) => (feedFolders[feed.name] ?? '') === folder)
        .map((feed) => `      <outline type="rss" text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" xmlUrl="${escapeXml(feed.url)}" />`).join('\n');
      return `    <outline text="${escapeXml(folder)}" title="${escapeXml(folder)}">\n${entries}\n    </outline>`;
    });
    outlines.push(...feeds.filter((feed) => !feedFolders[feed.name])
      .map((feed) => `    <outline type="rss" text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" xmlUrl="${escapeXml(feed.url)}" />`));
    const documentText = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>Stillread subscriptions</title></head><body>\n${outlines}\n</body></opml>`;
    const download = URL.createObjectURL(new Blob([documentText], { type: 'text/x-opml' }));
    const anchor = document.createElement('a');
    anchor.href = download;
    anchor.download = 'stillread-subscriptions.opml';
    anchor.click();
    URL.revokeObjectURL(download);
  }

  async function importSubscriptions(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('OPML files must be smaller than 1 MB.');
      const xml = new DOMParser().parseFromString(await file.text(), 'application/xml');
      if (xml.querySelector('parsererror') || xml.documentElement.tagName.toLowerCase() !== 'opml') {
        throw new Error('That file is not a valid OPML document.');
      }
      const candidates = [...xml.querySelectorAll('outline')].map((outline) => {
        const urlAttribute = [...outline.attributes].find((attribute) => attribute.name.toLowerCase() === 'xmlurl');
        const nameAttribute = [...outline.attributes].find((attribute) => ['title', 'text'].includes(attribute.name.toLowerCase()));
        const parentFolder = outline.parentElement?.closest('outline');
        const parentName = parentFolder && [...parentFolder.attributes].find((attribute) => ['title', 'text'].includes(attribute.name.toLowerCase()))?.value;
        return urlAttribute?.value ? { url: urlAttribute.value, name: nameAttribute?.value || urlAttribute.value, folder: parentName } : null;
      }).filter((item): item is { url: string; name: string; folder: string | undefined } => item !== null);
      if (!candidates.length) throw new Error('No feed URLs were found in that OPML file.');
      if (candidates.length > 50) throw new Error('OPML imports are limited to 50 subscriptions at a time.');
      setFeedLoading(true);
      let imported = 0;
      const errors: string[] = [];
      const outcomes: Array<{ candidate: (typeof candidates)[number]; response: Awaited<ReturnType<typeof fetchFeed>> | null }> = [];
      for (let index = 0; index < candidates.length; index += 5) {
        const batch = candidates.slice(index, index + 5);
        const results = await Promise.all(batch.map(async (candidate) => {
          try {
            return { candidate, response: await fetchFeed({ data: { url: candidate.url } }) };
          } catch {
            errors.push(candidate.name);
            return { candidate, response: null };
          }
        }));
        outcomes.push(...results);
      }
      const successful = outcomes.filter((outcome): outcome is { candidate: (typeof candidates)[number]; response: NonNullable<typeof outcome.response> } => outcome.response !== null);
      const importedFeeds = successful.filter(({ response }) => response.parsed !== null);
      const currentUrls = new Set(feeds.map((feed) => feed.url));
      imported = successful.filter(({ response }) => response.parsed !== null && !currentUrls.has(response.feedUrl)).length;
      setFeeds((current) => {
        const byName = new Map(current.map((feed) => [feed.name, feed]));
        for (const { response } of successful) {
          const existing = [...byName.values()].find((feed) => feed.url === response.feedUrl);
          if (response.parsed) {
            byName.set(response.parsed.title, { name: response.parsed.title, url: response.feedUrl, etag: response.etag, lastModified: response.lastModified });
          } else if (existing) {
            byName.set(existing.name, { ...existing, etag: response.etag, lastModified: response.lastModified });
          }
        }
        return [...byName.values()];
      });
      setFolders((current) => [...new Set([...current, ...importedFeeds.flatMap(({ candidate }) => candidate.folder ? [candidate.folder] : [])])]);
      setFeedFolders((current) => {
        const next = { ...current };
        for (const { candidate, response } of importedFeeds) if (candidate.folder && response.parsed) next[response.parsed.title] = candidate.folder;
        return next;
      });
      setStories((current) => {
        return importedFeeds.reduce((merged, { response }) => response.parsed ? mergeFeedStories(merged, response.parsed).stories : merged, current);
      });
      setFeedError(errors.length ? `Could not import ${errors.join(', ')}.` : '');
      setRefreshMessage(errors.length ? `Imported feeds with ${errors.length} error${errors.length === 1 ? '' : 's'}.` : `Imported ${imported} subscriptions.`);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Could not read that OPML file.');
    } finally {
      setFeedLoading(false);
      input.value = '';
    }
  }

  return (
    <div className='reader-shell'>
      <header className='reader-topbar'>
        <button className='reader-mobile-menu icon-button' aria-label={mobileSidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileSidebarOpen} onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
          <Menu size={19} />
        </button>
        <a className='reader-brand' href='/' aria-label='Stillread home'>
          <span className='brand-mark'><Rss size={19} strokeWidth={2.4} /></span>
          <span>still<span>read</span></span>
        </a>
        <div className='reader-search'>
          <Search size={17} />
          <input ref={searchRef} aria-label='Search your reading' placeholder='Search your reading' value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button className='search-clear' aria-label='Clear search' onClick={() => setQuery('')}><X size={15} /></button>}
          <kbd>⌘ K</kbd>
        </div>
        <div className='topbar-actions'>
          <button className='icon-button quiet-action' title='Keyboard shortcuts' aria-label='Keyboard shortcuts' onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button>
          <button className='icon-button quiet-action' title='Reader settings' aria-label='Reader settings' onClick={() => setSettingsOpen((open) => !open)}><Settings2 size={18} /></button>
          <button className='profile-avatar' title='Account and sync' aria-label='Account and sync' aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>{authSession?.user.name?.slice(0, 1).toUpperCase() || 'J'}</button>
        </div>
      </header>

      <div className='reader-layout'>
        <aside className={`reader-sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
          <button className='add-subscription' onClick={() => setFeedInputOpen(true)}><Plus size={17} /> Add a subscription</button>
          {feedInputOpen && (
            <form className='feed-input-form' onSubmit={addFeed}>
              <input autoFocus aria-label='Feed URL' placeholder='Paste a feed URL' value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} />
              <button aria-label='Add feed' type='submit' disabled={feedLoading}><Check size={15} /></button>
              <button aria-label='Cancel' type='button' disabled={feedLoading} onClick={() => { setFeedInputOpen(false); setFeedError(''); }}><X size={15} /></button>
            </form>
          )}
          {feedError && <div className='feed-error' role='alert'>{feedError}</div>}
          <div className='opml-actions'><label><Upload size={13} /> Import OPML<input aria-label='Import OPML subscriptions' type='file' accept='.opml,.xml,text/xml,application/xml' onChange={importSubscriptions} disabled={feedLoading} /></label><button onClick={exportSubscriptions}><Download size={13} /> Export OPML</button></div>

          <div className='sidebar-section-label'>YOUR READING</div>
          <nav className='sidebar-nav' aria-label='Reading views'>
            {navItems.map(({ label, icon: Icon, key }) => {
              const count = key === 'all'
                ? stories.filter((story) => !story.read).length
                : key === 'starred'
                  ? stories.filter((story) => story.starred).length
                : key === 'later'
                    ? stories.filter((story) => story.saved).length
                    : key === 'shared'
                      ? stories.filter((story) => story.shared).length
                      : stories.filter((story) => story.read).length;
              return (
              <button key={key} className={`sidebar-link ${activeView === key && activeFeed === 'All items' ? 'active' : ''}`} onClick={() => selectView(key)}>
                <Icon size={17} strokeWidth={1.8} /> <span>{label}</span>{count > 0 && <span className='nav-count'>{count}</span>}
              </button>
              );
            })}
          </nav>

          <div className='sidebar-feed-heading'>
            <div className='sidebar-section-label'>FOLDERS <span>{folders.length}</span></div>
            <button className='tiny-icon-button' aria-label='Create a folder' onClick={() => setFolderInputOpen((open) => !open)}><Plus size={16} /></button>
          </div>
          {folderInputOpen && <form className='folder-input-form' onSubmit={createFolder}><input autoFocus aria-label='Folder name' placeholder='Name this folder' value={folderInput} onChange={(event) => setFolderInput(event.target.value)} /><button aria-label='Create folder' type='submit'><Check size={14} /></button><button aria-label='Cancel' type='button' onClick={() => { setFolderInput(''); setFolderInputOpen(false); }}><X size={14} /></button></form>}
          <nav className='feed-nav folder-nav' aria-label='Folders'>
            {folders.map((folder) => <button key={folder} className={`feed-link ${activeFeed === `folder:${folder}` ? 'active' : ''}`} onClick={() => { setActiveFeed(`folder:${folder}`); setActiveView('all'); setSelectedStory(null); setExpandedStory(null); setMobileSidebarOpen(false); }}><FolderPlus size={16} /><span className='feed-name'>{folder}</span><span className='feed-unread'>{stories.filter((story) => feedFolders[story.source] === folder && !story.read).length}</span></button>)}
          </nav>
          <div className='sidebar-feed-heading'>
            <div className='sidebar-section-label'>SUBSCRIPTIONS <span>{feeds.length}</span></div>
            <button className='tiny-icon-button' aria-label='Add a subscription' onClick={() => setFeedInputOpen(true)}><Plus size={16} /></button>
          </div>
          <nav className='feed-nav' aria-label='Subscriptions'>
            {feeds.map((feed, index) => {
              const colors = ['#d74735', '#427c68', '#80719a', '#315f88', '#c1803d'];
              const initials = feed.name.slice(0, 1).toUpperCase();
              return (
                  <button key={feed.name} className={`feed-link ${activeFeed === feed.name ? 'active' : ''}`} onClick={() => { setActiveFeed(feed.name); setActiveView('all'); setUnreadOnly(false); setSelectedStory(null); setExpandedStory(null); setMobileSidebarOpen(false); }}>
                  <span className='feed-favicon' style={{ backgroundColor: colors[index % colors.length] }}>{initials}</span>
                  <span className='feed-name'>{feed.name}</span>
                  {stories.filter((story) => story.source === feed.name && !story.read).length > 0 && <span className='feed-unread'>{stories.filter((story) => story.source === feed.name && !story.read).length}</span>}
                </button>
              );
            })}
          </nav>
          <button className='manage-folders' onClick={() => setManageSubscriptionsOpen(true)}><FolderPlus size={16} /> Manage subscriptions</button>
          <button className='manage-folders mobile-sidebar-action' onClick={() => { setHelpOpen(true); setMobileSidebarOpen(false); }}><CircleHelp size={16} /> Keyboard shortcuts</button>
          <button className='manage-folders mobile-sidebar-action' onClick={() => { setSettingsOpen((open) => !open); setMobileSidebarOpen(false); }}><Settings2 size={16} /> Reader settings</button>
          <div className='sidebar-bottom-note'><Sparkles size={15} /><span>A little space to<br />read at your pace.</span></div>
        </aside>

        {mobileSidebarOpen && <button className='sidebar-scrim' aria-label='Close navigation' onClick={() => setMobileSidebarOpen(false)} />}

        <main className='reader-main'>
          <div className='content-toolbar'>
              <div className='breadcrumbs'><span>Reading</span><ChevronRight size={14} /><strong>{headingTitle}</strong><ChevronDown size={14} /></div>
            <div className='toolbar-actions'>
          <button className='toolbar-button' onClick={() => { const ids = new Set(visibleStories.map((story) => story.id)); setStories((current) => current.map((story) => ids.has(story.id) ? { ...story, read: true } : story)); }}><Check size={15} /><span>Mark all as read</span></button>
              <span className='toolbar-divider' />
              <button className='toolbar-button icon-only' title={refreshing ? 'Refreshing subscriptions' : 'Refresh subscriptions'} aria-label={refreshing ? 'Refreshing subscriptions' : 'Refresh subscriptions'} disabled={refreshing} onClick={refreshSubscriptions}><RefreshCw className={refreshing ? 'is-spinning' : ''} size={17} /></button>
              <button className='toolbar-button icon-only' title={`Sort: ${sortOrder}${sortOrder === 'relevance' && !query.trim() ? ' (search to rank relevance)' : ''}`} aria-label={`Sort: ${sortOrder}`} onClick={() => setSortOrder((order) => order === 'newest' ? 'oldest' : order === 'oldest' ? 'relevance' : 'newest')}>{sortOrder === 'newest' ? <ArrowDownWideNarrow size={17} /> : sortOrder === 'oldest' ? <ArrowUpWideNarrow size={17} /> : <Sparkles size={17} />}</button>
              <button className='toolbar-button icon-only' title={compact ? 'Comfortable spacing' : 'Compact spacing'} aria-label={compact ? 'Comfortable spacing' : 'Compact spacing'} onClick={() => setCompact((value) => !value)}><Rows3 size={18} /></button>
            </div>
          </div>
          {refreshMessage && <div className='refresh-message' role='status'>{refreshMessage}</div>}

          <section className='feed-heading'>
            <div>
              <div className='eyebrow'><span className='live-dot' /> TODAY&apos;S EDITION <span className='edition-date'>· {editionDate.toUpperCase()}</span></div>
              <h1>{headingTitle}</h1>
              <p>{query.trim() ? `Across all subscriptions for “${query.trim()}”.` : headingTitle === 'All items' ? 'A few good things, gathered in one place.' : activeView === 'starred' || activeView === 'later' || activeView === 'shared' || activeView === 'read' ? 'A collection for the things worth keeping.' : `The latest from ${headingTitle}.`}</p>
            </div>
            <div className='unread-pill'><span>{visibleStories.filter((story) => !story.read).length}</span> unread</div>
          </section>

          <div className='feed-tabs' role='tablist' aria-label='Filter articles'>
              <button role='tab' aria-selected={!unreadOnly} className={!unreadOnly ? 'selected' : ''} onClick={() => setUnreadOnly(false)}>All stories</button>
              <button role='tab' aria-selected={unreadOnly} className={unreadOnly ? 'selected' : ''} onClick={() => setUnreadOnly(true)}>Unread <span>{stories.filter((story) => (activeFeed === 'All items' || story.source === activeFeed || (activeFeed.startsWith('folder:') && feedFolders[story.source] === activeFeed.slice(7))) && !story.read).length}</span></button>
            <div className='feed-tabs-spacer' />
            <span className='story-count'>{visibleStories.length} stories</span>
          </div>

          <div className={`story-list ${compact ? 'compact-list' : ''}`}>
            {visibleStories.map((story) => (
              <article key={story.id} data-story-id={story.id} className={`story-card ${story.read ? 'is-read' : ''} ${selectedStory === story.id ? 'is-selected' : ''} ${expandedStory === story.id ? 'is-expanded' : ''}`}>
                <button className='story-main' aria-expanded={expandedStory === story.id} onClick={() => { setSelectedStory(story.id); setExpandedStory(expandedStory === story.id ? null : story.id); updateStory(story.id, { read: true }); }}>
                  <span className='unread-indicator' />
                  <span className='story-copy'>
                    <span className='story-meta'><span className='source-dot' style={{ backgroundColor: story.color }}>{story.initials}</span><strong>{story.source}</strong><span className='meta-separator'>·</span><span>{story.time}</span></span>
                    <span className='story-title'>{story.title}</span>
                    <span className='story-excerpt'>{story.excerpt}</span>
                    <span className='story-category'>{story.category}</span>
                  </span>
                  <span className={`story-art art-${story.image}`} aria-hidden='true'><span>{story.category}</span></span>
                </button>
                <div className='story-actions'>
                  <button aria-label={story.starred ? 'Remove star' : 'Star article'} title={story.starred ? 'Remove star' : 'Star article'} className={story.starred ? 'starred' : ''} onClick={() => updateStory(story.id, { starred: !story.starred })}><Star size={16} fill={story.starred ? 'currentColor' : 'none'} /></button>
                  <button aria-label={story.read ? 'Mark unread' : 'Mark read'} title={story.read ? 'Mark unread' : 'Mark read'} onClick={() => updateStory(story.id, { read: !story.read })}>{story.read ? <Archive size={16} /> : <Check size={16} />}</button>
                  <button aria-label={story.saved ? 'Remove from read later' : 'Save for later'} title={story.saved ? 'Remove from read later' : 'Save for later'} className={story.saved ? 'starred' : ''} onClick={() => updateStory(story.id, { saved: !story.saved })}><Bookmark size={15} fill={story.saved ? 'currentColor' : 'none'} /></button>
                  <button aria-label={story.shared ? 'Remove from shared items' : 'Share item'} title={story.shared ? 'Remove from shared items' : 'Share item'} className={story.shared ? 'starred' : ''} onClick={() => updateStory(story.id, { shared: !story.shared })}><Share2 size={15} /></button>
                </div>
                {expandedStory === story.id && (
                  <div className='article-expanded'>
                    <div className='article-byline'>FROM <strong>{story.source.toUpperCase()}</strong><span>IN YOUR READER</span></div>
                    <h2 className='article-title'>{story.title}</h2>
                    {(story.body || story.excerpt).split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={`${story.id}-paragraph-${index}`}>{paragraph}</p>)}
                    <label className='story-note-label' htmlFor={`story-note-${story.id}`}>YOUR NOTE</label>
                    <textarea id={`story-note-${story.id}`} className='story-note' aria-label={`Your note on ${story.title}`} placeholder='Add a private note to remember why this mattered…' value={story.note ?? ''} onChange={(event) => updateStory(story.id, { note: event.target.value })} />
                    <div className='article-footer'><button className={story.shared ? 'is-shared' : ''} onClick={() => updateStory(story.id, { shared: !story.shared })}><Share2 size={15} /> {story.shared ? 'Shared with your readers' : 'Share item'}</button><button onClick={async () => { try { await navigator.clipboard.writeText(`${story.title} — ${story.url}`); setShareCopied(true); window.setTimeout(() => setShareCopied(false), 1800); } catch { setShareCopied(false); } }}><Copy size={15} /> {shareCopied ? 'Link copied' : 'Copy link'}</button><a href={story.url} target='_blank' rel='noreferrer'><ExternalLink size={15} /> Original article</a><button className='save-later' onClick={() => updateStory(story.id, { saved: !story.saved })}><Bookmark size={15} /> {story.saved ? 'Saved for later' : 'Save for later'}</button></div>
                  </div>
                )}
              </article>
            ))}
            {loaded && visibleStories.length === 0 && <div className='empty-state'><Globe2 size={24} /><strong>No stories here just yet</strong><span>{feeds.length === 0 ? 'Add a subscription or import an OPML file to start reading.' : 'Try another feed or clear your search.'}</span></div>}
          </div>
          <footer className='reader-footer'><span>YOU’RE ALL CAUGHT UP</span><span className='footer-sparkle'>✳</span><span>Take a breath. The internet can wait.</span></footer>
        </main>

        <aside className='right-rail'>
          <div className='rail-date'>TODAY<br /><strong>{editionDate.split(', ').slice(1).join(', ').toUpperCase()}</strong></div>
          <div className='rail-divider' />
          <div className='rail-note'><span className='rail-note-icon'><Clock3 size={16} /></span><strong>Make time<br />for a good read.</strong><p>Your subscriptions are ready when you are.</p></div>
          <div className='rail-bottom'><Globe2 size={16} /><span>Reading from<br /><strong>everywhere</strong></span></div>
        </aside>
      </div>
      {profileMenuOpen && <div className='reader-popover profile-popover'><div className='popover-heading'>{authSession?.user.name || 'Stillread account'}<button aria-label='Close account menu' onClick={() => setProfileMenuOpen(false)}><X size={15} /></button></div><p className='profile-email'>{authSession?.user.email}</p><div className={`sync-state sync-${cloudStatus}`}><span />{!cloudReady ? 'Loading account library' : cloudStatus === 'saving' ? 'Syncing reader state' : cloudStatus === 'saved' ? 'Saved to this account' : cloudLoadFailed ? 'Could not load cloud reader state' : cloudStatus === 'error' ? 'Cloud save failed; local state is safe' : 'Reader state is local'}</div>{cloudLoadFailed && <button className='profile-menu-action' onClick={() => { setCloudStatus('idle'); setCloudRetryRequest((value) => value + 1); }}>Retry cloud load</button>}{cloudStatus === 'error' && !cloudLoadFailed && <button className='profile-menu-action' onClick={() => { setCloudStatus('saving'); setCloudSaveRetryRequest((value) => value + 1); }}>Retry cloud save</button>}<button className='profile-menu-action' onClick={async () => { const result = await signOut(); if (result.error) { toast.error(result.error.message ?? 'Could not sign out.'); return; } setProfileMenuOpen(false); await navigate({ to: '/sign-in' }); }}>Sign out</button></div>}
      {settingsOpen && <div className='reader-popover settings-popover'><div className='popover-heading'>Reader settings <button aria-label='Close settings' onClick={() => setSettingsOpen(false)}><X size={15} /></button></div><label><span>Title-only list view</span><input type='checkbox' checked={compact} onChange={(event) => setCompact(event.target.checked)} /></label><p>Hide summaries and thumbnails until you open a story.</p><label><span>Mark read while scrolling</span><input type='checkbox' checked={autoMarkRead} onChange={(event) => setAutoMarkRead(event.target.checked)} /></label><p>Mark an unread story after most of it is visible.</p></div>}
      {helpOpen && <div className='reader-dialog-backdrop' onClick={() => setHelpOpen(false)}><section className='reader-dialog' role='dialog' aria-modal='true' aria-labelledby='shortcuts-title' onClick={(event) => event.stopPropagation()}><button className='dialog-close' aria-label='Close shortcuts' onClick={() => setHelpOpen(false)}><X size={17} /></button><span className='dialog-kicker'>A FEW HANDY KEYS</span><h2 id='shortcuts-title'>Read at your pace.</h2><div className='shortcut-list'><span>Next / previous story</span><kbd>J</kbd><kbd>K</kbd><span>Scan next / previous</span><kbd>N</kbd><kbd>P</kbd><span>Open selected story</span><kbd>O</kbd><span>Open original article</span><kbd>V</kbd><span>Star / share selected</span><kbd>S</kbd><kbd>⇧ S</kbd><span>Mark read / unread</span><kbd>M</kbd><span>Mark visible as read</span><kbd>⇧ A</kbd><span>Add / refresh feed</span><kbd>A</kbd><kbd>R</kbd><span>Search</span><kbd>/</kbd><kbd>⌘ K</kbd><span>Shortcuts help</span><kbd>?</kbd></div></section></div>}
          {manageSubscriptionsOpen && <div className='reader-dialog-backdrop' onClick={() => setManageSubscriptionsOpen(false)}><section className='reader-dialog subscription-dialog' role='dialog' aria-modal='true' aria-labelledby='subscriptions-title' onClick={(event) => event.stopPropagation()}><button className='dialog-close' aria-label='Close subscriptions' onClick={() => setManageSubscriptionsOpen(false)}><X size={17} /></button><span className='dialog-kicker'>YOUR READING LIST</span><h2 id='subscriptions-title'>Manage subscriptions</h2><div className='subscription-manager'>{feeds.map((feed) => <div key={feed.name}><span>{feed.name}</span><span>{stories.filter((story) => story.source === feed.name).length} stories</span><select aria-label={`Move ${feed.name} to folder`} value={feedFolders[feed.name] ?? ''} onChange={(event) => setFeedFolders((current) => ({ ...current, [feed.name]: event.target.value }))}><option value=''>No folder</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select><button aria-label={`Unsubscribe from ${feed.name}`} onClick={() => { setFeeds((current) => current.filter((item) => item.name !== feed.name)); setStories((current) => current.filter((story) => story.source !== feed.name)); setFeedFolders((current) => { const next = { ...current }; delete next[feed.name]; return next; }); if (activeFeed === feed.name) setActiveFeed('All items'); }}>Unsubscribe</button></div>)}{folders.map((folder) => <div key={`folder-${folder}`}><span>Folder: {folder}</span><button aria-label={`Delete ${folder} folder`} onClick={() => { setFolders((current) => current.filter((item) => item !== folder)); setFeedFolders((current) => Object.fromEntries(Object.entries(current).filter(([, assigned]) => assigned !== folder))); if (activeFeed === `folder:${folder}`) setActiveFeed('All items'); }}>Delete folder</button></div>)}{feeds.length === 0 && <p>No subscriptions yet. Add a public RSS or Atom feed to get started.</p>}</div><button className='manager-add-button' onClick={() => { setManageSubscriptionsOpen(false); setFeedInputOpen(true); }}> <Plus size={15} /> Add a subscription</button></section></div>}
    </div>
  );
}
