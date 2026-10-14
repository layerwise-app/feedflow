import { Bookmark, ChevronDown, ExternalLink, Inbox, LayoutGrid, List, Newspaper, NotebookPen, Search, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { FeedflowMark } from '~/components/brand';
import { FeedMonogram } from '~/components/reader/feed-monogram';
import { createDemoState } from '~/lib/demo-snapshot';
import { formatLongDate, formatStoryAge } from '~/lib/reader-format';
import { countStories, splitHighlights, type Story } from '~/lib/reader-model';
import { cn } from '~/lib/utils';
import { useDisplayTimeZone } from '~/components/use-display-time-zone';

const OPEN_STORY_ID = 4;

/** A static picture of the reader built from the demo library: three panes on desktop, fewer on small screens. */
export function ReaderPreview({ now }: { now: number }) {
  const state = createDemoState(now);
  const counts = countStories(state.stories, state.feedFolders);
  const open = state.stories.find((story) => story.id === OPEN_STORY_ID)!;
  const feedsIn = (folder: string) => state.feeds.filter((feed) => state.feedFolders[feed.name] === folder);

  return (
    <div
      role='img'
      aria-label='The Feedflow reader: folders and feeds, a list of stories, and an open article with a highlight and a note.'
      className='overflow-hidden rounded-xl border border-foreground/10 bg-card shadow-[0_1px_1px_rgb(23_23_27/0.04),0_12px_32px_-8px_rgb(23_23_27/0.14),0_40px_80px_-24px_rgb(35_64_224/0.14)] dark:shadow-none'
    >
      <div aria-hidden='true' className='flex h-[460px] select-none sm:h-[540px] lg:h-[600px]'>
        <div className='hidden w-[212px] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 lg:flex'>
          <div className='flex items-center gap-2 px-1.5 font-serif text-[1.05rem] font-semibold tracking-[-0.02em]'>
            <FeedflowMark className='size-5' /> Feedflow
          </div>
          <div className='mt-4 flex h-8 items-center justify-center rounded-md bg-primary text-[12.5px] font-medium text-primary-foreground'>Add feed</div>
          <div className='mt-4 flex flex-col gap-px'>
            <NavItem icon={<Inbox />} label='All items' count={counts.views.all} active />
            <NavItem icon={<Star />} label='Starred' count={counts.views.starred} />
            <NavItem icon={<Bookmark />} label='Read later' count={counts.views.later} />
            <NavItem icon={<NotebookPen />} label='Notes' count={counts.views.notes} />
          </div>
          <p className='mt-5 mb-1 px-2 text-[11px] font-medium text-muted-foreground'>Subscriptions</p>
          {['Tech', 'Science', 'Design'].map((folder) => (
            <div key={folder} className='flex flex-col gap-px'>
              <NavItem icon={<ChevronDown className='text-muted-foreground' />} label={folder} count={counts.folders[folder] ?? 0} strong />
              {feedsIn(folder).map((feed) => (
                <NavItem key={feed.name} nested icon={<FeedMonogram name={feed.name} className='size-4 rounded-[4px] text-[9px]' />} label={feed.name} count={counts.feeds[feed.name] ?? 0} />
              ))}
            </div>
          ))}
        </div>

        <div className='flex w-full min-w-0 shrink-0 flex-col border-border sm:w-[300px] sm:border-r lg:w-[330px]'>
          <div className='border-b border-border px-4 pt-4 pb-3'>
            <div className='flex items-baseline justify-between gap-3'>
              <p className='font-serif text-[1.35rem] font-semibold tracking-[-0.015em]'>All items</p>
              <p className='text-[12px] text-muted-foreground'>{counts.views.all} unread</p>
            </div>
            <div className='mt-3 flex items-center gap-2'>
              <div className='flex h-7 flex-1 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-[12px] text-muted-foreground'>
                <Search className='size-3.5' /> Search
                <span className='ml-auto rounded border border-border px-1 text-[10px]'>/</span>
              </div>
              <div className='flex items-center rounded-md bg-muted p-0.5 [&_svg]:size-3.5'>
                <span className='rounded bg-card p-1 text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)]'><List /></span>
                <span className='p-1 text-muted-foreground'><LayoutGrid /></span>
                <span className='p-1 text-muted-foreground'><Newspaper /></span>
              </div>
            </div>
          </div>
          <div className='min-h-0 flex-1 overflow-hidden'>
            {state.stories.slice(1, 10).map((story) => <PreviewRow key={story.id} story={story} now={now} selected={story.id === OPEN_STORY_ID} />)}
          </div>
        </div>

        <PreviewArticle story={open} />
      </div>
    </div>
  );
}

function NavItem({ icon, label, count, active, nested, strong }: { icon: ReactNode; label: string; count: number; active?: boolean; nested?: boolean; strong?: boolean }) {
  return (
    <div className={cn(
      'flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] text-foreground/80 [&_svg]:size-3.5 [&_svg]:shrink-0',
      active && 'bg-accent font-medium text-accent-foreground',
      nested && 'pl-6',
      strong && 'font-medium text-foreground'
    )}>
      {icon}
      <span className='min-w-0 flex-1 truncate'>{label}</span>
      {count > 0 && <span className='text-[11px] text-muted-foreground tabular-nums'>{count}</span>}
    </div>
  );
}

function PreviewRow({ story, now, selected }: { story: Story; now: number; selected: boolean }) {
  const timeZone = useDisplayTimeZone();
  return (
    <div className={cn('relative border-b border-border/70 py-3 pr-3 pl-4', selected && 'bg-accent/70')}>
      {selected && <span className='absolute inset-y-0 left-0 w-[3px] bg-primary' />}
      <div className='flex items-center gap-2 text-[11.5px] text-muted-foreground'>
        <span className={cn('size-1.5 shrink-0 rounded-full', story.read ? 'bg-transparent' : 'bg-primary')} />
        <span className='truncate font-medium text-foreground/70'>{story.source}</span>
        <span>·</span>
        <span className='shrink-0 tabular-nums'>{formatStoryAge(story.publishedAt, now, '', timeZone)}</span>
        {story.starred && <Star className='ml-auto size-3.5 shrink-0 fill-current text-star' />}
      </div>
      <p className={cn('mt-1 line-clamp-2 pl-3.5 font-serif text-[15px] leading-snug', story.read ? 'text-foreground/65' : 'font-semibold')}>{story.title}</p>
    </div>
  );
}

function PreviewArticle({ story }: { story: Story }) {
  const timeZone = useDisplayTimeZone();
  const paragraphs = (story.body ?? story.excerpt ?? '').split(/\n{2,}/).slice(0, 5);
  return (
    <div className='hidden min-w-0 flex-1 flex-col bg-card sm:flex'>
      <div className='flex h-11 shrink-0 items-center justify-end gap-3 border-b border-border px-4 text-muted-foreground [&_svg]:size-4'>
        <Star />
        <Bookmark className='fill-current text-primary' />
        <ExternalLink />
        <span className='font-serif text-[13px] font-semibold text-foreground/70'>Aa</span>
      </div>
      <div className='relative min-h-0 flex-1 overflow-hidden'>
        <div className='mx-auto max-w-[34rem] px-8 pt-9'>
          <div className='flex items-center gap-2 text-[12px] text-muted-foreground'>
            <FeedMonogram name={story.source} className='size-4 rounded-[4px] text-[9px]' />
            <span className='font-medium text-foreground/80'>{story.source}</span>
            <span>·</span>
            <span>{formatLongDate(story.publishedAt, '', timeZone)}</span>
          </div>
          <p className='mt-4 font-serif text-[1.9rem] leading-[1.1] font-semibold tracking-[-0.022em] text-balance'>{story.title}</p>
          <div className='reading-body mt-6 font-serif text-[15.5px]'>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>
                {splitHighlights(paragraph, story.highlights).map((segment, segmentIndex) => segment.highlight
                  ? <mark key={segmentIndex}>{segment.text}</mark>
                  : <span key={segmentIndex}>{segment.text}</span>)}
              </p>
            ))}
          </div>
        </div>
        <div className='pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent' />
        <div className='absolute right-6 bottom-6 w-[15rem] rounded-lg border border-border bg-background/95 p-3.5 shadow-[0_8px_24px_-8px_rgb(23_23_27/0.2)] backdrop-blur'>
          <p className='flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground'><NotebookPen className='size-3' /> Note</p>
          <p className='mt-1.5 text-[13px] leading-snug'>{story.note}</p>
        </div>
      </div>
    </div>
  );
}
