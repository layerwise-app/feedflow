import { CircleAlert, Ellipsis, FolderInput, Pencil, RefreshCw, Trash } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { Spinner } from '~/components/ui/spinner';
import type { Feed } from '~/lib/reader-model';
import { cn } from '~/lib/utils';
import { FeedMonogram } from './feed-monogram';
import { useReader } from './reader-context';

const NO_FOLDER = '__none__';

export function NavCount({ value, strong }: { value: number; strong?: boolean }) {
  if (!value) return null;
  return (
    <span className={cn('ml-auto shrink-0 pl-2 text-xs tabular-nums', strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
      {value > 999 ? '999+' : value}
    </span>
  );
}

export const navItemClass = 'group/nav relative flex h-8 w-full min-w-0 items-center gap-2.5 rounded-md px-2 text-left text-[13.5px] text-foreground/80 outline-none transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 aria-[current=true]:bg-accent aria-[current=true]:font-medium aria-[current=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0';

/** A subscription in the sidebar, with an inline rename field and a menu of feed actions. */
export function FeedRow({ feed, nested }: { feed: Feed; nested?: boolean }) {
  const { state, scope, setScope, counts, actions } = useReader();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(feed.name);
  const active = scope.type === 'feed' && scope.feed === feed.name;
  const unread = counts.feeds[feed.name] ?? 0;
  const refreshing = actions.refreshing.has(feed.url);
  const folders = [...new Set([...state.folders, ...Object.values(state.feedFolders)])].sort((left, right) => left.localeCompare(right));

  function commitRename() {
    const name = draft.trim();
    setRenaming(false);
    if (!name || name === feed.name) return;
    try {
      actions.rename(feed.name, name);
      if (active) setScope({ type: 'feed', feed: name });
    } catch (error) {
      setDraft(feed.name);
      actions.reportError(error, 'Could not rename this feed.');
    }
  }

  if (renaming) {
    return (
      <input
        autoFocus
        aria-label={`Rename ${feed.name}`}
        value={draft}
        maxLength={160}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitRename}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitRename();
          if (event.key === 'Escape') {
            setDraft(feed.name);
            setRenaming(false);
          }
        }}
        className={cn('h-8 w-full rounded-md border border-ring bg-card px-2 text-[13.5px] outline-none ring-2 ring-ring/25', nested && 'pl-2')}
      />
    );
  }

  return (
    <div className='group/feed relative'>
      <button
        type='button'
        aria-current={active}
        onClick={() => setScope({ type: 'feed', feed: feed.name })}
        className={cn(navItemClass, 'pr-9', nested && 'pl-2')}
      >
        <FeedMonogram name={feed.name} className='size-[18px] text-[10px]' />
        <span className={cn('truncate', unread > 0 && 'font-medium text-foreground group-aria-[current=true]/nav:text-accent-foreground')}>{feed.name}</span>
        {feed.error && <CircleAlert aria-label={`Last refresh failed: ${feed.error}`} className='size-3.5! text-destructive' />}
        <span className='ml-auto flex items-center group-hover/feed:invisible group-has-[[data-state=open]]/feed:invisible'>
          {refreshing ? <Spinner className='size-3.5 text-muted-foreground' /> : <NavCount value={unread} />}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${feed.name} options`}
          className='absolute top-1 right-1 flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-opacity group-hover/feed:opacity-100 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:opacity-100 pointer-coarse:opacity-100'
        >
          <Ellipsis className='size-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' side='right' className='w-52'>
          <DropdownMenuItem onSelect={() => void actions.refreshFeeds([feed.url])}>
            <RefreshCw /> Refresh
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDraft(feed.name);
              // Let the menu finish closing before the input takes focus.
              window.setTimeout(() => setRenaming(true), 0);
            }}
          >
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className='size-4 text-muted-foreground' /> Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='w-44'>
              <DropdownMenuRadioGroup
                value={state.feedFolders[feed.name] ?? NO_FOLDER}
                onValueChange={(folder) => actions.moveFeed(feed.name, folder === NO_FOLDER ? '' : folder)}
              >
                <DropdownMenuRadioItem value={NO_FOLDER}>No folder</DropdownMenuRadioItem>
                {folders.map((folder) => <DropdownMenuRadioItem key={folder} value={folder}>{folder}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onSelect={() => actions.unsubscribe(feed.name)}>
            <Trash /> Unsubscribe
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
