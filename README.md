# anilist-calendar

Generates iCal (`.ics`) feeds for a user's currently watching anime airing schedule from [AniList](https://anilist.co). Subscribe to the URL in Google Calendar, Apple Calendar, Outlook, etc. to see upcoming episodes on your calendar.

## Usage

```text
GET /<username>.ics
GET /?user=<username>
```

Returns a `text/calendar` response with `VEVENT` entries for each upcoming episode.

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

## Project structure

```text
src/
  handler.ts   # Shared request handler (platform-agnostic)
  index.ts     # Cloudflare Workers entry point (with edge caching)
  vercel.ts    # Vercel Edge Functions entry point
  cli.ts       # CLI preview tool
  anilist.ts   # AniList GraphQL queries + types
  ical.ts      # .ics string generation (RFC 5545)
```

## License

[MIT](LICENSE)
