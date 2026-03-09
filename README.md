# anilist-calendar

[![CI](https://github.com/gavxm/anilist-calendar/actions/workflows/ci.yml/badge.svg)](https://github.com/gavxm/anilist-calendar/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/anilist-calendar)](https://www.npmjs.com/package/anilist-calendar)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Generates iCal (`.ics`) feeds for a user's currently watching anime airing schedule from [AniList](https://anilist.co). Subscribe to the URL in Google Calendar, Apple Calendar, Outlook, etc. to see upcoming episodes on your calendar.

## Quick start

```sh
# One-off — no install needed
npx anilist-calendar <username> > schedule.ics

# Or install globally
npm install -g anilist-calendar
anilist-calendar <username> > schedule.ics
```

### CLI options

```sh
anilist-calendar <username> [--planning] [--remind N] [--past N]
```

- `--planning` — include anime from your PLANNING list
- `--remind N` — add reminders N minutes before each episode
- `--past N` — include episodes from the past N days

## Hosted usage

```text
GET /<username>.ics
GET /?user=<username>
```

Returns a `text/calendar` response with `VEVENT` entries for each upcoming episode.

Visiting `/` in a browser shows a landing page with a form to generate your feed URL.

### Query parameters

| Param | Example | Description |
| ----- | ------- | ----------- |
| `planning` | `?planning=1` | Include anime from your PLANNING list that are currently airing |
| `remind` | `?remind=30` | Add a VALARM reminder N minutes before each episode |
| `past` | `?past=7` | Include episodes from the past N days (max 90) |

Example: `/<username>.ics?planning=1&remind=15&past=7`

## Deploy

### Cloudflare Workers

```sh
npm install
npm run deploy
```

Requires [Wrangler](https://developers.cloudflare.com/workers/wrangler/) to be authenticated.

### Vercel Edge Functions

Copy or symlink `src/vercel.ts` to `api/index.ts` and deploy:

```sh
vercel --prod
```

## Development

```sh
npm run dev        # Start local Cloudflare Workers dev server
npm run preview -- <username>  # Dump .ics to stdout for debugging
npm run typecheck  # Type-check all source files
```

The CLI supports the same options as query params:

```sh
npm run preview -- <username> --planning --remind 30 --past 7
```

## Project structure

```text
src/
  handler.ts   # Shared request handler (platform-agnostic)
  index.ts     # Cloudflare Workers entry point (with edge caching)
  vercel.ts    # Vercel Edge Functions entry point
  cli.ts       # CLI preview tool
  landing.ts   # HTML landing page with username form
  anilist.ts   # AniList GraphQL queries + types
  ical.ts      # .ics string generation (RFC 5545)
```

## License

[MIT](LICENSE)
