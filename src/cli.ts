/**
 * @module cli
 * CLI preview tool - dumps the .ics feed for a given AniList username to stdout.
 *
 * Usage:
 *   npx tsx src/cli.ts <username> [--planning] [--remind N] [--past N]
 *   npm run preview -- <username> [--planning] [--remind N] [--past N]
 */

import { parseArgs } from "node:util";
import { getWatchingMediaIds, getAiringSchedules } from "./anilist";
import { generateIcal } from "./ical";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      planning: { type: "boolean", default: false },
      remind: { type: "string", default: "0" },
      past: { type: "string", default: "0" },
    },
    allowPositionals: true,
  });

  const username = positionals[0];
  const includePlanning = values.planning!;
  const remindMinutes = Math.max(0, Number(values.remind) || 0);
  const pastDays = Math.max(0, Number(values.past) || 0);

  if (!username) {
    console.error("Usage: npx tsx src/cli.ts <username> [--planning] [--remind N] [--past N]");
    process.exit(1);
  }

  console.error(`Fetching airing schedule for "${username}"...`);
  if (includePlanning) console.error("  Including PLANNING list.");
  if (pastDays > 0) console.error(`  Including past ${pastDays} days.`);
  if (remindMinutes > 0) console.error(`  Adding ${remindMinutes}min reminders.`);

  const mediaIds = await getWatchingMediaIds(username, { includePlanning, pastDays });
  console.error(`Found ${mediaIds.length} anime on list.`);

  const schedules = await getAiringSchedules(mediaIds, { pastDays });
  console.error(`Found ${schedules.length} episodes.\n`);

  const ical = generateIcal(username, schedules, { remindMinutes });
  process.stdout.write(ical);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
