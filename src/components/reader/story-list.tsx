import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import type { Story } from '~/lib/reader-model';
import { cn } from '~/lib/utils';
import { useReader, type ReaderContextValue } from './reader-context';
import { MagazineItem, MagazineLead, StoryCard, StoryRow } from './story-items';

export function StoryList({ onSeen }: { onSeen: (ids: number[]) => void }) {
  const reader = useReader();
  const { state, stories, scope, query, selectedId, openId, mode } = reader;
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeId = selectedId ?? openId;
  const scopeKey = `${JSON.stringify(scope)}|${query}|${state.layout}`;
  const idsKey = stories.map((story) => story.id).join(',');
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scopeKey]);

  useEffect(() => {
    if (activeId === null) return;
    scrollRef.current?.querySelector(`[data-story-id="${activeId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  // Mark stories read once they scroll past the top edge of the list.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !state.autoMarkRead || !idsKey) return;
    let pending: number[] = [];
    let timer = 0;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting || !entry.rootBounds || entry.boundingClientRect.bottom > entry.rootBounds.top) continue;
        pending.push(Number((entry.target as HTMLElement).dataset.storyId));
      }
      if (!pending.length) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        onSeenRef.current(pending);
        pending = [];
      }, 250);
    }, { root });
    root.querySelectorAll('[data-story-id]').forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [state.autoMarkRead, idsKey, state.layout]);

  return (
    <div ref={scrollRef} className='relative min-h-0 flex-1 overflow-y-auto overscroll-contain'>
      {stories.length === 0 ? <EmptyState reader={reader} /> : (
        <>
          {state.layout === 'list' && (
            <ul aria-label='Stories'>
              {stories.map((story) => (
                <li key={story.id} data-story-id={story.id}>
                  <StoryRow story={story} selected={story.id === activeId} compact={state.compact} notes={scope.type === 'view' && scope.view === 'notes'} />
                </li>
              ))}
            </ul>
          )}
          {state.layout === 'cards' && (
            <ul aria-label='Stories' className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-4 p-4 sm:p-6'>
              {stories.map((story) => (
                <li key={story.id} data-story-id={story.id} className='flex [&>article]:flex-1'>
                  <StoryCard story={story} selected={story.id === activeId} />
                </li>
              ))}
            </ul>
          )}
          {state.layout === 'magazine' && <Magazine stories={stories} activeId={activeId} />}
          <div aria-hidden='true' className='h-16' />
        </>
      )}
      {mode === 'demo' && (
        <div className='pointer-events-none sticky bottom-4 z-20 flex justify-center px-4'>
          <Link
            to='/sign-up'
            className='pointer-events-auto inline-flex h-8 items-center gap-2 rounded-full bg-foreground py-1 pr-3.5 pl-3 text-[12.5px] font-medium text-background shadow-[0_6px_20px_-6px_rgb(0_0_0/0.35)] outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring'
          >
            <span className='opacity-60'>Demo</span>
            <span aria-hidden='true' className='opacity-40'>·</span>
            Sign up to save
          </Link>
        </div>
      )}
    </div>
  );
}

function Magazine({ stories, activeId }: { stories: Story[]; activeId: number | null }) {
  const [lead, ...rest] = stories;
  const side = rest.slice(0, 3);
  const columns = rest.slice(3);
  return (
    <div className='mx-auto max-w-[68rem] px-5 py-7 sm:px-8 sm:py-10'>
      <div className='grid gap-8 border-b border-foreground/80 pb-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-10'>
        <div data-story-id={lead.id}>
          <MagazineLead story={lead} selected={lead.id === activeId} />
        </div>
        {side.length > 0 && (
          <ul className='divide-y divide-border lg:border-l lg:border-border lg:pl-8'>
            {side.map((story) => (
              <li key={story.id} data-story-id={story.id} className='py-4 first:pt-0 last:pb-0'>
                <MagazineItem story={story} selected={story.id === activeId} size='small' />
              </li>
            ))}
          </ul>
        )}
      </div>
      {columns.length > 0 && (
        <ul className='grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3'>
          {columns.map((story) => (
            <li key={story.id} data-story-id={story.id} className='border-b border-border py-6'>
              <MagazineItem story={story} selected={story.id === activeId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ reader }: { reader: ReaderContextValue }) {
  const { state, scope, query, setQuery, unreadOnly, setUnreadOnly, setScope, setDialog, actions } = reader;
  const allItems = () => setScope({ type: 'view', view: 'all' });
  const content = (() => {
    if (query.trim()) return { line: `No matches for “${query.trim()}”.`, action: 'Clear search', onClick: () => setQuery('') };
    if (!state.feeds.length && !state.stories.length) return { line: 'Your library is empty.', action: 'Discover feeds', onClick: () => setDialog('discover') };
    if (unreadOnly && (scope.type !== 'view' || scope.view === 'all')) return { line: 'All caught up.', action: 'Show all', onClick: () => setUnreadOnly(false) };
    if (scope.type === 'view') {
      const lines = {
        all: 'No stories yet.',
        starred: 'Nothing starred yet.',
        later: 'Nothing saved for later.',
        notes: 'Highlights and notes will gather here.',
        shared: 'Nothing shared yet.',
        read: 'Nothing read yet.'
      } as const;
      return scope.view === 'all'
        ? { line: lines.all, action: 'Refresh', onClick: () => void actions.refreshFeeds() }
        : { line: lines[scope.view], action: 'Browse all items', onClick: allItems };
    }
    return { line: 'No stories here yet.', action: 'Refresh', onClick: () => void actions.refreshFeeds(scope.type === 'feed' ? state.feeds.filter((feed) => feed.name === scope.feed).map((feed) => feed.url) : undefined) };
  })();

  return (
    <div className={cn('flex h-full min-h-72 flex-col items-center justify-center gap-4 px-6 text-center')}>
      <p className='font-serif text-xl text-foreground/80'>{content.line}</p>
      <Button variant='outline' size='sm' onClick={content.onClick}>{content.action}</Button>
    </div>
  );
}
