"use client";

// Landing + entry (PLAN §10). Two ingest paths: export upload (primary,
// decision #1) and username lookup (fallback). On success, route to the live
// import progress screen.

import { importByUsername, uploadExport } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function go(promise: Promise<{ importId: string; profileId: string }>) {
    setBusy(true);
    setError(null);
    promise
      .then(({ importId, profileId }) => router.push(`/import/${importId}?profile=${profileId}`))
      .catch((e: Error) => {
        setError(e.message);
        setBusy(false);
      });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) go(uploadExport(file));
  }

  function onUsername(e: React.FormEvent) {
    e.preventDefault();
    if (username.trim()) go(importByUsername(username.trim()));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="space-y-3">
        <h1 className="font-display text-5xl font-semibold text-ink">
          Find the next film you&apos;ll love.
        </h1>
        <p className="text-lg text-ink-soft">
          A discovery layer on top of Letterboxd — explainable recommendations drawn from your own
          taste, not the crowd&apos;s.
        </p>
      </div>

      <div className="w-full max-w-md space-y-5 rounded-card bg-cream-50 p-6 shadow-sm">
        <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onFile} />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-card bg-teal px-5 py-3 font-medium text-cream-50 transition hover:bg-teal-600 disabled:opacity-60"
        >
          {busy ? "Starting…" : "Upload your Letterboxd export"}
        </button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-soft">
          <span className="h-px flex-1 bg-cream-200" />
          or
          <span className="h-px flex-1 bg-cream-200" />
        </div>

        <form onSubmit={onUsername} className="space-y-2">
          <input
            type="text"
            value={username}
            disabled={busy}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="letterboxd username"
            className="w-full rounded-card border border-cream-200 bg-cream px-4 py-2 text-ink outline-none focus:border-teal"
          />
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="w-full rounded-card border border-teal px-5 py-2 font-medium text-teal transition hover:bg-cream-200 disabled:opacity-50"
          >
            Look up profile
          </button>
        </form>

        {error && <p className="text-sm text-coral-600">{error}</p>}
      </div>

      <p className="max-w-md text-xs text-ink-soft">
        Tip: in Letterboxd, Settings → Data → Export your data. Uploading is faster and more
        complete than a username lookup.
      </p>
    </main>
  );
}
