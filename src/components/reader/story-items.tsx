import { Bookmark, NotebookPen, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatStoryAge } from '~/lib/reader-format';
import { hasAnnotation, type Story } from '~/lib/reader-model';
import { cn } from '~/lib/utils';
import { FeedMonogram } from './feed-monogram';
import { useReader } from './reader-context';

type ItemProps = { story: Story; selected: boolean };

// Magazine items have no box of their own, so selection paints a tint that bleeds past the text.
const SELECTED_TINT = 'before:absolute before:-inset-x-3 before:-inset-y-2.5 before:-z-10 before:rounded-lg before:bg-accent/80';

function UnreadDot({ story }: { story: Story }) {
  return <span aria-hidden='true' className={cn('size-[7px] shrink-0 rounded-full', story.read ? 'bg-transparent' : 'bg-primary')} />;
}

function Meta({ story, className }: { story: Story; className?: string }) {
  const { now, timeZone } = useReader();
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span className='truncate font-medium text-foreground/70'>{story.source}</span>
      <span aria-hidden='true'>·</span>
      <time className='shrink-0 tabular-nums' dateTime={story.publishedAt ? new Date(story.publishedAt).toISOString() : undefined}>
        {formatStoryAge(story.publishedAt, now, story.time, timeZone)}
      </time>
      {story.saved && <Bookmark aria-label='Saved for later' className='size-3 shrink-0 fill-current' />}
      {hasAnnotation(story) && <NotebookPen aria-label='Has notes' className='size-3 shrink-0' />}
    </span>
  );
}

function StarButton({ story, className }: { story: Story; className?: string }) {
  const { actions } = useReader();
  return (
    <button
      type='button'
      aria-label={story.starred ? 'Unstar' : 'Star'}
      aria-pressed={story.starred}
      onClick={() => actions.toggle(story.id, 'starred')}
      className={cn(
        'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60',
        story.starred ? 'text-star hover:text-star' : 'opacity-0 group-hover/story:opacity-100 pointer-coarse:opacity-100',
        className
      )}
    >
      <Star className={cn('size-4', story.starred && 'fill-current')} />
    </button>
  );
}

/** The whole item opens the story; the star stays a separate control above the stretched button. */
function OpenButton({ story, children, className }: { story: Story; children: ReactNode; className?: string }) {
  const { selectStory } = useReader();
  return (
    <button
      type='button'
      onClick={() => selectStory(story.id, { open: true })}
      className={cn('text-left outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset', className)}
    >
      {children}
    </button>
  );
}

function NotePreview({ story }: { story: Story }) {
  const text = story.note?.trim() || story.highlights?.[0];
  if (!text) return null;
  return (
    <p className={cn('mt-2 line-clamp-2 border-l-2 pl-3 text-[13px] leading-relaxed', story.note?.trim() ? 'border-foreground/25 text-foreground/80' : 'border-primary/50 text-foreground/70 italic')}>
      {text}
    </p>
  );
}

export function StoryRow({ story, selected, compact, notes }: ItemProps & { compact: boolean; notes: boolean }) {
  const { now, timeZone } = useReader();
  if (compact) {
    return (
      <div className={cn('group/story relative flex h-10 items-center gap-3 border-b border-border/70 pr-2 pl-4 transition-colors hover:bg-foreground/[0.03] sm:pl-5', selected && 'bg-accent/70 hover:bg-accent/70')}>
        {selected && <span aria-hidden='true' className='absolute inset-y-0 left-0 w-[3px] bg-primary' />}
        <UnreadDot story={story} />
        <span className='hidden w-32 shrink-0 truncate text-xs text-muted-foreground sm:block'>{story.source}</span>
        <OpenButton story={story} className='min-w-0 flex-1 truncate text-[14px]'>
          <span className={cn(story.read ? 'text-foreground/65' : 'font-semibold text-foreground')}>{story.title}</span>
        </OpenButton>
        <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>{formatStoryAge(story.publishedAt, now, story.time, timeZone)}</span>
        <StarButton story={story} className='size-6' />
      </div>
    );
  }

  return (
    <div className={cn('group/story relative border-b border-border/70 py-4 pr-3 pl-4 transition-colors hover:bg-foreground/[0.03] sm:pl-5', selected && 'bg-accent/70 hover:bg-accent/70')}>
      {selected && <span aria-hidden='true' className='absolute inset-y-0 left-0 w-[3px] bg-primary' />}
      <div className='flex items-center gap-2.5'>
        <UnreadDot story={story} />
        <Meta story={story} className='flex-1' />
        <StarButton story={story} className='-my-1.5' />
      </div>
      <div className='pl-[17.5px]'>
        <OpenButton story={story} className='mt-1 block'>
          <h3 className={cn('font-serif text-[1.08rem] leading-snug tracking-[-0.005em] text-pretty', story.read ? 'font-normal text-foreground/70' : 'font-semibold text-foreground')}>
            {story.title}
          </h3>
        </OpenButton>
        {notes ? <NotePreview story={story} /> : story.excerpt && (
          <p className={cn('mt-1 line-clamp-2 text-[13.5px] leading-relaxed', story.read ? 'text-muted-foreground/85' : 'text-muted-foreground')}>{story.excerpt}</p>
        )}
      </div>
    </div>
  );
}

