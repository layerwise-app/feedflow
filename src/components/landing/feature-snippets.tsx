import { Check, ChevronDown, CircleAlert, Download, Highlighter, LayoutGrid, List, Newspaper, Plus, Upload } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FeedMonogram } from '~/components/reader/feed-monogram';
import { Segmented } from '~/components/reader/segmented';
import { Kbd } from '~/components/ui/kbd';
import { DISCOVER_CATEGORIES, DISCOVER_FEEDS } from '~/lib/discover-catalog';
import { formatStoryAge } from '~/lib/reader-format';
import type { Story } from '~/lib/reader-model';
import type { ReaderLayout } from '~/lib/reader-state-utils';
import { cn } from '~/lib/utils';
import { useDisplayTimeZone } from '~/components/use-display-time-zone';

/** Frame shared by every landing snippet so they read as pieces of one product. */
function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-foreground/10 bg-card shadow-[0_1px_1px_rgb(23_23_27/0.04),0_16px_40px_-20px_rgb(23_23_27/0.18)] dark:shadow-none', className)}>
      {children}
    </div>
  );
}

function Key({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <Kbd className={cn(
      'h-8 min-w-8 rounded-md border border-border bg-background px-2 font-sans text-[13px] font-medium text-foreground shadow-[0_2px_0_var(--border)]',
      active && 'border-primary/50 bg-accent text-accent-foreground shadow-[0_1px_0_var(--primary)]'
    )}>
      {children}
    </Kbd>
  );
}

function MiniRow({ story, now, selected }: { story: Story; now: number; selected?: boolean }) {
  const timeZone = useDisplayTimeZone();
  return (
    <div className={cn('relative flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0', selected && 'bg-accent/70')}>
      {selected && <span className='absolute inset-y-0 left-0 w-[3px] bg-primary' />}
      <span className={cn('size-1.5 shrink-0 rounded-full', story.read ? 'bg-transparent' : 'bg-primary')} />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-[11.5px] text-muted-foreground'>{story.source} · {formatStoryAge(story.publishedAt, now, '', timeZone)}</p>
        <p className={cn('truncate font-serif text-[15px]', story.read ? 'text-foreground/65' : 'font-semibold')}>{story.title}</p>
      </div>
    </div>
  );
}

const KEYS: Array<[string, string]> = [['j', 'Next'], ['k', 'Previous'], ['o', 'Open'], ['s', 'Star'], ['l', 'Later'], ['m', 'Read']];

