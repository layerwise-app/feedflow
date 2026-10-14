import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { FeedflowLogo } from '~/components/brand';

/** Centered frame shared by the sign-in, sign-up, and password pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className='flex min-h-dvh flex-col bg-background'>
      <header className='mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8'>
        <Link to='/' aria-label='Feedflow home' className='rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60'>
          <FeedflowLogo />
        </Link>
      </header>
      <main className='flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16 sm:items-center sm:pt-0'>
        <div className='w-full max-w-sm'>{children}</div>
      </main>
    </div>
  );
}
