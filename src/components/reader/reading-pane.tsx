import { ArrowLeft, ArrowUpRight, Bookmark, ChevronDown, ChevronUp, CircleDot, ExternalLink, Highlighter, Link2, Share, Star, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Kbd } from '~/components/ui/kbd';
import { formatLongDate } from '~/lib/reader-format';
import { splitHighlights, type Story } from '~/lib/reader-model';
import { cn } from '~/lib/utils';
import { FeedMonogram } from './feed-monogram';
import { useReader } from './reader-context';
import { ReadingSettings } from './reading-settings';
import { StoryNotes } from './story-notes';

const WIDTHS = { narrow: '36rem', medium: '42rem', wide: '50rem' } as const;

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'the original site';
  }
}

export function ReadingPane({ story, docked }: { story: Story | null; docked: boolean }) {
  const { closeStory, stories } = useReader();

  if (!story) {
    if (!docked) return null;
    return (
      <section aria-label='Reading pane' className='hidden min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-background text-center xl:flex'>
        {stories.length > 0 && (
          <>
            <p className='font-serif text-xl text-foreground/70'>Select a story to read.</p>
            <p className='flex items-center gap-1.5 text-[13px] text-muted-foreground'>
              <Kbd>j</Kbd><Kbd>k</Kbd> to move, <Kbd>?</Kbd> for shortcuts
            </p>
          </>
        )}
      </section>
    );
  }

  return (
    <div className={cn('fixed inset-0 z-40 flex justify-end', docked && 'xl:static xl:z-auto xl:min-w-0 xl:flex-1')}>
      <div aria-hidden='true' onClick={closeStory} className={cn('absolute inset-0 hidden bg-foreground/20 duration-200 animate-in fade-in-0 md:block', docked && 'xl:hidden')} />
      <article
        aria-label={story.title}
        className={cn(
          'relative flex h-full w-full flex-col bg-background duration-200 animate-in fade-in-0 slide-in-from-right-4 md:w-[min(54rem,calc(100vw-4rem))] md:border-l md:border-border md:shadow-[-24px_0_60px_-30px_rgb(0_0_0/0.35)]',
          docked && 'xl:w-full xl:animate-none xl:border-l-0 xl:shadow-none'
        )}
      >
        <StoryBody story={story} docked={docked} />
      </article>
    </div>
  );
}

