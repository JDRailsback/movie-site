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
