"use client";

// Live import progress (PLAN §5, §10). Consumes the SSE stream and renders a
// stage stepper with skeleton highlight on the active step (no spinners).

import type { ImportState } from "@/lib/api";
import { useImportProgress } from "@/lib/useImportProgress";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const STAGES: { key: ImportState; label: string }[] = [
  { key: "fetching", label: "Reading your export" },
  { key: "matching", label: "Matching films to TMDB" },
  { key: "enriching", label: "Enriching with metadata" },
  { key: "profiling", label: "Building your taste profile" },
];

const ORDER: ImportState[] = ["queued", "fetching", "matching", "enriching", "profiling", "ready"];

// useSearchParams must sit under a Suspense boundary or `next build` fails.
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">
          {done ? "Your profile is ready" : failed ? "Import failed" : "Importing your films…"}
        </h1>
        <p className="text-sm text-ink-soft">
          {counts.total
            ? `${counts.matched ?? 0} of ${counts.total} films matched`
            : "This can take a minute for large profiles."}
        </p>
      </div>

      {failed ? (
        <p className="rounded-card bg-coral/10 px-4 py-3 text-center text-sm text-coral-600">
          {error ?? "Something went wrong. Please try again."}
        </p>
      ) : (
        <ol className="space-y-3">
          {STAGES.map((stage, i) => {
            const state =
              done || i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
            return (
              <li
                key={stage.key}
                className="flex items-center gap-3 rounded-card bg-cream-50 px-4 py-3"
              >
                <span
                  className={
                    state === "done"
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-teal text-xs text-cream-50"
                      : state === "active"
                        ? "h-6 w-6 rounded-full skeleton"
                        : "h-6 w-6 rounded-full border border-cream-200"
                  }
                >
                  {state === "done" ? "✓" : ""}
                </span>
                <span className={state === "pending" ? "text-ink-soft" : "font-medium text-ink"}>
                  {stage.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {done && profileId && (
        <Link
          href={`/p/${profileId}`}
          className="mx-auto rounded-card bg-teal px-6 py-3 font-medium text-cream-50 transition hover:bg-teal-600"
        >
          Explore your taste profile →
        </Link>
      )}

      {failed && (
        <Link href="/" className="mx-auto text-sm text-teal underline">
          Start over
        </Link>
      )}
    </main>
  );
}
