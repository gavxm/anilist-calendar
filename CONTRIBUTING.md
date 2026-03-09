# Contributing to anilist-calendar

## Project structure

```text
src/
  handler.ts   # Shared request handler (platform-agnostic)
  index.ts     # Cloudflare Workers entry point (with edge caching)
  vercel.ts    # Vercel Edge Functions entry point
  cli.ts       # CLI tool
  landing.ts   # HTML landing page with username form
  anilist.ts   # AniList GraphQL queries + types
  ical.ts      # .ics string generation (RFC 5545)

tests/
  anilist.test.ts   # AniList API client tests
  handler.test.ts   # Request handler tests
  ical.test.ts      # iCal generation tests
```

## Submitting changes

1. Fork the repo and create a branch from `main`
2. Make your changes and add tests if applicable
3. Run `npm test` and `npm run typecheck` to verify
4. Open a pull request — CI will run automatically

## Setup

```bash
npm install
```

## Development workflow

```bash
npm run dev            # local Cloudflare Workers dev server
npm run preview -- <username>  # dump .ics to stdout for debugging
npm test               # run all tests
npm run test:watch     # watch mode
npm run typecheck      # type-check all source files
npm run build          # compile CLI for npm distribution
```

## Testing

Tests use [Vitest](https://vitest.dev) with `vi.stubGlobal("fetch", ...)` for API mocking.

- `tests/ical.test.ts` — iCal output structure, escaping, VALARM
- `tests/handler.test.ts` — routing, query params, error responses
- `tests/anilist.test.ts` — API client, pagination, rate limit retry
