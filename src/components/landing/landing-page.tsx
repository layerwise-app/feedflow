import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { FeedflowLogo, FeedflowMark } from '~/components/brand';
import { Button } from '~/components/ui/button';
import { createDemoState } from '~/lib/demo-snapshot';
import { cn } from '~/lib/utils';
import { DiscoverSnippet, KeyboardSnippet, LayoutsSnippet, LibrarySnippet, NotesSnippet } from './feature-snippets';
import { ReaderPreview } from './reader-preview';

export function LandingPage({ signedIn, now }: { signedIn: boolean; now: number }) {
  const { stories } = createDemoState(now);
  const science = stories.filter((story) => story.source === 'Quanta Magazine' || story.source === 'NASA');
  const annotated = stories.find((story) => story.note)!;

  return (
    <div className='min-h-dvh overflow-x-clip bg-background text-foreground'>
      <header className='sticky top-0 z-30 border-b border-transparent bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70'>
        <nav aria-label='Main' className='mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 sm:px-8'>
          <Link to='/' aria-label='Feedflow home' className='mr-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60'>
            <FeedflowLogo />
          </Link>
          {signedIn ? (
            <Button asChild size='sm'>
              <Link to='/dashboard'>Open reader</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant='ghost' size='sm' className='hidden sm:inline-flex'>
                <Link to='/demo'>Demo</Link>
              </Button>
              <Button asChild variant='ghost' size='sm'>
                <Link to='/sign-in'>Sign in</Link>
              </Button>
              <Button asChild size='sm'>
                <Link to='/sign-up'>Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className='mx-auto max-w-6xl px-5 pt-16 text-center sm:px-8 sm:pt-24'>
          <h1 className='mx-auto max-w-[14ch] font-serif text-[clamp(2.75rem,8vw,5.75rem)] leading-[0.98] font-medium tracking-[-0.035em] text-balance'>
            Read the web on your own terms.
          </h1>
          <p className='mx-auto mt-6 max-w-[34rem] text-[1.05rem] leading-relaxed text-muted-foreground sm:text-lg'>
            Feedflow is a fast, keyboard-first RSS reader for the sites and writers you follow.
          </p>
          <CallToAction signedIn={signedIn} className='mt-9 justify-center' />
        </section>

        <div className='mx-auto mt-16 max-w-6xl px-3 sm:mt-20 sm:px-8'>
          <ReaderPreview now={now} />
        </div>

        <div className='mx-auto mt-28 flex max-w-6xl flex-col gap-24 px-5 sm:mt-36 sm:gap-32 sm:px-8'>
          <Feature title='Built for the keyboard.' text='Move with j and k, star with s, and press ? whenever you forget.'>
            <KeyboardSnippet stories={stories} now={now} />
          </Feature>
          <Feature reverse title='Three ways to read.' text='A dense list for triage, cards for browsing, a magazine for slower days.'>
            <LayoutsSnippet stories={science} now={now} />
          </Feature>
          <Feature title='Find writing worth following.' text='Browse a hand-picked directory and subscribe in one click.'>
            <DiscoverSnippet />
          </Feature>
          <Feature reverse title='Keep the best parts.' text='Highlight passages, add a note, and find them all in Notes.'>
            <NotesSnippet story={annotated} />
          </Feature>
          <Feature title='Bring your library with you.' text='Import OPML, sort feeds into folders, and spot broken feeds at a glance.'>
            <LibrarySnippet />
          </Feature>
        </div>

        <section className='mx-auto mt-32 max-w-6xl px-5 sm:mt-44 sm:px-8'>
          <div className='border-t border-foreground/15 pt-16 pb-24 text-center sm:pt-24 sm:pb-32'>
            <h2 className='font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-none font-medium tracking-[-0.03em]'>Start reading.</h2>
            <CallToAction signedIn={signedIn} className='mt-9 justify-center' />
          </div>
        </section>
      </main>

      <footer className='border-t border-border'>
        <div className='mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-8 text-sm text-muted-foreground sm:px-8'>
          <span className='mr-auto flex items-center gap-2 font-serif text-base font-semibold text-foreground'>
            <FeedflowMark className='size-5' /> Feedflow
          </span>
          <Link to='/demo' className='hover:text-foreground'>Demo</Link>
          <Link to={signedIn ? '/dashboard' : '/sign-in'} className='hover:text-foreground'>{signedIn ? 'Reader' : 'Sign in'}</Link>
          <span>© {new Date(now).getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function CallToAction({ signedIn, className }: { signedIn: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Button asChild size='lg' className='h-11 px-5 text-[15px]'>
        <Link to={signedIn ? '/dashboard' : '/sign-up'}>{signedIn ? 'Open reader' : 'Get started'}</Link>
      </Button>
      <Button asChild size='lg' variant='ghost' className='group h-11 px-4 text-[15px]'>
        <Link to='/demo'>
          Try the demo <ArrowRight className='transition-transform group-hover:translate-x-0.5' />
        </Link>
      </Button>
    </div>
  );
}

function Feature({ title, text, reverse, children }: { title: string; text: string; reverse?: boolean; children: ReactNode }) {
  return (
    <section className={cn('grid items-center gap-10 lg:gap-20', reverse ? 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
      <div className={cn('max-w-md', reverse && 'lg:order-2')}>
        <h2 className='font-serif text-[clamp(2rem,4vw,2.9rem)] leading-[1.05] font-medium tracking-[-0.025em] text-balance'>{title}</h2>
        <p className='mt-4 text-[1.05rem] leading-relaxed text-muted-foreground'>{text}</p>
      </div>
      <div className={cn('min-w-0', reverse && 'lg:order-1')}>{children}</div>
    </section>
  );
}
