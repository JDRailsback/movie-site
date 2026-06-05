// Typed client for the FastAPI backend (PHASE0 §4). Browser talks to the API
// directly in dev; CORS is configured server-side for the app origin.

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

export async function uploadExport(file: File): Promise<ImportCreated> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/imports`, { method: "POST", body: form });
  return unwrap<ImportCreated>(res);
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

export function importEventsUrl(importId: string): string {
  return `${API_BASE}/imports/${importId}/events`;
}

// --- profile / taste ---
export interface ProfileSummary {
  profileId: string;
  username: string;
  displayName?: string | null;
  lastImportAt?: string | null;
  filmCount: number;
}

export interface GenreAffinity {
  name: string;
  affinity: number;
  components: { rating: number; vs_audience: number; engagement: number; likes: number };
  count: number;
  avg_rating: number;
}

export interface DirectorAffinity {
  name: string;
  affinity: number;
  count: number;
  avg_rating: number;
}

export interface TasteProfile {
  profileId: string;
  modelVersion: string;
  mu: number;
  sigma: number;
  genreAffinity: Record<string, GenreAffinity>;
  directorAffinity: Record<string, DirectorAffinity>;
  eraAffinity: Record<string, { affinity: number; count: number; avg_rating: number }>;
  countryAffinity: Record<string, { affinity: number; count: number }>;
  runtimePref: { pref_min?: number; sd_min?: number };
  topKeywords: { id: number; name: string; weight: number }[];
  gaps: {
    decades?: { decade: number; gap: number }[];
    countries?: { country: string; gap: number }[];
  };
}

export interface FilmCard {
  tmdbId: number;
  title: string;
  year?: number | null;
  posterPath?: string | null;
  runtimeMin?: number | null;
  weightedRating?: number | null;
  yourRating?: number | null;
}

export interface FilmDatum {
  tmdbId: number;
  title: string;
  year?: number | null;
  decade?: number | null;
  posterPath?: string | null;
  runtimeMin?: number | null;
  rating?: number | null;
  liked: boolean;
  genres: string[];
  directors: string[];
  countries: string[];
  themes: string[];
}

export async function getProfileSummary(profileId: string): Promise<ProfileSummary> {
  return unwrap<ProfileSummary>(await fetch(`${API_BASE}/profiles/${profileId}`));
}

export async function getFilms(profileId: string): Promise<FilmDatum[]> {
  return unwrap<FilmDatum[]>(await fetch(`${API_BASE}/profiles/${profileId}/films`));
}

export async function getTasteProfile(profileId: string): Promise<TasteProfile | null> {
  const res = await fetch(`${API_BASE}/profiles/${profileId}/taste`);
  if (res.status === 404) return null; // not computed yet
  return unwrap<TasteProfile>(res);
}

export async function getRecentlyWatched(profileId: string, limit = 18): Promise<FilmCard[]> {
  return unwrap<FilmCard[]>(
    await fetch(`${API_BASE}/profiles/${profileId}/recently-watched?limit=${limit}`),
  );
}

export function posterUrl(path?: string | null, size = "w342"): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

// --- recommendations ---
export interface RecItem {
  film: FilmCard;
  rank: number;
  score: number;
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
