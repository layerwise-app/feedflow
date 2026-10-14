import { useMutation } from '@tanstack/react-query';
import { Check, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Spinner } from '~/components/ui/spinner';
import { DISCOVER_CATEGORIES, DISCOVER_FEEDS, feedUrlKey, type DiscoverCategory, type DiscoverFeed } from '~/lib/discover-catalog';
import { cn } from '~/lib/utils';
import { FeedMonogram } from './feed-monogram';
import { useReader } from './reader-context';

type Filter = DiscoverCategory | 'All';

export function DiscoverDialog() {
  const { dialog, setDialog, state } = useReader();
  const [category, setCategory] = useState<Filter>('All');
  const [filter, setFilter] = useState('');
  const subscribed = new Set(state.feeds.map((feed) => feedUrlKey(feed.url)));
  const needle = filter.trim().toLowerCase();
  const feeds = DISCOVER_FEEDS.filter((feed) => (category === 'All' || feed.category === category)
    && (!needle || `${feed.name} ${feed.site} ${feed.description}`.toLowerCase().includes(needle)));

  return (
    <Dialog open={dialog === 'discover'} onOpenChange={(open) => setDialog(open ? 'discover' : null)}>
      <DialogContent className='flex max-h-[min(46rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl'>
        <div className='border-b border-border px-5 pt-5 pb-4 sm:px-6'>
          <DialogTitle className='font-serif text-2xl font-semibold tracking-[-0.015em]'>Discover</DialogTitle>
          <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <div className='-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]' role='group' aria-label='Category'>
              {(['All', ...DISCOVER_CATEGORIES] as Filter[]).map((option) => (
                <button
                  key={option}
                  type='button'
                  aria-pressed={category === option}
                  onClick={() => setCategory(option)}
                  className='h-7 shrink-0 rounded-full border border-border px-3 text-[13px] text-muted-foreground outline-none transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background'
                >
                  {option}
                </button>
              ))}
            </div>
            <div className='relative sm:ml-auto sm:w-52'>
              <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder='Filter'
                aria-label='Filter feeds'
                className='h-8 w-full rounded-md border border-input bg-card pr-3 pl-8 text-[13px] outline-none focus:border-ring/50 focus:ring-2 focus:ring-ring/20'
              />
            </div>
          </div>
        </div>
        <ul className='grid min-h-0 flex-1 auto-rows-min overflow-y-auto px-3 py-2 sm:grid-cols-2 sm:px-4'>
          {feeds.map((feed) => <DiscoverRow key={feed.url} feed={feed} subscribed={subscribed.has(feedUrlKey(feed.url))} />)}
          {feeds.length === 0 && <li className='col-span-full py-16 text-center text-sm text-muted-foreground'>No feeds match “{filter.trim()}”.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function DiscoverRow({ feed, subscribed }: { feed: DiscoverFeed; subscribed: boolean }) {
  const { actions } = useReader();
  const subscription = useMutation({
    mutationFn: () => actions.subscribe(feed.url, { name: feed.name }),
    onError: (error) => toast.error(error instanceof Error ? `${feed.name}: ${error.message}` : `Could not subscribe to ${feed.name}.`)
  });

  return (
    <li className='flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-foreground/[0.03]'>
      <FeedMonogram name={feed.name} className='mt-0.5 size-8 rounded-lg text-sm' />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{feed.name}</p>
        <p className='line-clamp-2 text-[13px] leading-snug text-muted-foreground'>{feed.description}</p>
      </div>
      <Button
        size='xs'
        variant={subscribed ? 'ghost' : 'outline'}
        disabled={subscribed || subscription.isPending}
        onClick={() => subscription.mutate()}
        aria-label={subscribed ? `Subscribed to ${feed.name}` : `Subscribe to ${feed.name}`}
        className={cn('mt-0.5 w-[6.75rem] shrink-0', subscribed && 'text-primary disabled:opacity-100')}
      >
        {subscription.isPending ? <Spinner /> : subscribed ? <Check /> : <Plus />}
        {subscribed ? 'Subscribed' : 'Subscribe'}
      </Button>
    </li>
  );
}
