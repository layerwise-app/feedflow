# Feedflow

<a href="https://layerwise.app"><img src="https://layerwise.app/powered-by.png" alt="Powered by Layerwise" width="320" /></a>

A fast, keyboard-first RSS reader inspired by
[Google Reader](https://en.wikipedia.org/wiki/Google_Reader). Built with
TanStack Start on Cloudflare Workers, with Better Auth and a D1 database.

## Features

- Three-pane reader with List, Cards, and Magazine layouts.
- Google Reader shortcuts: `j`/`k`, `o`, `s`, `l`, `m`, `v`, `Shift+A`, `/`,
  `g` then `a`/`s`/`l`/`n`/`d`, and `?` for the full list.
- Unread counts per feed, folder, and view; mark all read, or only stories
  older than a day or a week.
- Discover: a curated directory with one-click subscribe.
- Feed management: rename, move to a folder, unsubscribe, refresh one or all,
  last-fetched time with error badges, and auto-refresh.
- Highlights and notes, collected in a Notes view.
- Reading settings (font, size, width) that sync with your library.
- Search, sorting, starred, read later, and OPML import and export.
- `/demo` runs the full reader on a sample library without an account.

## Commands

```bash
pnpm dev
pnpm check-types
pnpm test:feeds
pnpm build
pnpm auth:generate
pnpm db:generate --name <migration_name>
pnpm db:migrate
pnpm cf-typegen
pnpm release
```

`db:migrate` applies generated Drizzle migrations to the local D1 database.
Layerwise applies the same migrations to the project's production D1 database
during publishing.

## Important files

- `src/routes/`: `/` landing, `/dashboard` reader, `/demo`, and auth pages
- `src/components/reader/`: reader UI shared by `/dashboard` and `/demo`
- `src/lib/reader-model.ts`: pure reader state transitions
- `src/lib/reader-state-utils.ts`: saved library validation
- `src/lib/auth.ts`: Better Auth server configuration
- `src/lib/auth.functions.ts`: client-callable server functions
- `src/db/schema.ts`: Drizzle schema
- `vite.config.ts`: Cloudflare, TanStack Start, React, Tailwind, and Layerwise
  plugins
- `wrangler.jsonc`: local Worker and D1 bindings

Keep secrets server-side. Variables prefixed with `VITE_` are included in the
browser bundle. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `AUTH_EMAIL_URL`
belong in the Worker environment.
