"use client";

// Live import progress (whimsical). Each stage is a bouncing pastel orb that
// fills as the SSE stream advances. No spinners.

import type { ImportState } from "@/lib/api";
import { HEX, type Pastel } from "@/lib/pastels";
import { useImportProgress } from "@/lib/useImportProgress";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const STAGES: { key: ImportState; label: string; pastel: Pastel }[] = [
  { key: "fetching", label: "Reading", pastel: "sky" },
  { key: "matching", label: "Matching", pastel: "lilac" },
  { key: "enriching", label: "Enriching", pastel: "peach" },
  { key: "profiling", label: "Profiling", pastel: "mint" },
];
const ORDER: ImportState[] = ["queued", "fetching", "matching", "enriching", "profiling", "ready"];

export default function ImportProgressPage() {
  return (
    <Suspense>
      <ImportProgress />
    </Suspense>
  );
}

function ImportProgress() {
  const { importId } = useParams<{ importId: string }>();
  const profileId = useSearchParams().get("profile");
  const { status, counts, error } = useImportProgress(importId);

  const activeIndex = Math.max(0, ORDER.indexOf(status === "ready" ? "profiling" : status));
  const done = status === "ready";
  const failed = status === "failed";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-semibold text-ink">
          {done ? "All set" : failed ? "Import failed" : "Building your profile…"}
        </h1>
        <p className="text-ink/55">
          {counts.total
            ? `${counts.matched ?? 0} of ${counts.total} films matched`
            : "Sit tight — big libraries take a minute."}
        </p>
      </div>

      {failed ? (
        <p className="rounded-full border border-ink/10 px-5 py-2 text-sm text-coral-deep">
          {error ?? "Something went sideways. Try again?"}
        </p>
      ) : (
        <div className="flex items-end gap-6 sm:gap-10">
          {STAGES.map((stage, i) => {
            const state =
              done || i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
            return (
              <div key={stage.key} className="flex flex-col items-center gap-3">
                <motion.div
                  animate={state === "active" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={
                    state === "active"
                      ? { duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                  className="grid h-14 w-14 place-items-center rounded-full text-lg"
                  style={{
                    backgroundColor:
                      state === "pending" ? "transparent" : `${HEX[stage.pastel].fill}66`,
                    border: state === "pending" ? "2px dashed rgba(59,50,44,0.2)" : "none",
                  }}
                >
                  {state === "done" ? "✓" : state === "active" ? "•" : ""}
                </motion.div>
                <span className={`text-xs ${state === "pending" ? "text-ink/35" : "text-ink/70"}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {done && profileId && (
        <Link
          href={`/p/${profileId}`}
          className="rounded-full bg-ink px-6 py-3 font-medium text-paper transition hover:opacity-90"
        >
          See your taste map →
        </Link>
      )}

      {failed && (
        <Link href="/" className="text-sm text-ink/50 underline hover:text-ink">
          Start over
        </Link>
      )}
    </main>
  );
}
