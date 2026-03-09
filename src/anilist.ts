/**
 * @module anilist
 * AniList GraphQL client - fetches a user's watching list and upcoming airing times.
 */

const ANILIST_API = "https://graphql.anilist.co";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches all anime on a user's "Currently Watching" list.
 * Returns media IDs which we then use to look up airing schedules.
 */
const WATCHING_QUERY = `
query ($username: String) {
  MediaListCollection(userName: $username, type: ANIME, status: CURRENT) {
    lists {
      entries {
        media {
          id
          title {
            romaji
            english
          }
        }
      }
    }
  }
}`;

/**
 * Fetches upcoming episode air times for a set of media IDs.
 * Filters to future episodes only and paginates in batches of
 * 50 to handle users watching many shows.
 */
const AIRING_QUERY = `
query ($mediaIds: [Int], $now: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
    }
    airingSchedules(mediaId_in: $mediaIds, airingAt_greater: $now, sort: TIME) {
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

// ---------------------------------------------------------------------------
// GraphQL helper
// ---------------------------------------------------------------------------

/**
 * Sends a GraphQL request to the AniList API.
 * @throws On HTTP errors or GraphQL-level errors.
 */
async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AniList API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    data: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors[0].message}`);
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the AniList media IDs for every anime on the user's
 * "Currently Watching" list.
 */
export async function getWatchingMediaIds(username: string): Promise<number[]> {
  const data = await gql<{
    MediaListCollection: {
      lists: { entries: { media: { id: number } }[] }[];
    };
  }>(WATCHING_QUERY, { username });

  // AniList groups entries into sub-lists
  return data.MediaListCollection.lists.flatMap((list) =>
    list.entries.map((e) => e.media.id),
  );
}

/**
 * Fetches all upcoming airing episodes for the given media IDs.
 * Automatically paginates. 
 */
export async function getAiringSchedules(
  mediaIds: number[],
): Promise<AiringSchedule[]> {
  if (mediaIds.length === 0) return [];

  const now = Math.floor(Date.now() / 1000);
  const all: AiringSchedule[] = [];
  let page = 1;

  while (true) {
    const data = await gql<{
      Page: {
        pageInfo: { hasNextPage: boolean };
        airingSchedules: AiringSchedule[];
      };
    }>(AIRING_QUERY, { mediaIds, now, page });

    all.push(...data.Page.airingSchedules);

    if (!data.Page.pageInfo.hasNextPage) break;
    page++;
  }

  return all;
}
