import { CircleAlert, FolderPlus, RefreshCw, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { formatAgo } from '~/lib/reader-format';
import type { Feed } from '~/lib/reader-model';
import { AUTO_REFRESH_MINUTES } from '~/lib/reader-state-utils';
import { FeedMonogram } from './feed-monogram';
import { useReader } from './reader-context';

const NO_FOLDER = '__none__';

function refreshLabel(minutes: number) {
  if (!minutes) return 'Off';
  return minutes === 60 ? 'Every hour' : `Every ${minutes} min`;
}

export function ManageFeedsDialog() {
  const { dialog, setDialog, state, actions } = useReader();
  const [folderName, setFolderName] = useState('');
  const folders = [...new Set([...state.folders, ...Object.values(state.feedFolders)])].sort((left, right) => left.localeCompare(right));
  const feeds = [...state.feeds].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  const refreshingAll = actions.refreshing.size > 0;

  return (
    <Dialog open={dialog === 'manage'} onOpenChange={(open) => setDialog(open ? 'manage' : null)}>
      <DialogContent className='flex max-h-[min(48rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl'>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-5 pt-5 pb-4 pr-14 sm:px-6 sm:pr-14'>
          <DialogTitle className='font-serif text-2xl font-semibold tracking-[-0.015em]'>Subscriptions</DialogTitle>
          <div className='flex items-center gap-2 sm:ml-auto'>
            <Select value={String(state.autoRefreshMinutes)} onValueChange={(value) => actions.setAutoRefresh(Number(value))}>
              <SelectTrigger size='sm' aria-label='Auto-refresh' className='text-[13px]'>
                <span className='text-muted-foreground'>Auto-refresh</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_REFRESH_MINUTES.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{refreshLabel(minutes)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant='outline' size='sm' disabled={refreshingAll || !feeds.length} onClick={() => void actions.refreshFeeds()}>
              {refreshingAll ? <Spinner /> : <RefreshCw />} Refresh all
            </Button>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          {feeds.length === 0 ? (
            <p className='py-16 text-center text-sm text-muted-foreground'>No subscriptions yet.</p>
          ) : (
            <ul className='divide-y divide-border'>
              {feeds.map((feed) => <ManageRow key={`${feed.url}|${feed.name}`} feed={feed} folders={folders} />)}
            </ul>
          )}
        </div>

        <div className='flex flex-col gap-3 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:px-6'>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5'>
            <span className='mr-1 text-[13px] text-muted-foreground'>Folders</span>
            {folders.length === 0 && <span className='text-[13px] text-muted-foreground/70'>None</span>}
            {folders.map((folder) => (
              <span key={folder} className='inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card pr-1 pl-3 text-[13px]'>
                {folder}
                <button type='button' aria-label={`Delete folder ${folder}`} onClick={() => actions.removeFolder(folder)} className='flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground'>
                  <X className='size-3' />
                </button>
              </span>
            ))}
          </div>
          <form
            className='flex gap-2'
            onSubmit={(event) => {
              event.preventDefault();
              actions.addFolder(folderName);
              setFolderName('');
            }}
          >
            <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={80} placeholder='New folder' aria-label='New folder name' className='h-8 w-40 text-[13px]' />
            <Button type='submit' variant='outline' size='sm' disabled={!folderName.trim()}>
              <FolderPlus /> Add
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManageRow({ feed, folders }: { feed: Feed; folders: string[] }) {
  const { state, actions, now, timeZone } = useReader();
  const [name, setName] = useState(feed.name);
  const refreshing = actions.refreshing.has(feed.url);

  function commitName() {
    if (name.trim() === feed.name) return;
    try {
      actions.rename(feed.name, name);
    } catch (error) {
      setName(feed.name);
      actions.reportError(error, 'Could not rename this feed.');
    }
  }

  return (
    <li className='flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:px-6'>
      <div className='flex min-w-0 flex-1 items-start gap-3'>
        <FeedMonogram name={feed.name} className='mt-1.5 size-6 rounded-md text-xs' />
        <div className='min-w-0 flex-1'>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setName(feed.name);
            }}
            maxLength={160}
            aria-label={`Name for ${feed.url}`}
            className='-ml-1.5 h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm font-medium outline-none hover:border-border focus:border-ring/50 focus:bg-card focus:ring-2 focus:ring-ring/20'
          />
          <p className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
            <span className='truncate'>{feed.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
            <span aria-hidden='true'>·</span>
            {feed.error ? (
              <span title={feed.error} className='inline-flex shrink-0 items-center gap-1 font-medium text-destructive'>
                <CircleAlert className='size-3' /> Failed {formatAgo(feed.lastFetchedAt, now, timeZone).toLowerCase()}
              </span>
            ) : (
              <span className='shrink-0'>{feed.lastFetchedAt ? `Fetched ${formatAgo(feed.lastFetchedAt, now, timeZone).toLowerCase()}` : 'Not fetched yet'}</span>
            )}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-1 pl-9 sm:pl-0'>
        <Select value={state.feedFolders[feed.name] ?? NO_FOLDER} onValueChange={(folder) => actions.moveFeed(feed.name, folder === NO_FOLDER ? '' : folder)}>
          <SelectTrigger size='sm' aria-label={`Folder for ${feed.name}`} className='w-36 text-[13px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_FOLDER}>No folder</SelectItem>
            {folders.map((folder) => <SelectItem key={folder} value={folder}>{folder}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant='ghost' size='icon-sm' aria-label={`Refresh ${feed.name}`} disabled={refreshing} onClick={() => void actions.refreshFeeds([feed.url])}>
          {refreshing ? <Spinner /> : <RefreshCw />}
        </Button>
        <Button variant='ghost' size='icon-sm' aria-label={`Unsubscribe from ${feed.name}`} onClick={() => actions.unsubscribe(feed.name)} className='text-muted-foreground hover:text-destructive'>
          <Trash />
        </Button>
      </div>
    </li>
  );
}
