"use client";

// Live import progress (whimsical). Each stage is a bouncing pastel orb that
// fills as the SSE stream advances. No spinners.

import { FloatingShapes } from "@/components/ui/FloatingShapes";
import type { ImportState } from "@/lib/api";
import { BG, HEX, type Pastel } from "@/lib/pastels";
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
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-12 px-6 text-center">
      <FloatingShapes />

      <div className="space-y-2">
        <h1 className="font-display text-4xl font-bold text-ink">
          {done ? "All spooled up!" : failed ? "The reel snapped" : "Threading the projector…"}
        </h1>
        <p className="text-ink-soft">
          {counts.total
            ? `${counts.matched ?? 0} of ${counts.total} films matched`
            : "Sit tight — big libraries take a minute."}
        </p>
      </div>

      {failed ? (
        <p className="rounded-full bg-coral px-5 py-2 text-sm font-medium text-coral-deep shadow-sticker">
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
                  animate={
                    state === "active" ? { y: [0, -14, 0], scale: [1, 1.1, 1] } : { y: 0, scale: 1 }
                  }
                  transition={
                    state === "active"
                      ? { duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                      : { type: "spring", stiffness: 200, damping: 14 }
                  }
                  className={`grid h-16 w-16 place-items-center rounded-full text-2xl ${
                    state === "pending"
                      ? "border-2 border-dashed border-paper-edge"
                      : `${BG[stage.pastel]} shadow-sticker`
                  }`}
                  style={
                    state === "done"
                      ? { boxShadow: `0 0 0 4px ${HEX[stage.pastel].fill}55` }
                      : undefined
                  }
                >
                  {state === "done" ? "✓" : state === "active" ? "•" : ""}
                </motion.div>
                <span
                  className={`text-xs font-semibold ${state === "pending" ? "text-ink-faint" : "text-ink"}`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {done && profileId && (
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Link
            href={`/p/${profileId}`}
            className="inline-block rounded-full bg-butter px-7 py-3 font-display text-lg font-bold text-ink shadow-lift transition hover:-translate-y-1"
          >
            See your taste map →
          </Link>
        </motion.div>
      )}

      {failed && (
        <Link href="/" className="text-sm font-semibold text-lilac-deep underline">
          Start over
        </Link>
      )}
    </main>
  );
}
