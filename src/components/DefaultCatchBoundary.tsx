import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId
  });

  console.error(error);

  return (
    <main className='flex min-h-dvh min-w-0 flex-1 flex-col items-center justify-center gap-6 bg-background p-6 text-center'>
      <h1 className='font-serif text-3xl font-semibold tracking-[-0.02em]'>Something went wrong</h1>
      <div className='max-w-lg text-sm text-muted-foreground'>
        <ErrorComponent error={error} />
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <Button onClick={() => void router.invalidate()}>Try again</Button>
        {isRoot ? (
          <Button variant='outline' asChild>
            <Link to='/'>Home</Link>
          </Button>
        ) : (
          <Button variant='outline' onClick={() => window.history.back()}>Go back</Button>
        )}
      </div>
    </main>
  );
}
