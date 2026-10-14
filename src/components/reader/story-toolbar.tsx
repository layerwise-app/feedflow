import { CheckCheck, LayoutGrid, List, Menu, Newspaper, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { Kbd } from '~/components/ui/kbd';
import { DAY_MS, scopeSupportsUnreadFilter } from '~/lib/reader-model';
import type { ReaderLayout, SortOrder } from '~/lib/reader-state-utils';
import { cn } from '~/lib/utils';
import { useReader } from './reader-context';
import { Segmented } from './segmented';

const LAYOUT_OPTIONS: Array<{ value: ReaderLayout; label: ReactNode; title: string }> = [
  { value: 'list', label: <List />, title: 'List (1)' },
  { value: 'cards', label: <LayoutGrid />, title: 'Cards (2)' },
  { value: 'magazine', label: <Newspaper />, title: 'Magazine (3)' }
];

export function StoryToolbar() {
  const { state, scope, scopeTitle, stories, counts, query, setQuery, unreadOnly, setUnreadOnly, setNavOpen, actions, searchRef, now } = useReader();
  const unread = stories.filter((story) => !story.read).length;
  const refreshing = actions.refreshing.size > 0;
  const showUnreadFilter = !query && scopeSupportsUnreadFilter(scope);
  const ids = stories.map((story) => story.id);
  const subtitle = query
    ? `${stories.length} ${stories.length === 1 ? 'result' : 'results'}`
    : scope.type === 'view' && scope.view !== 'all'
      ? `${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`
      : unread ? `${unread} unread` : counts.views.all || stories.length ? 'All read' : '';

  return (
    <header className='@container shrink-0 border-b border-border bg-background'>
      <div className='flex h-14 items-center gap-2 px-3 sm:px-5'>
        <Button variant='ghost' size='icon-sm' className='-ml-1 lg:hidden' aria-label='Open feeds' onClick={() => setNavOpen(true)}>
          <Menu />
        </Button>
        <div className='flex min-w-0 flex-1 items-baseline gap-2.5'>
          <h1 className='truncate font-serif text-[1.35rem] leading-tight font-semibold tracking-[-0.015em]'>{scopeTitle}</h1>
          {subtitle && <span className='hidden shrink-0 text-[13px] text-muted-foreground tabular-nums @[25rem]:inline'>{subtitle}</span>}
        </div>
        <div className='relative w-32 shrink-0 @md:w-44 @xl:w-60'>
          <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
          <input
            ref={searchRef}
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                if (query) setQuery('');
                event.currentTarget.blur();
              }
            }}
            placeholder='Search'
            aria-label='Search stories'
            className='peer h-8 w-full rounded-md border border-transparent bg-muted pr-8 pl-8 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring/50 focus:bg-card focus:ring-2 focus:ring-ring/20 [&::-webkit-search-cancel-button]:hidden'
          />
          {query ? (
            <button type='button' aria-label='Clear search' onClick={() => setQuery('')} className='absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground'>
              <X className='size-3.5' />
            </button>
          ) : (
            <Kbd className='absolute top-1/2 right-1.5 hidden -translate-y-1/2 bg-card peer-focus:hidden sm:inline-flex'>/</Kbd>
          )}
        </div>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Refresh feeds'
          title='Refresh (r)'
          disabled={refreshing}
          onClick={() => void actions.refreshFeeds()}
        >
          <RefreshCw className={cn(refreshing && 'animate-spin')} />
        </Button>
      </div>

      <div className='flex h-11 items-center gap-2 px-3 sm:px-5'>
        {showUnreadFilter ? (
          <Segmented
            size='sm'
            label='Show'
            value={unreadOnly ? 'unread' : 'all'}
            onChange={(value) => setUnreadOnly(value === 'unread')}
            options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]}
          />
        ) : <span className='text-[13px] text-muted-foreground sm:hidden'>{subtitle}</span>}

        <div className='ml-auto flex items-center gap-1.5'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='sm' className='h-7 gap-1.5 px-2 text-[13px] text-muted-foreground hover:text-foreground' disabled={!unread}>
                <CheckCheck /> <span className='hidden sm:inline'>Mark read</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuItem onSelect={() => actions.markRead(ids)}>
                Mark all as read <DropdownMenuShortcut>⇧A</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.markRead(ids, now - DAY_MS)}>Older than a day</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.markRead(ids, now - 7 * DAY_MS)}>Older than a week</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Segmented size='sm' label='Layout' value={state.layout} onChange={actions.setLayout} options={LAYOUT_OPTIONS} className='[&_svg]:size-3.5!' />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon-xs' className='size-7 text-muted-foreground hover:text-foreground' aria-label='View options'>
                <SlidersHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>Sort</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={state.sortOrder} onValueChange={(value) => actions.setSortOrder(value as SortOrder)}>
                <DropdownMenuRadioItem value='newest'>Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value='oldest'>Oldest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value='relevance'>Best match when searching</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={state.compact} onCheckedChange={(checked) => actions.setCompact(checked === true)}>
                Compact list
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={state.autoMarkRead} onCheckedChange={(checked) => actions.setAutoMarkRead(checked === true)}>
                Mark read on scroll
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
