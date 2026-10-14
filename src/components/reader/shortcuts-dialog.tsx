import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Kbd } from '~/components/ui/kbd';
import { SHORTCUT_GROUPS } from './use-reader-shortcuts';
import { useReader } from './reader-context';

/** Key labels joined by "then" for sequences (g a) and "+" for chords (⇧ A). */
function Keys({ keys }: { keys: string[] }) {
  const chord = keys[0] === '⇧';
  const sequence = keys[0] === 'g';
  return (
    <span className='flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground'>
      {keys.map((key, index) => (
        <span key={key} className='flex items-center gap-1'>
          {index > 0 && !chord && (sequence ? <span>then</span> : <span>/</span>)}
          <Kbd className='h-6 min-w-6 rounded-md border border-border bg-card px-1.5 text-[12px] font-medium text-foreground shadow-[0_1px_0_var(--border)]'>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutsDialog() {
  const { dialog, setDialog } = useReader();
  return (
    <Dialog open={dialog === 'shortcuts'} onOpenChange={(open) => setDialog(open ? 'shortcuts' : null)}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl'>
        <DialogTitle className='font-serif text-2xl font-semibold tracking-[-0.015em]'>Keyboard shortcuts</DialogTitle>
        <div className='grid gap-x-10 gap-y-7 sm:grid-cols-2'>
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className='mb-2 text-xs font-medium text-muted-foreground'>{group.title}</h3>
              <ul className='divide-y divide-border/70'>
                {group.items.map((item) => (
                  <li key={item.label} className='flex items-center justify-between gap-4 py-1.5 text-[13.5px]'>
                    {item.label}
                    <Keys keys={item.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