export function KeyboardSnippet({ stories, now }: { stories: Story[]; now: number }) {
  return (
    <Frame>
      <div aria-hidden='true'>
        {stories.slice(0, 4).map((story, index) => <MiniRow key={story.id} story={story} now={now} selected={index === 1} />)}
      </div>
      <div className='grid grid-cols-3 gap-x-2 gap-y-4 border-t border-border bg-background/60 px-4 py-5 sm:grid-cols-6'>
        {KEYS.map(([key, label]) => (
          <div key={key} className='flex flex-col items-center gap-1.5'>
            <Key active={key === 'j'}>{key}</Key>
            <span className='text-[11.5px] text-muted-foreground'>{label}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const LAYOUT_OPTIONS: Array<{ value: ReaderLayout; label: ReactNode; title: string }> = [
  { value: 'list', label: <><List /> List</>, title: 'List' },
  { value: 'cards', label: <><LayoutGrid /> Cards</>, title: 'Cards' },
  { value: 'magazine', label: <><Newspaper /> Magazine</>, title: 'Magazine' }
];

export function LayoutsSnippet({ stories, now }: { stories: Story[]; now: number }) {
  const [layout, setLayout] = useState<ReaderLayout>('cards');
  return (
    <Frame>
      <div className='flex items-center justify-between gap-3 border-b border-border px-4 py-3'>
        <p className='hidden font-serif text-lg font-semibold sm:block'>Science</p>
        <Segmented label='Layout' value={layout} options={LAYOUT_OPTIONS} onChange={setLayout} size='sm' className='w-full sm:w-auto' />
      </div>
      <div aria-live='polite' className='h-[300px] overflow-hidden bg-background/60'>
        {layout === 'list' && (
          <div className='bg-card'>{stories.slice(0, 6).map((story) => <MiniRow key={story.id} story={story} now={now} />)}</div>
        )}
        {layout === 'cards' && (
          <div className='grid grid-cols-2 gap-3 p-4'>
            {stories.slice(0, 4).map((story) => (
              <div key={story.id} className='flex h-[128px] flex-col rounded-lg border border-border bg-card p-3.5'>
                <p className='flex items-center gap-1.5 truncate text-[11px] text-muted-foreground'>
                  <FeedMonogram name={story.source} className='size-3.5 rounded-[3px] text-[8px]' /> {story.source}
                </p>
                <p className={cn('mt-2 line-clamp-3 font-serif text-[14.5px] leading-snug', story.read ? 'text-foreground/65' : 'font-semibold')}>{story.title}</p>
              </div>
            ))}
          </div>
        )}
        {layout === 'magazine' && (
          <div className='p-5'>
            <p className='text-[11.5px] text-muted-foreground'>{stories[0].source} · {formatStoryAge(stories[0].publishedAt, now)}</p>
            <p className='mt-1.5 font-serif text-[1.6rem] leading-[1.1] font-semibold tracking-[-0.02em] text-balance'>{stories[0].title}</p>
            <p className='mt-2 line-clamp-2 font-serif text-[14.5px] leading-relaxed text-foreground/70'>{stories[0].excerpt}</p>
            <div className='mt-4 grid grid-cols-2 gap-5 border-t border-border pt-4'>
              {stories.slice(1, 3).map((story) => (
                <div key={story.id}>
                  <p className='truncate text-[11px] text-muted-foreground'>{story.source}</p>
                  <p className='mt-1 line-clamp-2 font-serif text-[14.5px] leading-snug font-semibold'>{story.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

const DISCOVER_SAMPLE = ['Stratechery', 'Daring Fireball', 'Julia Evans', 'Ars Technica'];

export function DiscoverSnippet() {
  const feeds = DISCOVER_SAMPLE.map((name) => DISCOVER_FEEDS.find((feed) => feed.name === name)!);
  const [subscribed, setSubscribed] = useState<ReadonlySet<string>>(new Set(['Daring Fireball']));
  return (
    <Frame>
      <div className='flex gap-1.5 overflow-hidden border-b border-border px-4 py-3' aria-hidden='true'>
        {['All', ...DISCOVER_CATEGORIES].map((category) => (
          <span key={category} className={cn('h-7 shrink-0 rounded-full border px-3 text-[12.5px] leading-[26px]', category === 'Tech' ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground')}>
            {category}
          </span>
        ))}
      </div>
      <ul className='px-2 py-1.5'>
        {feeds.map((feed) => {
          const isSubscribed = subscribed.has(feed.name);
          return (
            <li key={feed.name} className='flex items-center gap-3 rounded-lg px-2 py-2.5'>
              <FeedMonogram name={feed.name} className='size-8 rounded-lg text-sm' />
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{feed.name}</p>
                <p className='truncate text-[12.5px] text-muted-foreground'>{feed.description}</p>
              </div>
              <button
                type='button'
                aria-pressed={isSubscribed}
                onClick={() => setSubscribed((current) => {
                  const next = new Set(current);
                  if (next.has(feed.name)) next.delete(feed.name);
                  else next.add(feed.name);
                  return next;
                })}
                className={cn(
                  'inline-flex h-7 w-[6.5rem] shrink-0 items-center justify-center gap-1 rounded-md border text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 [&_svg]:size-3.5',
                  isSubscribed ? 'border-transparent text-primary' : 'border-border bg-background hover:bg-muted'
                )}
              >
                {isSubscribed ? <Check /> : <Plus />}
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

export function NotesSnippet({ story }: { story: Story }) {
  const highlight = story.highlights?.[0] ?? '';
  return (
    <Frame className='px-6 pt-8 pb-6 sm:px-8'>
      <div aria-hidden='true' className='relative'>
        <span className='absolute -top-7 left-[22%] flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-[11.5px] font-medium text-background shadow-lg'>
          <Highlighter className='size-3' /> Highlight
          <span className='rounded bg-background/15 px-1 text-[10px]'>h</span>
        </span>
        <p className='reading-body font-serif text-[16px]'>
          <mark>{highlight}</mark> They included a chart showing those changes.
        </p>
      </div>
      <div className='mt-6 border-t border-border pt-4'>
        <p className='text-[12px] font-medium text-muted-foreground'>Your note</p>
        <p className='mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-[14px] leading-snug'>
          {story.note}
          <span className='ml-0.5 inline-block h-4 w-px translate-y-[3px] animate-pulse bg-foreground' />
        </p>
      </div>
    </Frame>
  );
}

const LIBRARY_ROWS = [
  { name: 'Quanta Magazine', url: 'quantamagazine.org/feed', folder: 'Science', status: 'Fetched 4m ago' },
  { name: 'The Verge', url: 'theverge.com/rss/index.xml', folder: 'Tech', status: 'Fetched 4m ago' },
  { name: 'kottke.org', url: 'feeds.kottke.org/main', folder: 'No folder', status: 'Failed 2h ago', error: true },
  { name: 'Smashing Magazine', url: 'smashingmagazine.com/feed', folder: 'Design', status: 'Fetched 1h ago' }
];

export function LibrarySnippet() {
  return (
    <Frame>
      <ul aria-hidden='true' className='divide-y divide-border'>
        {LIBRARY_ROWS.map((row) => (
          <li key={row.name} className='flex items-center gap-3 px-4 py-3'>
            <FeedMonogram name={row.name} className='size-6 rounded-md text-xs' />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{row.name}</p>
              <p className='flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground'>
                <span className='hidden truncate sm:inline'>{row.url}</span>
                <span className='hidden sm:inline'>·</span>
                <span className={cn('inline-flex shrink-0 items-center gap-1', row.error && 'font-medium text-destructive')}>
                  {row.error && <CircleAlert className='size-3' />}
                  {row.status}
                </span>
              </p>
            </div>
            <span className='inline-flex h-7 w-[7.5rem] shrink-0 items-center justify-between rounded-md border border-input bg-background px-2.5 text-[12.5px]'>
              {row.folder} <ChevronDown className='size-3.5 text-muted-foreground' />
            </span>
          </li>
        ))}
      </ul>
      <div className='flex flex-wrap items-center gap-2 border-t border-border bg-background/60 px-4 py-3 text-[12.5px] font-medium'>
        <span className='inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5'><Upload className='size-3.5' /> Import OPML</span>
        <span className='inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5'><Download className='size-3.5' /> Export OPML</span>
        <span className='ml-auto text-muted-foreground'>Auto-refresh every 30 min</span>
      </div>
    </Frame>
  );
}
