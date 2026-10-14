import { X } from 'lucide-react';
import type { Story } from '~/lib/reader-model';
import { useReader } from './reader-context';

/** Highlights and a free-form note for the open story. */
export function StoryNotes({ story }: { story: Story }) {
  const { actions } = useReader();
  const highlights = story.highlights ?? [];

  return (
    <section aria-labelledby='story-notes-title' className='mt-14 border-t border-border pt-8 font-sans'>
      <h2 id='story-notes-title' className='text-sm font-semibold'>Notes</h2>
      {highlights.length > 0 && (
        <ul className='mt-4 space-y-3'>
          {highlights.map((highlight) => (
            <li key={highlight} className='group/highlight relative rounded-r-md border-l-2 border-primary bg-accent/50 py-2.5 pr-9 pl-4'>
              <p className='font-serif text-[15px] leading-relaxed text-foreground/90'>{highlight}</p>
              <button
                type='button'
                aria-label='Remove highlight'
                onClick={() => actions.removeHighlight(story.id, highlight)}
                className='absolute top-2 right-2 flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-opacity group-hover/highlight:opacity-100 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 pointer-coarse:opacity-100'
              >
                <X className='size-3.5' />
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        aria-label='Note'
        value={story.note ?? ''}
        maxLength={10_000}
        onChange={(event) => actions.setNote(story.id, event.target.value)}
        placeholder={highlights.length ? 'Add a note…' : 'Add a note, or select text to highlight it.'}
        rows={3}
        className='mt-4 field-sizing-content min-h-24 w-full resize-none rounded-lg border border-border bg-card px-3.5 py-3 text-[14.5px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring/50 focus:ring-2 focus:ring-ring/20'
      />
    </section>
  );
}
