"use client";

import { Poster } from "@/components/film/Poster";
import { type FeedbackAction, type RecItem, sendFeedback } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

// A recommendation card: poster, why-this reasons, and feedback that feeds the
// north-star funnel. "Not for me" removes the card (and excludes it from recs).
export function RecCard({
  item,
  profileId,
  surface,
  onRemove,
}: {
  item: RecItem;
  profileId: string;
  surface: string;
  onRemove: (tmdbId: number) => void;
}) {
  const f = item.film;
  const [done, setDone] = useState<FeedbackAction | null>(null);

  function act(action: FeedbackAction) {
    sendFeedback(profileId, f.tmdbId, action, surface);
    if (action === "not_interested") {
      onRemove(f.tmdbId);
    } else {
      setDone(action);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-30px" }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="brutal flex flex-col overflow-hidden rounded-xl bg-paper"
      >
        <div className="relative">
          <Poster path={f.posterPath} title={f.title} />
          {f.weightedRating != null && (
            <span className="absolute right-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-xs font-medium text-paper">
              ★ {f.weightedRating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="font-display text-base font-semibold leading-tight text-ink">
            {f.title} <span className="text-sm font-normal text-ink/45">{f.year}</span>
          </h3>

          <ul className="flex-1 space-y-1">
            {item.explanation.reasons.map((r) => (
              <li key={r} className="flex gap-1.5 text-xs text-ink/65">
                <span className="text-ink/30">·</span>
                {r}
              </li>
            ))}
          </ul>

          {done ? (
            <p className="rounded-full bg-mint/40 px-3 py-1.5 text-center text-xs font-medium text-ink">
              {done === "loved" ? "♥ on your list" : "✓ seen it"}
            </p>
          ) : (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => act("loved")}
                className="flex-1 rounded-full border border-ink/10 bg-blush/40 px-2 py-1.5 text-xs font-medium text-ink transition hover:bg-blush/70"
              >
                ♥ Love
              </button>
              <button
                type="button"
                onClick={() => act("seen")}
                className="flex-1 rounded-full border border-ink/10 bg-sky/40 px-2 py-1.5 text-xs font-medium text-ink transition hover:bg-sky/70"
              >
                Seen
              </button>
              <button
                type="button"
                onClick={() => act("not_interested")}
                className="rounded-full border border-ink/10 px-2.5 py-1.5 text-xs font-medium text-ink/60 transition hover:bg-ink/5"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
