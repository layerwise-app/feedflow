import { cn } from '~/lib/utils';

/** Three staggered lines: a stream of stories. */
export function FeedflowMark({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className={cn('size-6 shrink-0', className)}>
      <rect width='24' height='24' rx='6.5' fill='var(--primary)' />
      <path d='M6.5 8h11M6.5 12h7.5M6.5 16h4' stroke='var(--primary-foreground)' strokeWidth='2.1' strokeLinecap='round' />
    </svg>
  );
}

export function FeedflowLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-serif text-[1.3rem] font-semibold tracking-[-0.02em] text-foreground', className)}>
      <FeedflowMark />
      Feedflow
    </span>
  );
}
