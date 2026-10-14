import { createFileRoute } from '@tanstack/react-router';
import { ReaderApp } from '~/components/reader/reader-app';
import { createDemoState } from '~/lib/demo-snapshot';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/demo')({
  loader: () => ({ now: Date.now() }),
  head: () => ({ meta: seo({ title: 'Demo · Feedflow', description: 'Try Feedflow with a sample library. No account needed.' }) }),
  component: DemoPage
});

function DemoPage() {
  const { now } = Route.useLoaderData();
  // Sample stories are dated relative to the server clock, so both renders agree.
  return <ReaderApp mode='demo' initialState={createDemoState(now)} initialNow={now} />;
}
