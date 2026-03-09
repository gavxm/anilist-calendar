/**
 * @module handler
 * Shared request handler - parses the username and query params from the URL,
 * fetches the user's airing schedule from AniList, and returns an iCal response.
 * Used by the Cloudflare Worker, Vercel, and any other HTTP adapter.
 */

import { getWatchingMediaIds, getAiringSchedules, UserNotFoundError } from "./anilist.js";
import { generateIcal } from "./ical.js";
import { landingPage } from "./landing.js";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Parses the AniList username from the request and returns an iCal response.
 *
 * Supports:
 *   - `/:username.ics` path form
 *   - `/?user=username` query param form
 *   - `/` with no params returns the landing page
 *
 * Query params:
 *   - `planning=1` — include anime from the PLANNING list
 *   - `remind=N`   — add a VALARM reminder N minutes before each event
 *   - `past=N`     — include episodes from the past N days (max 90)
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

  // Show landing page if no username provided at root
  if (!username && (path === "/" || path === "")) {
    return landingPage();
  }

  if (!username) {
    return new Response(
      "Usage: /<username>.ics or /?user=<username>",
      { status: 400, headers: { "Content-Type": "text/plain" } },
    );
  }

  // Parse query params
  const includePlanning = url.searchParams.get("planning") === "1";
  const remindMinutes = Math.max(0, Math.min(1440, Number(url.searchParams.get("remind")) || 0));
  const pastDays = Math.max(0, Math.min(90, Number(url.searchParams.get("past")) || 0));

  try {
    const mediaIds = await getWatchingMediaIds(username, { includePlanning, pastDays });
    const schedules = await getAiringSchedules(mediaIds, { pastDays });
    const ical = generateIcal(username, schedules, { remindMinutes });

    return new Response(ical, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${username}.ics"`,
        "Cache-Control": "public, max-age=1800", // 30 minutes
      },
    });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      return new Response(err.message, {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Error: ${message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