function StoryBody({ story, docked }: { story: Story; docked: boolean }) {
  const { state, stories, actions, closeStory, selectStory, setScope, timeZone } = useReader();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ top: number; left: number } | null>(null);
  const index = stories.findIndex((candidate) => candidate.id === story.id);
  const paragraphs = (story.body?.trim() || story.excerpt).split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const words = paragraphs.join(' ').split(/\s+/).length;
  const { font, fontSize, width } = state.reading;
  const site = hostname(story.url);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    // Space and Page Down scroll the story once it opens.
    scrollRef.current?.focus({ preventScroll: true });
    setSelection(null);
  }, [story.id]);

  useEffect(() => {
    function onSelectionChange() {
      const current = window.getSelection();
      if (!current || current.isCollapsed || !current.rangeCount || !bodyRef.current?.contains(current.anchorNode)) {
        setSelection(null);
        return;
      }
      const rect = current.getRangeAt(0).getBoundingClientRect();
      setSelection({ top: rect.top, left: rect.left + rect.width / 2 });
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  function step(direction: 1 | -1) {
    const next = stories[index + direction];
    if (next) selectStory(next.id, { open: true });
  }

  function highlight() {
    const text = window.getSelection()?.toString() ?? '';
    if (!text.trim()) return;
    actions.addHighlight(story.id, text);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(story.url);
      toast('Link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  }

  return (
    <>
      <header className='flex h-14 shrink-0 items-center gap-1 border-b border-border px-2 sm:px-3'>
        <Button variant='ghost' size='icon-sm' aria-label='Close story' title='Close (Esc)' onClick={closeStory} className={cn(docked && 'xl:hidden')}>
          <ArrowLeft className='md:hidden' />
          <X className='hidden md:block' />
        </Button>
        <Button variant='ghost' size='icon-sm' aria-label='Previous story' title='Previous (k)' disabled={index <= 0} onClick={() => step(-1)}>
          <ChevronUp />
        </Button>
        <Button variant='ghost' size='icon-sm' aria-label='Next story' title='Next (j)' disabled={index < 0 || index >= stories.length - 1} onClick={() => step(1)}>
          <ChevronDown />
        </Button>
        <div className='ml-auto flex items-center gap-0.5'>
          <Button variant='ghost' size='icon-sm' aria-label='Star' aria-pressed={story.starred} title='Star (s)' onClick={() => actions.toggle(story.id, 'starred')} className={cn(story.starred && 'text-star hover:text-star')}>
            <Star className={cn(story.starred && 'fill-current')} />
          </Button>
          <Button variant='ghost' size='icon-sm' aria-label='Read later' aria-pressed={story.saved} title='Read later (l)' onClick={() => actions.toggle(story.id, 'saved')} className={cn(story.saved && 'text-primary hover:text-primary')}>
            <Bookmark className={cn(story.saved && 'fill-current')} />
          </Button>
          <Button variant='ghost' size='icon-sm' aria-label={story.read ? 'Mark as unread' : 'Mark as read'} title='Toggle read (m)' onClick={() => actions.setRead(story.id, !story.read)} className={cn(!story.read && 'text-primary hover:text-primary')}>
            <CircleDot />
          </Button>
          <Button variant='ghost' size='icon-sm' aria-label='Share' aria-pressed={story.shared} title='Share (Shift+S)' onClick={() => actions.toggle(story.id, 'shared')} className={cn('hidden sm:inline-flex', story.shared && 'text-primary hover:text-primary')}>
            <Share />
          </Button>
          <Button variant='ghost' size='icon-sm' aria-label='Copy link' title='Copy link' onClick={() => void copyLink()} className='hidden sm:inline-flex'>
            <Link2 />
          </Button>
          <Button variant='ghost' size='icon-sm' asChild>
            <a href={story.url} target='_blank' rel='noreferrer' aria-label='Open original' title='Open original (v)'>
              <ExternalLink />
            </a>
          </Button>
          <ReadingSettings />
        </div>
      </header>

      <div ref={scrollRef} tabIndex={-1} onScroll={() => selection && setSelection(null)} className='min-h-0 flex-1 overflow-y-auto outline-none'>
        <div className='mx-auto px-5 pt-10 pb-24 sm:px-10 sm:pt-14' style={{ maxWidth: `calc(${WIDTHS[width]} + 5rem)` }}>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground'>
            <button
              type='button'
              onClick={() => {
                setScope({ type: 'feed', feed: story.source });
              }}
              className='flex items-center gap-2 rounded font-medium text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60'
            >
              <FeedMonogram name={story.source} className='size-[18px] text-[10px]' />
              {story.source}
            </button>
            <span aria-hidden='true'>·</span>
            <span>{formatLongDate(story.publishedAt, story.time, timeZone)}</span>
            {paragraphs.length > 0 && (
              <>
                <span aria-hidden='true'>·</span>
                <span>{Math.max(1, Math.round(words / 230))} min read</span>
              </>
            )}
          </div>
          <h1 className='mt-5 font-serif text-[1.85rem] leading-[1.12] font-semibold tracking-[-0.022em] text-balance sm:text-[2.35rem]'>
            <a href={story.url} target='_blank' rel='noreferrer' className='outline-none hover:underline hover:decoration-1 hover:underline-offset-4 focus-visible:underline'>
              {story.title}
            </a>
          </h1>

          <div
            ref={bodyRef}
            data-reading-body
            className={cn('reading-body mt-8', font === 'serif' ? 'font-serif' : 'font-sans')}
            style={{ fontSize: `${fontSize}px` }}
          >
            {paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>
                {splitHighlights(paragraph, story.highlights).map((segment, segmentIndex) => segment.highlight
                  ? <mark key={segmentIndex}>{segment.text}</mark>
                  : <span key={segmentIndex}>{segment.text}</span>)}
              </p>
            ))}
          </div>

          <a
            href={story.url}
            target='_blank'
            rel='noreferrer'
            className='mt-10 inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-[13.5px] font-medium outline-none transition-colors hover:border-foreground/30 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/60'
          >
            Continue reading at {site} <ArrowUpRight className='size-4' />
          </a>

          <StoryNotes story={story} />
        </div>
      </div>

      {selection && createPortal(
        <button
          type='button'
          // Keep the text selection alive while the button is pressed.
          onMouseDown={(event) => event.preventDefault()}
          onClick={highlight}
          style={{ top: Math.max(8, selection.top - 44), left: selection.left }}
          className='fixed z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg duration-150 animate-in fade-in-0 zoom-in-95'
        >
          <Highlighter className='size-3.5' /> Highlight <Kbd className='h-4 min-w-4 bg-background/15 text-[10px] text-background'>h</Kbd>
        </button>,
        document.body
      )}
    </>
  );
}
