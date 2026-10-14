import { feedColor } from '~/lib/reader-format';
import { cn } from '~/lib/utils';

/** A colored initial standing in for a feed's favicon, so no third-party images load. */
export function FeedMonogram({ name, className }: { name: string; className?: string }) {
  const initial = name.replace(/^(the|a)\s+/i, '').trim().slice(0, 1).toUpperCase() || '?';
  return (
    <span
      aria-hidden='true'
      style={{ backgroundColor: feedColor(name) }}
      className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] font-sans text-[10.5px] font-semibold text-white', className)}
    >
      {initial}
    </span>
  );
}
