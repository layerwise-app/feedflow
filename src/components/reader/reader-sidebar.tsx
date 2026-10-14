import { Link } from '@tanstack/react-router';
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Compass,
  Download,
  BookCheck,
  Inbox,
  Keyboard,
  LogOut,
  NotebookPen,
  Plus,
  RefreshCw,
  Settings2,
  Share,
  Star
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FeedflowLogo } from '~/components/brand';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { Kbd } from '~/components/ui/kbd';
import { Spinner } from '~/components/ui/spinner';
import type { ReaderView } from '~/lib/reader-model';
import { cn } from '~/lib/utils';
import { FeedRow, NavCount, navItemClass } from './feed-row';
import { downloadOpml } from './opml';
import { useReader } from './reader-context';

const VIEWS: Array<{ view: ReaderView; label: string; icon: ReactNode }> = [
  { view: 'all', label: 'All items', icon: <Inbox /> },
  { view: 'starred', label: 'Starred', icon: <Star /> },
  { view: 'later', label: 'Read later', icon: <Bookmark /> },
  { view: 'notes', label: 'Notes', icon: <NotebookPen /> },
  { view: 'shared', label: 'Shared', icon: <Share /> },
  { view: 'read', label: 'Recently read', icon: <BookCheck /> }
];

export function ReaderSidebar() {
  const { state, scope, setScope, counts, setDialog, mode } = useReader();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  // Empty folders stay in Manage subscriptions; listing them here would look like they hold the unfiled feeds below.
  const folders = [...new Set(state.feeds.map((feed) => state.feedFolders[feed.name]).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const unfiled = state.feeds.filter((feed) => !state.feedFolders[feed.name]).sort(byName);

  function toggleFolder(folder: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  return (
    <div className='flex h-full w-full min-w-0 flex-col'>
      <div className='flex h-14 shrink-0 items-center px-4'>
        <Link to='/' className='rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60'>
          <FeedflowLogo className='text-[1.2rem]' />
        </Link>
      </div>
      <div className='flex gap-2 px-3 pb-3'>
        <Button className='flex-1' onClick={() => setDialog('add')}>
          <Plus /> Add feed
        </Button>
        <Button variant='outline' size='icon' aria-label='Discover feeds' title='Discover feeds' onClick={() => setDialog('discover')}>
          <Compass />
        </Button>
      </div>

      <nav aria-label='Library' className='min-h-0 flex-1 overflow-y-auto px-3 pb-4'>
        <ul className='space-y-px'>
          {VIEWS.map((item) => (
            <li key={item.view}>
              <button
                type='button'
                aria-current={scope.type === 'view' && scope.view === item.view}
                onClick={() => setScope({ type: 'view', view: item.view })}
                className={navItemClass}
              >
                {item.icon}
                <span className='truncate'>{item.label}</span>
                <NavCount value={counts.views[item.view]} strong={item.view === 'all'} />
              </button>
            </li>
          ))}
        </ul>

        <div className='mt-6 mb-1 flex items-center justify-between pr-1 pl-2'>
          <h2 className='text-xs font-medium text-muted-foreground'>Subscriptions</h2>
          <button
            type='button'
            aria-label='Manage subscriptions'
            title='Manage subscriptions'
            onClick={() => setDialog('manage')}
            className='flex size-6 items-center justify-center rounded text-muted-foreground outline-none hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60'
          >
            <Settings2 className='size-3.5' />
          </button>
        </div>

        {state.feeds.length === 0 ? (
          <button type='button' onClick={() => setDialog('discover')} className={cn(navItemClass, 'text-muted-foreground')}>
            <Compass /> Find something to read
          </button>
        ) : (
          <ul className='space-y-px'>
            {folders.map((folder) => {
              const feeds = state.feeds.filter((feed) => state.feedFolders[feed.name] === folder).sort(byName);
              const open = !collapsed.has(folder);
              return (
                <li key={folder}>
                  <div className='relative'>
                    <button
                      type='button'
                      aria-label={open ? `Collapse ${folder}` : `Expand ${folder}`}
                      aria-expanded={open}
                      onClick={() => toggleFolder(folder)}
                      className='absolute top-1 left-1 z-10 flex size-6 items-center justify-center rounded text-muted-foreground outline-none hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60'
                    >
                      {open ? <ChevronDown className='size-3.5' /> : <ChevronRight className='size-3.5' />}
                    </button>
                    <button
                      type='button'
                      aria-current={scope.type === 'folder' && scope.folder === folder}
                      onClick={() => setScope({ type: 'folder', folder })}
                      className={cn(navItemClass, 'pl-8 font-medium')}
                    >
                      <span className='truncate'>{folder}</span>
                      <NavCount value={counts.folders[folder] ?? 0} />
                    </button>
                  </div>
                  {open && feeds.length > 0 && (
                    <ul className='mt-px ml-[15px] space-y-px border-l border-border pl-1.5'>
                      {feeds.map((feed) => <li key={feed.name}><FeedRow feed={feed} nested /></li>)}
                    </ul>
                  )}
                </li>
              );
            })}
            {unfiled.map((feed) => <li key={feed.name}><FeedRow feed={feed} /></li>)}
          </ul>
        )}
      </nav>

      <div className='shrink-0 border-t border-border p-3'>
        {mode === 'account' ? <AccountMenu /> : (
          <button type='button' onClick={() => setDialog('shortcuts')} className={cn(navItemClass, 'text-muted-foreground')}>
            <Keyboard /> Keyboard shortcuts <Kbd className='ml-auto'>?</Kbd>
          </button>
        )}
      </div>
    </div>
  );
}

const SYNC_LABELS = { saved: 'Synced', saving: 'Saving…', error: 'Sync failed', offline: 'Offline' } as const;

function AccountMenu() {
  const { account, state, setDialog } = useReader();
  if (!account) return null;
  const initial = (account.name || account.email).trim().slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='flex w-full min-w-0 items-center gap-2.5 rounded-md p-1.5 text-left outline-none transition-colors hover:bg-foreground/[0.045] focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:bg-foreground/[0.045]'>
        <span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background'>{initial}</span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-[13px] font-medium'>{account.name || account.email}</span>
          <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', account.sync === 'error' && 'text-destructive')}>
            {account.sync === 'saving' ? <Spinner className='size-3' /> : <span className={cn('size-1.5 rounded-full', account.sync === 'saved' ? 'bg-primary' : account.sync === 'error' ? 'bg-destructive' : 'bg-muted-foreground')} />}
            {SYNC_LABELS[account.sync]}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side='top' align='start' className='w-60'>
        <DropdownMenuLabel className='truncate font-normal text-muted-foreground'>{account.email}</DropdownMenuLabel>
        {(account.sync === 'error' || account.sync === 'offline') && (
          <DropdownMenuItem onSelect={account.onRetrySync}>
            <RefreshCw /> Retry sync
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setDialog('manage')}>
          <Settings2 /> Manage subscriptions
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog('shortcuts')}>
          <Keyboard /> Keyboard shortcuts <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!state.feeds.length} onSelect={() => downloadOpml(state)}>
          <Download /> Export OPML
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={account.onSignOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
