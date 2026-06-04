"use client";

// Landing (whimsical redesign). A breathing blob drop-zone for the export
// (primary), a username pill (fallback), drifting pastel shapes behind.

import { FloatingShapes } from "@/components/ui/FloatingShapes";
import { importByUsername, uploadExport } from "@/lib/api";
import { motion } from "framer-motion";
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
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <FloatingShapes />

      <div className="space-y-4">
        <motion.h1
          initial={{ scale: 0.7, opacity: 0, rotate: -4 }}
          animate={{ scale: 1, opacity: 1, rotate: -2 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="font-display text-7xl font-black text-ink"
        >
          Reel
        </motion.h1>
        <p className="mx-auto max-w-md text-lg text-ink-soft">
          A playful map of your film taste — drawn from <em>your</em> ratings, not the crowd&apos;s.
          Drop your Letterboxd history and let&apos;s wander.
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

      <motion.button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        animate={dragging ? { scale: 1.08 } : {}}
        className={`grid h-60 w-60 place-items-center rounded-blob text-center text-ink shadow-lift transition-colors ${
          dragging ? "bg-mint" : "bg-butter"
        } ${busy ? "opacity-70" : "animate-breathe"}`}
      >
        <span className="px-6">
          <span className="block font-display text-2xl font-bold">
            {busy ? "Unspooling…" : dragging ? "Drop it!" : "Drop your export here"}
          </span>
          <span className="mt-1 block text-sm text-ink-soft">or tap to browse · .zip</span>
        </span>
      </motion.button>

      <div className="flex w-full max-w-xs items-center gap-3 text-xs uppercase tracking-widest text-ink-faint">
        <span className="h-px flex-1 bg-paper-edge" />
        or peek at a username
        <span className="h-px flex-1 bg-paper-edge" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) go(importByUsername(username.trim()));
        }}
        className="flex w-full max-w-sm items-center gap-2"
      >
        <input
          type="text"
          value={username}
          disabled={busy}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="letterboxd username"
          className="h-12 flex-1 rounded-full border-2 border-paper-edge bg-paper px-5 text-ink outline-none transition focus:border-lilac-deep"
        />
        <motion.button
          type="submit"
          disabled={busy || !username.trim()}
          whileHover={{ scale: 1.05, rotate: -2 }}
          whileTap={{ scale: 0.95 }}
          className="h-12 rounded-full bg-lilac px-5 font-semibold text-lilac-deep shadow-sticker disabled:opacity-50"
        >
          Go
        </motion.button>
      </form>

      {error && (
        <motion.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-coral-deep shadow-sticker"
        >
          {error}
        </motion.p>
      )}

      <p className="max-w-sm text-xs text-ink-faint">
        Tip: Letterboxd → Settings → Data → Export. Uploading is faster and far more complete than a
        username peek.
      </p>
    </main>
  );
}
