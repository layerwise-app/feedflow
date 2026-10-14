import { Skeleton } from '~/components/ui/skeleton';

/** Placeholder with the reader's frame while the library loads. */
export function ReaderSkeleton() {
  return (
    <div className='flex h-dvh overflow-hidden bg-background' aria-busy='true' aria-label='Loading your library'>
      <aside className='hidden w-[264px] shrink-0 flex-col gap-6 border-r border-border bg-sidebar p-4 lg:flex'>
        <Skeleton className='h-6 w-28' />
        <Skeleton className='h-9 w-full' />
        <div className='flex flex-col gap-2.5'>
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className='h-5 w-full' />)}
        </div>
        <div className='flex flex-col gap-2.5'>
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className='h-5' style={{ width: `${88 - index * 9}%` }} />)}
        </div>
      </aside>
      <main className='flex min-w-0 flex-1 flex-col'>
        <div className='flex h-[106px] flex-col justify-center gap-3 border-b border-border px-5'>
          <Skeleton className='h-7 w-40' />
          <Skeleton className='h-7 w-64' />
        </div>
        <div className='flex flex-col divide-y divide-border'>
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className='flex flex-col gap-2 px-5 py-4'>
              <Skeleton className='h-3.5 w-32' />
              <Skeleton className='h-5' style={{ width: `${80 - (index % 3) * 14}%` }} />
              <Skeleton className='h-4 w-11/12' />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
