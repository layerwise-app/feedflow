import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { readerState } from '~/db/schema';
import { auth } from '~/lib/auth';
import { validateReaderSnapshot } from '~/lib/reader-state-utils';

const userIdValidator = (input: unknown) => {
  if (!input || typeof input !== 'object' || !('userId' in input) || typeof input.userId !== 'string' || input.userId.length > 128) {
    throw new Error('Invalid reader account.');
  }
  return { userId: input.userId };
};

export const loadReaderState = createServerFn({ method: 'GET' })
  .validator(userIdValidator)
  .handler(async ({ data }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) return { authenticated: false as const, state: null };
  if (session.user.id !== data.userId) throw new Error('The active account changed during reader sync.');

  const [stored] = await db.select({ state: readerState.state })
    .from(readerState)
    .where(eq(readerState.userId, session.user.id))
    .limit(1);

  if (!stored) return { authenticated: true as const, state: null };
  return { authenticated: true as const, state: stored.state };
  });

export const saveReaderState = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object' || !('state' in input) || typeof input.state !== 'string' || !('userId' in input) || typeof input.userId !== 'string' || input.userId.length > 128) throw new Error('Invalid reader state.');
    validateReaderSnapshot(JSON.parse(input.state));
    return { state: input.state, userId: input.userId };
  })
  .handler(async ({ data }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() });
    if (!session) return { authenticated: false as const };
    if (session.user.id !== data.userId) throw new Error('The active account changed before reader state was saved.');

    const now = new Date();
    await db.insert(readerState)
      .values({ userId: session.user.id, state: data.state, updatedAt: now })
      .onConflictDoUpdate({
        target: readerState.userId,
        set: { state: data.state, updatedAt: now }
      });
    return { authenticated: true as const };
  });
