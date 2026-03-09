/**
 * @module cli
 * CLI preview tool - dumps the .ics feed for a given AniList username to stdout.
 *
 * Usage:
 *   npx tsx src/cli.ts <username>
 *   npm run preview -- <username>
 */

import { getWatchingMediaIds, getAiringSchedules } from "./anilist";
import { generateIcal } from "./ical";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error("Usage: npx tsx src/cli.ts <username>");
    process.exit(1);
  }

  console.error(`Fetching airing schedule for "${username}"...`);

  const mediaIds = await getWatchingMediaIds(username);
  console.error(`Found ${mediaIds.length} anime on watching list.`);

  const schedules = await getAiringSchedules(mediaIds);
  console.error(`Found ${schedules.length} upcoming episodes.\n`);

  const ical = generateIcal(username, schedules);
  process.stdout.write(ical);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
