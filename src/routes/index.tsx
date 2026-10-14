import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '~/components/landing/landing-page';
import { getAuthSession } from '~/lib/auth.functions';

export const Route = createFileRoute('/')({
  loader: async () => {
    const session = await getAuthSession();
    return { signedIn: Boolean(session), now: Date.now() };
  },
  component: HomePage
});

function HomePage() {
  const { signedIn, now } = Route.useLoaderData();
  return <LandingPage signedIn={signedIn} now={now} />;
}
