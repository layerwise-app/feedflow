<a href="https://layerwise.app"><picture><source media="(prefers-color-scheme: dark)" srcset="https://layerwise.app/powered-by-dark.png"><img src="https://layerwise.app/powered-by.png" alt="Powered by Layerwise" width="174" height="28"></picture></a>

# Feedflow

Feedflow is a fast, keyboard-first RSS reader for the sites and writers you
follow. It's for people who want their own calm, ad-free place to read blogs,
newsletters, and news, and for anyone who wants a full-stack reader app to
build on.

Visitors can try the full reader on a sample library without an account, or
sign up to subscribe to any website or feed URL, browse a hand-picked Discover
directory, read in three layouts, star stories or save them for later,
highlight passages and add notes, and import or export OPML. Try the live demo
at [feedflow.layerwise.site](https://feedflow.layerwise.site/).

Feedflow was built with [Layerwise](https://layerwise.app), and you can open it
in Layerwise to make your own version.

## Features

- Three-pane reader with List, Cards, and Magazine layouts.
- Keyboard shortcuts: `j`/`k`, `o`, `s`, `l`, `m`, `v`, `Shift+A`, `/`,
  `g` then `a`/`s`/`l`/`n`/`d`, and `?` for the full list.
- Unread counts per feed, folder, and view; mark all read, or only stories
  older than a day or a week.
- Discover: a curated directory of 30 feeds in five categories, with one-click
  subscribe.
- Feed management: rename, move to a folder, unsubscribe, refresh one or all,
  last-fetched time with error badges, and auto-refresh.
- Highlights and notes, collected in a Notes view.
- Reading settings (typeface, size, width) that sync with your library, plus a
  light, dark, or automatic theme.
- Search, sorting, starred, read later, and OPML import and export.
- Sign in with email and password or a one-time email code, with password
  reset.
- `/demo` runs the full reader on a sample library without an account. Nothing
  in the demo is saved.

## Making it your own

### Copy and pages

- Landing page headline, feature sections, and footer:
  `src/components/landing/landing-page.tsx`. The small product previews beside
  each feature are in `src/components/landing/feature-snippets.tsx`, and the
  large reader preview is in `src/components/landing/reader-preview.tsx`.
- Page titles and descriptions: the site-wide defaults are in
  `src/routes/__root.tsx`, and each route sets its own with `seo()` from
  `src/utils/seo.ts`.
- Sign-in and sign-up screens: `src/routes/sign-in.tsx`,
  `src/routes/sign-up.tsx`, `src/routes/sign-in_.otp.tsx`, and
  `src/routes/forgot-password.tsx`, framed by `src/components/auth-shell.tsx`.
- Logo: `FeedflowMark` and `FeedflowLogo` in `src/components/brand.tsx`. The
  favicons and app icons are in `public/`, and the installed app name is in
  `public/site.webmanifest`.
- The Powered by Layerwise badge in the landing footer is
  `src/components/powered-by-layerwise.tsx`.

### Colors and fonts

- Colors are CSS variables in `src/styles/app.css`: `:root` holds the light
  theme and `.dark` the dark theme. The accent is `--primary` (`#2340e0` in
  light, `#7c8cff` in dark).
- If you change the light background (`#f6f4ef`), also update `theme-color`
  in `src/routes/__root.tsx` and `theme_color` and `background_color` in
  `public/site.webmanifest`.
- Inter and Newsreader load from Google Fonts through `FONTS_URL` in
  `src/routes/__root.tsx`, and `--font-sans` and `--font-serif` in
  `src/styles/app.css` map them to Tailwind's `font-sans` and `font-serif`.

### Add a feed to Discover

Discover lists the feeds in `DISCOVER_FEEDS` in `src/lib/discover-catalog.ts`.
Add an entry with a public RSS or Atom URL:

```ts
{ category: 'Tech', name: 'Example Blog', site: 'example.com', url: 'https://example.com/feed.xml', description: 'One short line about the feed.' },
```

`category` must be one of `DISCOVER_CATEGORIES` (`Tech`, `Design`, `Science`,
`News`, `Culture`). To add a category, add it to both the `DiscoverCategory`
type and `DISCOVER_CATEGORIES`. The landing page's Discover preview shows four
of these feeds by name (`DISCOVER_SAMPLE` in
`src/components/landing/feature-snippets.tsx`), so update that list if you
remove one of them.

### Change the demo library

The sample library for `/demo` and the landing page previews lives in
`src/lib/demo-snapshot.ts`: `DEMO_FEEDS` lists the feeds, `DEMO_ITEMS` holds
the stories, and `createDemoState` sets the folders. Story times are given in
`ageMinutes`, so the demo always looks current. The landing page expects at
least one story with a `note`, stories from Quanta Magazine and NASA for the
layouts preview, and a story with id 4 (`OPEN_STORY_ID` in
`src/components/landing/reader-preview.tsx`), so keep those or update the
landing components to match.

### Settings and secrets

`wrangler.jsonc` defines the Worker's D1 binding and its variables.
`BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` configure Better Auth in
`src/lib/auth.ts`, and `AUTH_EMAIL_URL` is the required secret that
`src/lib/auth-email.ts` posts sign-in codes to. Keep secrets server-side:
variables prefixed with `VITE_` are included in the browser bundle.

## Commands

```bash
pnpm dev                                  # start the local dev server
pnpm check-types                          # type-check with tsc
pnpm test:feeds                           # run the tests in src/lib/*.test.mjs
pnpm build                                # type-check and build
pnpm auth:generate                        # regenerate Better Auth's schema
pnpm db:generate --name <migration_name>  # generate a Drizzle migration
pnpm db:migrate                           # apply migrations to the local D1 database
pnpm cf-typegen                           # regenerate Worker binding types
pnpm release                              # deploy with Wrangler
```

`db:migrate` applies generated Drizzle migrations to the local D1 database.
Layerwise applies the same migrations to the project's production D1 database
during publishing.

## Important files

- `src/routes/`: `/` landing, `/dashboard` reader, `/demo`, and auth pages
- `src/components/landing/`: landing page and its previews
- `src/components/reader/`: reader UI shared by `/dashboard` and `/demo`
- `src/lib/reader-model.ts`: pure reader state transitions
- `src/lib/reader-state-utils.ts`: saved library validation
- `src/lib/reader-state.functions.ts`: loads and saves each reader's library
- `src/lib/feed.functions.ts`: fetches feeds and finds the feed for a website
  URL
- `src/lib/discover-catalog.ts`: the Discover directory
- `src/lib/demo-snapshot.ts`: the sample library
- `src/lib/auth.ts`: Better Auth server configuration
- `src/lib/auth.functions.ts`: client-callable server functions
- `src/db/schema.ts`: Drizzle schema; each reader's library is one row in
  `reader_state`
- `vite.config.ts`: Cloudflare, TanStack Start, React, Tailwind, and Layerwise
  plugins
- `wrangler.jsonc`: local Worker and D1 bindings