export function StoryCard({ story, selected }: ItemProps) {
  return (
    <article className={cn(
      'group/story relative flex flex-col rounded-xl border bg-card p-5 transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-[0_2px_12px_-4px_rgb(0_0_0/0.12)]',
      selected ? 'border-primary/60 ring-1 ring-primary/40' : 'border-border'
    )}>
      <div className='flex items-center gap-2'>
        <FeedMonogram name={story.source} className='size-[18px] text-[10px]' />
        <Meta story={story} className='flex-1' />
        <StarButton story={story} className='-my-1 -mr-1.5' />
      </div>
      <OpenButton story={story} className='mt-3 block'>
        <h3 className={cn('font-serif text-[1.22rem] leading-[1.25] tracking-[-0.01em] text-pretty', story.read ? 'font-normal text-foreground/65' : 'font-semibold text-foreground')}>
          {!story.read && <span aria-hidden='true' className='mr-2 mb-[3px] inline-block size-[7px] rounded-full bg-primary align-middle' />}
          {story.title}
        </h3>
      </OpenButton>
      {story.excerpt && <p className='mt-2.5 line-clamp-4 text-[13.5px] leading-relaxed text-muted-foreground'>{story.excerpt}</p>}
      <NotePreview story={story} />
    </article>
  );
}

export function MagazineLead({ story, selected }: ItemProps) {
  return (
    <article className={cn('group/story relative isolate', selected && SELECTED_TINT, selected && 'before:-inset-x-5 before:-inset-y-4')}>
      <Meta story={story} />
      <OpenButton story={story} className='mt-3 block'>
        <h2 className={cn('font-serif text-[2rem] leading-[1.08] font-semibold tracking-[-0.025em] text-balance sm:text-[2.6rem]', story.read && 'text-foreground/70')}>
          {story.title}
        </h2>
      </OpenButton>
      {story.excerpt && <p className='mt-4 line-clamp-4 max-w-[38rem] font-serif text-[1.08rem] leading-relaxed text-foreground/75'>{story.excerpt}</p>}
      <div className='mt-4 flex items-center gap-1'>
        <StarButton story={story} className='-ml-1.5 opacity-100' />
        {!story.read && <span className='text-xs font-medium text-primary'>Unread</span>}
      </div>
    </article>
  );
}

export function MagazineItem({ story, selected, size = 'default' }: ItemProps & { size?: 'default' | 'small' }) {
  return (
    <article className={cn('group/story relative isolate', selected && SELECTED_TINT)}>
      <div className='flex items-center gap-2'>
        <UnreadDot story={story} />
        <Meta story={story} className='flex-1' />
        <StarButton story={story} className='-my-1.5 -mr-1.5' />
      </div>
      <OpenButton story={story} className='mt-1.5 block'>
        <h3 className={cn(
          'font-serif leading-snug tracking-[-0.01em] text-pretty',
          size === 'small' ? 'text-[1.05rem]' : 'text-[1.25rem]',
          story.read ? 'font-normal text-foreground/65' : 'font-semibold'
        )}>
          {story.title}
        </h3>
      </OpenButton>
      {size === 'default' && story.excerpt && <p className='mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-muted-foreground'>{story.excerpt}</p>}
    </article>
  );
}
