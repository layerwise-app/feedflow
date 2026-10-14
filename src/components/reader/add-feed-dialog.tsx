import { useMutation } from '@tanstack/react-query';
import { Compass, Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { downloadOpml } from './opml';
import { useReader } from './reader-context';

const NO_FOLDER = '__none__';

export function AddFeedDialog() {
  const { dialog, setDialog, state, actions, setScope } = useReader();
  const [url, setUrl] = useState('');
  const [folder, setFolder] = useState(NO_FOLDER);
  const fileRef = useRef<HTMLInputElement>(null);
  const folders = [...new Set([...state.folders, ...Object.values(state.feedFolders)])].sort((left, right) => left.localeCompare(right));

  const subscription = useMutation({
    mutationFn: () => actions.subscribe(url, { folder: folder === NO_FOLDER ? '' : folder }),
    onSuccess: (name) => {
      if (!name) return;
      setUrl('');
      setDialog(null);
      setScope({ type: 'feed', feed: name });
    }
  });

  const opmlImport = useMutation({
    mutationFn: (file: File) => actions.importOpml(file),
    onSuccess: (result) => {
      if (result?.imported) setDialog(null);
    },
    onSettled: () => {
      if (fileRef.current) fileRef.current.value = '';
    }
  });

  function onOpenChange(open: boolean) {
    setDialog(open ? 'add' : null);
    if (!open) {
      subscription.reset();
      opmlImport.reset();
    }
  }

  const error = subscription.error ?? opmlImport.error;

  return (
    <Dialog open={dialog === 'add'} onOpenChange={onOpenChange}>
      <DialogContent className='gap-5 sm:max-w-[28rem]'>
        <DialogTitle className='font-serif text-2xl font-semibold tracking-[-0.015em]'>Add a feed</DialogTitle>
        <form
          className='flex flex-col gap-3'
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim()) subscription.mutate();
          }}
        >
          <Input
            autoFocus
            inputMode='url'
            autoComplete='off'
            spellCheck={false}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              subscription.reset();
            }}
            placeholder='Website or feed URL'
            aria-label='Website or feed URL'
            aria-invalid={Boolean(subscription.error)}
            className='h-10'
          />
          <div className='flex gap-2'>
            {folders.length > 0 && (
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger aria-label='Folder' className='h-10 min-w-0 flex-1'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                  {folders.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button type='submit' className='h-10 flex-1' disabled={subscription.isPending || !url.trim()}>
              {subscription.isPending && <Spinner />}
              Subscribe
            </Button>
          </div>
          {error && <p role='alert' className='text-[13px] text-destructive'>{error instanceof Error ? error.message : 'Something went wrong.'}</p>}
        </form>

        <div className='flex flex-wrap items-center gap-1 border-t border-border pt-4'>
          <input
            ref={fileRef}
            type='file'
            accept='.opml,.xml,text/xml,application/xml,text/x-opml'
            className='hidden'
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) opmlImport.mutate(file);
            }}
          />
          <Button variant='ghost' size='sm' disabled={opmlImport.isPending} onClick={() => actions.canFetch ? fileRef.current?.click() : actions.needsAccount()}>
            {opmlImport.isPending ? <Spinner /> : <Upload />} Import OPML
          </Button>
          <Button variant='ghost' size='sm' disabled={!state.feeds.length} onClick={() => downloadOpml(state)}>
            <Download /> Export OPML
          </Button>
          <Button variant='ghost' size='sm' className='ml-auto' onClick={() => setDialog('discover')}>
            <Compass /> Discover
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
