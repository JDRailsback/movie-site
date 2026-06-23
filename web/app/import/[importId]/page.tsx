"use client";

import type { ImportState } from "@/lib/api";
import { useImportProgress } from "@/lib/useImportProgress";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const STAGES: { key: ImportState; label: string }[] = [
  { key: "fetching", label: "Reading" },
  { key: "matching", label: "Matching" },
  { key: "enriching", label: "Enriching" },
  { key: "profiling", label: "Profiling" },
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
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 text-center"
      style={{ background: "#0a0a0a" }}
    >
      <div className="space-y-3">
        <h1 className="font-display text-[3.5rem] italic font-light text-white leading-none">
          {done ? "All set." : failed ? "Something went wrong." : "Building your recs…"}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.3)" }} className="text-sm">
          {counts.total
            ? `${counts.matched ?? 0} of ${counts.total} films matched`
            : "Sit tight — big libraries take a minute."}
        </p>
      </div>

      {failed ? (
        <p
          className="rounded-full px-5 py-2 text-sm"
          style={{ border: "1px solid rgba(255,80,80,0.3)", color: "rgba(255,80,80,0.9)" }}
        >
          {error ?? "Something went sideways. Try again?"}
        </p>
      ) : (
        <div className="flex items-end gap-8 sm:gap-12">
          {STAGES.map((stage, i) => {
            const state =
              done || i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
            return (
              <div key={stage.key} className="flex flex-col items-center gap-3">
                <motion.div
                  animate={state === "active" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={
                    state === "active"
                      ? { duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                  className="grid h-12 w-12 place-items-center rounded-full"
                  style={{
                    background:
                      state === "done"
                        ? "rgba(255,255,255,0.12)"
                        : state === "active"
                          ? "rgba(255,255,255,0.08)"
                          : "transparent",
                    border:
                      state === "pending"
                        ? "1px dashed rgba(255,255,255,0.12)"
                        : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color:
                        state === "done"
                          ? "rgba(255,255,255,0.8)"
                          : state === "active"
                            ? "rgba(255,255,255,0.6)"
                            : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {state === "done" ? "✓" : state === "active" ? "•" : ""}
                  </span>
                </motion.div>
                <span
                  className="text-xs"
                  style={{
                    color: state === "pending" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {done && profileId && (
        <Link
          href={`/p/${profileId}/recs`}
          className="rounded-full px-7 py-3 text-sm font-medium transition hover:opacity-90"
          style={{ background: "rgba(255,255,255,0.9)", color: "#0a0a0a" }}
        >
          See your recs →
        </Link>
      )}

      {failed && (
        <Link href="/" className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          Start over
        </Link>
      )}
    </main>
  );
}
