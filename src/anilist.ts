/**
 * @module anilist
 * AniList GraphQL client - fetches a user's watching list and upcoming airing times.
 */

const ANILIST_API = "https://graphql.anilist.co";

const MAX_RETRIES = 3;
const MAX_PAGES = 20;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches anime on a user's list filtered by status.
 * Supports CURRENT, PLANNING, or both.
 */
const WATCHING_QUERY = `
query ($username: String, $statuses: [MediaListStatus]) {
  MediaListCollection(userName: $username, type: ANIME, status_in: $statuses) {
    lists {
      entries {
        media {
          id
        }
      }
    }
  }
}`;

/**
 * Fetches episode air times for a set of media IDs.
 * Controls the time window, and paginates in batches of 50 to 
 * handle users watching many shows.
 */
const AIRING_QUERY = `
query ($mediaIds: [Int], $airingAfter: Int, $airingBefore: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
    }
    airingSchedules(mediaId_in: $mediaIds, airingAt_greater: $airingAfter, airingAt_lesser: $airingBefore, sort: TIME) {
      airingAt
      episode
      mediaId
      media {
        title {
          romaji
          english
        }
        duration
      }
    }
  }
}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single upcoming episode airing entry from the AniList API. */
export interface AiringSchedule {
  // Unix timestamp of when the episode airs
  airingAt: number;
  episode: number;
  // AniList media ID for the show
  mediaId: number;
  media: {
    title: { romaji: string; english: string | null };
    // Episode length in minutes, or `null` if unknown
    duration: number | null;
  };
}

/** Options for filtering the airing schedule query. */
export interface AiringOptions {
  // Include anime from the user's PLANNING list that are currently airing
  includePlanning?: boolean;
  // Include episodes from the past N days
  pastDays?: number;
}

/** Thrown when the AniList username does not exist. */
export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`AniList user "${username}" not found.`);
    this.name = "UserNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// GraphQL helper
// ---------------------------------------------------------------------------

/**
 * Sends a GraphQL request to the AniList API.
 * Retries with exponential backoff on 429 (rate limit) responses.
 * @throws On HTTP errors or GraphQL-level errors.
 */
async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    // Retry on rate limit with exponential backoff
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AniList API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      data: T;
      errors?: { message: string; status?: number }[];
    };
    if (json.errors?.length) {
      // AniList returns "User not found" as a GraphQL error
      const msg = json.errors[0].message;
      if (msg.toLowerCase().includes("not found") || json.errors[0].status === 404) {
        throw new UserNotFoundError(String(variables.username ?? "unknown"));
      }
      throw new Error(`AniList GraphQL error: ${msg}`);
    }
    return json.data;
  }

  throw new Error("AniList API rate limit exceeded after retries.");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the AniList media IDs for anime on the user's list.
 * Fetches CURRENT by default; also includes PLANNING if specified.
 */
export async function getWatchingMediaIds(
  username: string,
  options: AiringOptions = {},
): Promise<number[]> {
  const statuses = ["CURRENT"];
  if (options.includePlanning) statuses.push("PLANNING");

  const data = await gql<{
    MediaListCollection: {
      lists: { entries: { media: { id: number } }[] }[];
    } | null;
  }>(WATCHING_QUERY, { username, statuses });

  if (!data.MediaListCollection) {
    throw new UserNotFoundError(username);
  }

  // AniList groups entries into sub-lists, so we flatten and deduplicate.
  const ids = data.MediaListCollection.lists.flatMap((list) =>
    list.entries.map((e) => e.media.id),
  );
  return [...new Set(ids)];
}

/**
 * Fetches airing episodes for the given media IDs.
 * Automatically paginates. Includes past episodes if `pastDays` is set.
 */
export async function getAiringSchedules(
  mediaIds: number[],
  options: AiringOptions = {},
): Promise<AiringSchedule[]> {
  if (mediaIds.length === 0) return [];

  const now = Math.floor(Date.now() / 1000);
  const pastDays = options.pastDays ?? 0;
  const airingAfter = pastDays > 0 ? now - pastDays * 86400 : now;

  const all: AiringSchedule[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const data = await gql<{
      Page: {
        pageInfo: { hasNextPage: boolean };
        airingSchedules: AiringSchedule[];
      };
    }>(AIRING_QUERY, { mediaIds, airingAfter, page });

    all.push(...data.Page.airingSchedules);

    if (!data.Page.pageInfo.hasNextPage) break;
    page++;
  }

  return all;
}
