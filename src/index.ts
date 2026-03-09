/**
 * @module index
 * Cloudflare Worker entry point - serves iCal feeds of a user's anime airing schedule.
 *
 * Routes:
 *   - `GET /:username.ics`  → returns the .ics feed for that AniList user
 *   - `GET /?user=username` → alternate query param form
 *
 * Responses are cached for 30 minutes via the Cloudflare Cache API to
 * avoid excessive requests to the AniList API on every calendar poll.
 */

import { handleRequest } from "./handler";

// ---------------------------------------------------------------------------
// Worker handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    // Check cache first
    const cache = caches.default;
    const cacheKey = new Request(new URL(request.url).toString(), request);

    let response = await cache.match(cacheKey);
    if (response) return response;

    response = await handleRequest(request);

    // Store successful responses in Cloudflare's edge cache (non-blocking)
    if (response.ok) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};
