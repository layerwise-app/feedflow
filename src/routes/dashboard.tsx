import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { ReaderApp } from '~/components/reader/reader-app';
import type { FeedFetcher } from '~/components/reader/reader-context';
import { ReaderSkeleton } from '~/components/reader/reader-skeleton';
import { useReaderLibrary, useReaderSync, type ReaderLibrary } from '~/components/reader/use-reader-sync';
import { signOut } from '~/lib/auth-client';
import { getAuthSession } from '~/lib/auth.functions';
import { fetchFeed } from '~/lib/feed.functions';
import { seo } from '~/utils/seo';

type ReaderUser = { id: string; email: string; name: string };

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: '/sign-in' });
    const user: ReaderUser = { id: session.user.id, email: session.user.email, name: session.user.name };
    return { user };
  },
  loader: () => ({ now: Date.now() }),
  head: () => ({ meta: seo({ title: 'Reader · Feedflow' }) }),
  component: DashboardPage
});

const fetcher: FeedFetcher = (input) => fetchFeed({ data: input });

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const { now } = Route.useLoaderData();
  const navigate = useNavigate();
  const library = useReaderLibrary(user.id);
  const signedOut = library.data?.kind === 'signed-out';

  useEffect(() => {
    if (signedOut) void navigate({ to: '/sign-in' });
  }, [signedOut, navigate]);

  if (library.data?.kind !== 'ready') return <ReaderSkeleton />;
  return (
    <AccountReader
      // A reloaded library replaces the reader's working state.
      key={library.dataUpdatedAt}
      user={user}
      now={now}
      library={library.data}
      onReload={() => void library.refetch()}
    />
  );
}

function AccountReader({ user, now, library, onReload }: {
  user: ReaderUser;
  now: number;
  library: Extract<ReaderLibrary, { kind: 'ready' }>;
  onReload: () => void;
}) {
  const navigate = useNavigate();
  const sync = useReaderSync({
    userId: user.id,
    library,
    onSignedOut: () => void navigate({ to: '/sign-in' }),
    onReload
  });

  async function onSignOut() {
    const result = await signOut();
    if (result.error) {
      toast.error(result.error.message ?? 'Could not sign out.');
      return;
    }
    await navigate({ to: '/' });
  }

  return (
    <ReaderApp
      mode='account'
      initialState={library.state}
      initialNow={now}
      fetcher={fetcher}
      onStateChange={sync.persist}
      account={{
        email: user.email,
        name: user.name || undefined,
        sync: sync.sync,
        onRetrySync: sync.retry,
        onSignOut: () => void onSignOut()
      }}
    />
  );
}
