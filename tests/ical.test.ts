import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateIcal } from "../src/ical";
import type { AiringSchedule } from "../src/anilist";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSchedule(overrides: Partial<AiringSchedule> = {}): AiringSchedule {
  return {
    airingAt: 1741521600, // 2025-03-09T12:00:00Z
    episode: 5,
    mediaId: 12345,
    media: {
      title: {
        romaji: "Sousou no Frieren",
        english: "Frieren: Beyond Journey's End",
      },
      duration: 24,
    },
    ...overrides,
  };
}

// Pin Date.now so DTSTAMP is deterministic
const FAKE_NOW = 1741500000000; // 2025-03-09T06:00:00Z

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FAKE_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Calendar structure
// ---------------------------------------------------------------------------

describe("generateIcal", () => {
  it("produces a valid VCALENDAR wrapper", () => {
    const ical = generateIcal("testuser", []);
    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("END:VCALENDAR");
    expect(ical).toContain("VERSION:2.0");
    expect(ical).toContain("PRODID:-//anilist-calendar//EN");
    expect(ical).toContain("METHOD:PUBLISH");
  });

  it("includes the username in the calendar name", () => {
    const ical = generateIcal("testuser", []);
    expect(ical).toContain("X-WR-CALNAME:testuser's Anime Airing Schedule");
  });

  it("escapes special characters in the username", () => {
    const ical = generateIcal("user,with;special", []);
    expect(ical).toContain(
      "X-WR-CALNAME:user\\,with\\;special's Anime Airing Schedule",
    );
  });

  it("returns no VEVENT blocks for an empty schedule", () => {
    const ical = generateIcal("testuser", []);
    expect(ical).not.toContain("BEGIN:VEVENT");
  });
});

// ---------------------------------------------------------------------------
// Event generation
// ---------------------------------------------------------------------------

describe("VEVENT output", () => {
  it("generates a VEVENT for each schedule entry", () => {
    const schedules = [
      makeSchedule(),
      makeSchedule({ mediaId: 99999, episode: 1 }),
    ];
    const ical = generateIcal("testuser", schedules);

    const eventCount = (ical.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(2);
  });

  it("includes correct UID, DTSTART, DTEND, SUMMARY", () => {
    const ical = generateIcal("testuser", [makeSchedule()]);

    expect(ical).toContain("UID:anilist-12345-ep5@anilist-calendar");
    expect(ical).toContain("DTSTART:20250309T120000Z");
    // 24 min duration → 12:24:00Z
    expect(ical).toContain("DTEND:20250309T122400Z");
    expect(ical).toContain("SUMMARY:Frieren: Beyond Journey's End - Episode 5");
  });

  it("includes DTSTAMP set to current time", () => {
    const ical = generateIcal("testuser", [makeSchedule()]);
    // FAKE_NOW = 1741500000 seconds → 2025-03-09T06:00:00Z
    expect(ical).toContain("DTSTAMP:20250309T060000Z");
  });

  it("falls back to romaji when english title is null", () => {
    const schedule = makeSchedule({
      media: {
        title: { romaji: "Sousou no Frieren", english: null },
        duration: 24,
      },
    });
    const ical = generateIcal("testuser", [schedule]);
    expect(ical).toContain("SUMMARY:Sousou no Frieren - Episode 5");
  });

  it("uses 24-minute default when duration is null", () => {
    const schedule = makeSchedule({
      media: { title: { romaji: "Test", english: "Test" }, duration: null },
    });
    const ical = generateIcal("testuser", [schedule]);
    // airingAt = 12:00:00, +24min = 12:24:00
    expect(ical).toContain("DTEND:20250309T122400Z");
  });

  it("uses actual duration when provided", () => {
    const schedule = makeSchedule({
      media: { title: { romaji: "Test", english: "Test" }, duration: 48 },
    });
    const ical = generateIcal("testuser", [schedule]);
    // airingAt = 12:00:00, +48min = 12:48:00
    expect(ical).toContain("DTEND:20250309T124800Z");
  });
});

// ---------------------------------------------------------------------------
// VALARM reminders
// ---------------------------------------------------------------------------

describe("VALARM reminders", () => {
  it("does not include VALARM by default", () => {
    const ical = generateIcal("testuser", [makeSchedule()]);
    expect(ical).not.toContain("BEGIN:VALARM");
  });

  it("does not include VALARM when remindMinutes is 0", () => {
    const ical = generateIcal("testuser", [makeSchedule()], {
      remindMinutes: 0,
    });
    expect(ical).not.toContain("BEGIN:VALARM");
  });

  it("includes VALARM with correct trigger when remindMinutes is set", () => {
    const ical = generateIcal("testuser", [makeSchedule()], {
      remindMinutes: 30,
    });
    expect(ical).toContain("BEGIN:VALARM");
    expect(ical).toContain("TRIGGER:-PT30M");
    expect(ical).toContain("ACTION:DISPLAY");
    expect(ical).toContain("END:VALARM");
  });
});

// ---------------------------------------------------------------------------
// RFC 5545 compliance
// ---------------------------------------------------------------------------

describe("RFC 5545 compliance", () => {
  it("uses CRLF line endings", () => {
    const ical = generateIcal("testuser", [makeSchedule()]);
    // Every line break should be \r\n
    const lines = ical.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    // Should not have bare \n (outside of \r\n)
    expect(ical.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("escapes commas and semicolons in titles", () => {
    const schedule = makeSchedule({
      media: {
        title: { romaji: "Test", english: "Title, with; specials" },
        duration: 24,
      },
    });
    const ical = generateIcal("testuser", [schedule]);
    expect(ical).toContain("SUMMARY:Title\\, with\\; specials - Episode 5");
  });
});
