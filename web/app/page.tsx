"use client";

// Landing (minimal). A clean drop zone for the export (primary) + a username
// field (fallback).

import { importByUsername, uploadExport } from "@/lib/api";
import { useRouter } from "next/navigation";
import { type DragEvent, useRef, useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) go(uploadExport(file));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="font-display text-5xl font-semibold text-ink">Reel</h1>
        <p className="text-ink/60">
          A map of your film taste — drawn from <em>your</em> ratings, not the crowd&apos;s.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) go(uploadExport(f));
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`grid w-full place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? "border-ink/40 bg-ink/5" : "border-ink/15 hover:border-ink/30"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span>
          <span className="block font-display text-xl font-semibold text-ink">
            {busy ? "Unspooling…" : dragging ? "Drop it" : "Drop your Letterboxd export"}
          </span>
          <span className="mt-1 block text-sm text-ink/45">or click to browse · .zip</span>
        </span>
      </button>

      <div className="flex w-full items-center gap-3 text-xs uppercase tracking-widest text-ink/30">
        <span className="h-px flex-1 bg-ink/10" />
        or
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) go(importByUsername(username.trim()));
        }}
        className="flex w-full items-center gap-2"
      >
        <input
          type="text"
          value={username}
          disabled={busy}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="letterboxd username"
          className="h-11 flex-1 rounded-full border border-ink/15 bg-paper px-4 text-ink outline-none transition focus:border-ink/40"
        />
        <button
          type="submit"
          disabled={busy || !username.trim()}
          className="h-11 rounded-full bg-ink px-5 font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          Go
        </button>
      </form>

      {error && <p className="text-sm text-coral-deep">{error}</p>}

      <p className="text-xs text-ink/40">
        Tip: Letterboxd → Settings → Data → Export. Uploading is faster and more complete than a
        username lookup.
      </p>
    </main>
  );
}
