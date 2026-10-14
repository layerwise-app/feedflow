import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { FeedflowLogo } from '~/components/brand';
import { Button } from '~/components/ui/button';

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <main className='flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-6 text-center'>
      <Link to='/' aria-label='Feedflow home'>
        <FeedflowLogo />
      </Link>
      <div className='flex flex-col gap-2'>
        <h1 className='font-serif text-3xl font-semibold tracking-[-0.02em]'>Page not found</h1>
        <div className='text-muted-foreground'>{children ?? <p>This page does not exist.</p>}</div>
      </div>
      <div className='flex flex-wrap justify-center gap-2'>
        <Button variant='outline' onClick={() => window.history.back()}>Go back</Button>
        <Button asChild>
          <Link to='/'>Home</Link>
        </Button>
      </div>
    </main>
  );
}
