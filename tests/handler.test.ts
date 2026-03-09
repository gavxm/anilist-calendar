import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleRequest } from "../src/handler";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../src/anilist", () => ({
  getWatchingMediaIds: vi.fn(),
  getAiringSchedules: vi.fn(),
  UserNotFoundError: class UserNotFoundError extends Error {
    constructor(username: string) {
      super(`AniList user "${username}" not found.`);
      this.name = "UserNotFoundError";
    }
  },
}));

vi.mock("../src/ical", () => ({
  generateIcal: vi.fn(() => "BEGIN:VCALENDAR\r\nEND:VCALENDAR"),
}));

vi.mock("../src/landing", () => ({
  landingPage: vi.fn(
    () =>
      new Response("<html>landing</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
  ),
}));

import {
  getWatchingMediaIds,
  getAiringSchedules,
  UserNotFoundError,
} from "../src/anilist";
import { generateIcal } from "../src/ical";

const mockGetWatchingMediaIds = vi.mocked(getWatchingMediaIds);
const mockGetAiringSchedules = vi.mocked(getAiringSchedules);

beforeEach(() => {
  mockGetWatchingMediaIds.mockResolvedValue([1, 2, 3]);
  mockGetAiringSchedules.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

describe("routing", () => {
  it("returns landing page at /", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("parses username from /:username.ics path", async () => {
    const res = await handleRequest(
      new Request("https://example.com/testuser.ics"),
    );
    expect(res.status).toBe(200);
    expect(mockGetWatchingMediaIds).toHaveBeenCalledWith(
      "testuser",
      expect.any(Object),
    );
  });

  it("parses username from ?user= query param", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?user=testuser"),
    );
    expect(res.status).toBe(200);
    expect(mockGetWatchingMediaIds).toHaveBeenCalledWith(
      "testuser",
      expect.any(Object),
    );
  });

  it("returns 400 for unrecognized paths", async () => {
    const res = await handleRequest(new Request("https://example.com/foo/bar"));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Response format
// ---------------------------------------------------------------------------

describe("response", () => {
  it("returns text/calendar content type", async () => {
    const res = await handleRequest(
      new Request("https://example.com/testuser.ics"),
    );
    expect(res.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
  });

  it("sets Content-Disposition with filename", async () => {
    const res = await handleRequest(
      new Request("https://example.com/testuser.ics"),
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="testuser.ics"',
    );
  });

  it("sets Cache-Control to 30 minutes", async () => {
    const res = await handleRequest(
      new Request("https://example.com/testuser.ics"),
    );
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=1800");
  });
});

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

describe("query params", () => {
  it("passes planning=1 to getWatchingMediaIds", async () => {
    await handleRequest(new Request("https://example.com/test.ics?planning=1"));
    expect(mockGetWatchingMediaIds).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        includePlanning: true,
      }),
    );
  });

  it("passes remind to generateIcal", async () => {
    await handleRequest(new Request("https://example.com/test.ics?remind=30"));
    expect(generateIcal).toHaveBeenCalledWith(
      "test",
      [],
      expect.objectContaining({
        remindMinutes: 30,
      }),
    );
  });

  it("passes past to getAiringSchedules", async () => {
    await handleRequest(new Request("https://example.com/test.ics?past=7"));
    expect(mockGetAiringSchedules).toHaveBeenCalledWith(
      [1, 2, 3],
      expect.objectContaining({
        pastDays: 7,
      }),
    );
  });

  it("clamps remind to max 1440", async () => {
    await handleRequest(
      new Request("https://example.com/test.ics?remind=9999"),
    );
    expect(generateIcal).toHaveBeenCalledWith(
      "test",
      [],
      expect.objectContaining({
        remindMinutes: 1440,
      }),
    );
  });

  it("clamps past to max 90", async () => {
    await handleRequest(new Request("https://example.com/test.ics?past=999"));
    expect(mockGetAiringSchedules).toHaveBeenCalledWith(
      [1, 2, 3],
      expect.objectContaining({
        pastDays: 90,
      }),
    );
  });

  it("ignores negative values", async () => {
    await handleRequest(
      new Request("https://example.com/test.ics?remind=-5&past=-10"),
    );
    expect(generateIcal).toHaveBeenCalledWith(
      "test",
      [],
      expect.objectContaining({
        remindMinutes: 0,
      }),
    );
    expect(mockGetAiringSchedules).toHaveBeenCalledWith(
      [1, 2, 3],
      expect.objectContaining({
        pastDays: 0,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("returns 404 for UserNotFoundError", async () => {
    mockGetWatchingMediaIds.mockRejectedValue(new UserNotFoundError("nobody"));
    const res = await handleRequest(
      new Request("https://example.com/nobody.ics"),
    );
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain("nobody");
  });

  it("returns 502 for generic errors", async () => {
    mockGetWatchingMediaIds.mockRejectedValue(new Error("API down"));
    const res = await handleRequest(
      new Request("https://example.com/testuser.ics"),
    );
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain("API down");
  });
});
