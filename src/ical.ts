/**
 * @module ical
 * iCal (.ics) feed generator - converts airing schedules into RFC 5545 calendar events.
 */

import { AiringSchedule } from "./anilist.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for customizing the generated iCal feed. */
export interface IcalOptions {
  /** Minutes before the event to trigger a VALARM reminder. 0 = no reminder. */
  remindMinutes?: number;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Converts a Unix timestamp to iCal UTC date format (`YYYYMMDDTHHmmssZ`). */
function formatDate(unix: number): string {
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Escapes special characters per RFC 5545 (backslash, semicolon, comma, newline). */
function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// ---------------------------------------------------------------------------
// Event builder
// ---------------------------------------------------------------------------

/**
 * Builds a single VEVENT block for an airing episode.
 * Falls back to 24 minutes if the show has no duration set on AniList.
 */
function buildEvent(schedule: AiringSchedule, now: string, options: IcalOptions): string {
  const title = schedule.media.title.english || schedule.media.title.romaji;
  const durationMin = schedule.media.duration || 24;
  const start = schedule.airingAt;
  const end = start + durationMin * 60;

  const lines = [
    "BEGIN:VEVENT",
    `UID:anilist-${schedule.mediaId}-ep${schedule.episode}@anilist-calendar`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${escapeText(title)} - Episode ${schedule.episode}`,
    `DESCRIPTION:${escapeText(title)} Episode ${schedule.episode}`,
  ];

  // Optional pre-event reminder
  if (options.remindMinutes && options.remindMinutes > 0) {
    lines.push(
      "BEGIN:VALARM",
      "TRIGGER:-PT" + options.remindMinutes + "M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(title)} - Episode ${schedule.episode} starts soon`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Calendar generator
// ---------------------------------------------------------------------------

/**
 * Generates a complete .ics calendar string from a list of airing schedules.
 * The output is a valid iCal feed that calendar apps can subscribe to.
 */
export function generateIcal(
  username: string,
  schedules: AiringSchedule[],
  options: IcalOptions = {},
): string {
  const now = formatDate(Math.floor(Date.now() / 1000));
  const events = schedules.map((s) => buildEvent(s, now, options));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//anilist-calendar//EN",
    `X-WR-CALNAME:${escapeText(username)}'s Anime Airing Schedule`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
