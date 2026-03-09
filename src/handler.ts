/**
 * @module handler
 * Shared request handler - parses the username from the URL, fetches
 * the user's airing schedule from AniList, and returns an iCal response.
 * Used by the Cloudflare Worker, Vercel, and any other HTTP adapter.
 */

import { getWatchingMediaIds, getAiringSchedules } from "./anilist";
import { generateIcal } from "./ical";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Parses the AniList username from the request and returns an iCal response.
 * Supports `/:username.ics` and `/?user=username` URL forms.
 */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // -- Parse username from URL ------------------------------------------
  let username: string | null = null;

  const match = path.match(/^\/([^/]+)\.ics$/);
  if (match) {
    username = match[1];
  } else if (path === "/" || path === "") {
    username = url.searchParams.get("user");
  }

  if (!username) {
    return new Response(
      "Usage: /<username>.ics or /?user=<username>",
      { status: 400, headers: { "Content-Type": "text/plain" } },
    );
  }

  try {
    const mediaIds = await getWatchingMediaIds(username);
    const schedules = await getAiringSchedules(mediaIds);
    const ical = generateIcal(username, schedules);

    return new Response(ical, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${username}.ics"`,
        "Cache-Control": "public, max-age=1800", // 30 minutes
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Error: ${message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
