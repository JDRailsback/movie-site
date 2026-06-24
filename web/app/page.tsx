"use client";

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
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{ background: "#0a0a0a" }}
    >
      <div className="w-full max-w-sm space-y-10">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="font-display text-[5rem] text-white leading-none tracking-tight">Recs.</h1>
          <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.32)" }}>
            Film recommendations drawn from your Letterboxd taste.
          </p>
        </div>

        {/* Drop zone */}
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
          className="group w-full rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-all duration-200"
          style={{
            borderColor: dragging
              ? "rgba(255,255,255,0.5)"
              : busy
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.12)",
            background: dragging ? "rgba(255,255,255,0.05)" : "transparent",
            opacity: busy ? 0.5 : 1,
          }}
        >
          <span className="block font-display text-2xl text-white">
            {busy ? "Loading…" : dragging ? "Drop it" : "Drop your export"}
          </span>
          <span className="mt-1.5 block text-[12px]" style={{ color: "rgba(255,255,255,0.28)" }}>
            {busy ? "Starting import…" : "Letterboxd → Settings → Data → Export · .zip"}
          </span>
        </button>

        {/* Divider */}
        <div
          className="flex items-center gap-4 text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "rgba(255,255,255,0.18)" }}
        >
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          or
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Username form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim()) go(importByUsername(username.trim()));
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={username}
            disabled={busy}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Letterboxd username"
            className="h-11 flex-1 rounded-full px-4 text-[13px] text-white placeholder:text-white/25 outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.09)";
            }}
          />
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="h-11 rounded-full px-5 text-[13px] font-medium transition-opacity"
            style={{
              background: "#fff",
              color: "#0a0a0a",
              opacity: busy || !username.trim() ? 0.35 : 1,
            }}
          >
            Go
          </button>
        </form>

        {error && (
          <p className="text-center text-[13px]" style={{ color: "rgba(255,80,80,0.85)" }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
