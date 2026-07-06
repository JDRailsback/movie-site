// Typed client for the FastAPI backend. Browser talks to the API directly in
// dev; CORS is configured server-side for the app origin.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ImportState =
  | "queued"
  | "fetching"
  | "matching"
  | "enriching"
  | "profiling"
  | "precomputing_recs"
  | "ready"
  | "failed";

export interface ImportCreated {
  importId: string;
  profileId: string;
}

export interface ImportStatus {
  importId: string;
  profileId: string;
  source: "export" | "scrape";
  status: ImportState;
  stageCounts: Record<string, number>;
  error?: string | null;
}

interface ApiError {
  error: { code: string; message: string };
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as ApiError;
      message = body?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function importByUsername(username: string): Promise<ImportCreated> {
  const res = await fetch(`${API_BASE}/imports/by-username`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return unwrap<ImportCreated>(res);
}

export async function getImportStatus(importId: string): Promise<ImportStatus> {
  return unwrap<ImportStatus>(await fetch(`${API_BASE}/imports/${importId}`));
}

export interface FilmCard {
  tmdbId: number;
  title: string;
  year?: number | null;
  posterPath?: string | null;
  runtimeMin?: number | null;
  weightedRating?: number | null;
  yourRating?: number | null;
  genres?: string[];
  lbRating?: number | null;
  lbWatchCount?: number | null;
  lbSlug?: string | null;
}

export function posterUrl(path?: string | null, size = "w342"): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

// --- films (used for header stats) ---
export interface FilmDatum {
  tmdbId: number;
  title: string;
  year?: number | null;
  rating?: number | null;
  genres: string[];
}

export async function getFilms(profileId: string): Promise<FilmDatum[]> {
  return unwrap<FilmDatum[]>(await fetch(`${API_BASE}/profiles/${profileId}/films`));
}

// --- recommendations ---
export interface RecItem {
  film: FilmCard;
  rank: number;
  score: number;
  fit: number; // 0-100 "% match" to the user's taste
  components: Record<string, number>;
  explanation: { source: string; reasons: string[] };
}

export interface RecommendationSet {
  setId: string;
  surface: string;
  modelVersion: string;
  items: RecItem[];
}

export type FeedbackAction = "seen" | "loved" | "not_interested" | "watchlist" | "watched_because";

export async function getRecs(profileId: string, surface: string): Promise<RecommendationSet> {
  return unwrap<RecommendationSet>(
    await fetch(`${API_BASE}/profiles/${profileId}/recs/${surface}`),
  );
}

export async function getWatchlist(profileId: string): Promise<FilmCard[]> {
  return unwrap<FilmCard[]>(await fetch(`${API_BASE}/profiles/${profileId}/watchlist`));
}

export async function sendFeedback(
  profileId: string,
  filmId: number,
  action: FeedbackAction,
  surface?: string,
): Promise<void> {
  await fetch(`${API_BASE}/profiles/${profileId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filmId, action, surface }),
  });
}
