import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getWatchingMediaIds,
  getAiringSchedules,
  UserNotFoundError,
} from "../src/anilist";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockGraphQL(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ data }),
  });
}

function mockGraphQLError(message: string, status?: number) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ data: null, errors: [{ message, status }] }),
  });
}

function mockHTTPError(status: number, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1741500000000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Watching media ids
// ---------------------------------------------------------------------------

describe("getWatchingMediaIds", () => {
  it("returns flattened media IDs from all sub-lists", async () => {
    mockGraphQL({
      MediaListCollection: {
        lists: [
          { entries: [{ media: { id: 1 } }, { media: { id: 2 } }] },
          { entries: [{ media: { id: 3 } }] },
        ],
      },
    });

    const ids = await getWatchingMediaIds("testuser");
    expect(ids).toEqual([1, 2, 3]);
  });

  it("deduplicates media IDs across sub-lists", async () => {
    mockGraphQL({
      MediaListCollection: {
        lists: [
          { entries: [{ media: { id: 1 } }, { media: { id: 2 } }] },
          { entries: [{ media: { id: 2 } }, { media: { id: 3 } }] },
        ],
      },
    });

    const ids = await getWatchingMediaIds("testuser");
    expect(ids).toEqual([1, 2, 3]);
  });

  it("returns empty array when user has no entries", async () => {
    mockGraphQL({ MediaListCollection: { lists: [] } });
    const ids = await getWatchingMediaIds("testuser");
    expect(ids).toEqual([]);
  });

  it("throws UserNotFoundError when MediaListCollection is null", async () => {
    mockGraphQL({ MediaListCollection: null });
    await expect(getWatchingMediaIds("nobody")).rejects.toThrow(
      UserNotFoundError,
    );
  });

  it("throws UserNotFoundError on GraphQL 'not found' error", async () => {
    mockGraphQLError("User not found", 404);
    await expect(getWatchingMediaIds("nobody")).rejects.toThrow(
      UserNotFoundError,
    );
  });

  it("includes PLANNING status when includePlanning is true", async () => {
    mockGraphQL({ MediaListCollection: { lists: [] } });
    await getWatchingMediaIds("testuser", { includePlanning: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.statuses).toEqual(["CURRENT", "PLANNING"]);
  });

  it("only sends CURRENT status by default", async () => {
    mockGraphQL({ MediaListCollection: { lists: [] } });
    await getWatchingMediaIds("testuser");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.statuses).toEqual(["CURRENT"]);
  });
});

// ---------------------------------------------------------------------------
// Airing schedules
// ---------------------------------------------------------------------------

describe("getAiringSchedules", () => {
  it("returns empty array for empty mediaIds", async () => {
    const result = await getAiringSchedules([]);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches and returns airing schedules", async () => {
    const schedule = {
      airingAt: 1741521600,
      episode: 5,
      mediaId: 123,
      media: { title: { romaji: "Test", english: "Test" }, duration: 24 },
    };
    mockGraphQL({
      Page: { pageInfo: { hasNextPage: false }, airingSchedules: [schedule] },
    });

    const result = await getAiringSchedules([123]);
    expect(result).toEqual([schedule]);
  });

  it("paginates through multiple pages", async () => {
    mockGraphQL({
      Page: {
        pageInfo: { hasNextPage: true },
        airingSchedules: [
          {
            airingAt: 1,
            episode: 1,
            mediaId: 1,
            media: { title: { romaji: "A", english: null }, duration: 24 },
          },
        ],
      },
    });
    mockGraphQL({
      Page: {
        pageInfo: { hasNextPage: false },
        airingSchedules: [
          {
            airingAt: 2,
            episode: 2,
            mediaId: 1,
            media: { title: { romaji: "A", english: null }, duration: 24 },
          },
        ],
      },
    });

    const result = await getAiringSchedules([1]);
    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("uses past days offset for airingAfter", async () => {
    mockGraphQL({
      Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] },
    });

    await getAiringSchedules([1], { pastDays: 7 });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const now = Math.floor(1741500000000 / 1000);
    expect(body.variables.airingAfter).toBe(now - 7 * 86400);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting / retries
// ---------------------------------------------------------------------------

describe("rate limit handling", () => {
  it("retries on 429 and succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "1" }),
    });
    mockGraphQL({ MediaListCollection: { lists: [] } });

    const promise = getWatchingMediaIds("testuser");
    // Advance fake timers past the retry delay
    await vi.advanceTimersByTimeAsync(2000);

    const ids = await promise;
    expect(ids).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on 429", async () => {
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "1" }),
      });
    }

    const promise = getWatchingMediaIds("testuser");
    // Attach the rejection handler before advancing timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toThrow("rate limit exceeded");
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
  });

  it("throws on non-429 HTTP errors", async () => {
    mockHTTPError(500, "Internal Server Error");
    await expect(getWatchingMediaIds("testuser")).rejects.toThrow(
      "AniList API error 500",
    );
  });
});
