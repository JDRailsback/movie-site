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
        className="brutal flex flex-col overflow-hidden rounded-[1.1rem] bg-paper"
      >
        <div className="relative">
          <Poster path={f.posterPath} title={f.title} />
          {f.weightedRating != null && (
            <span className="brutal-sm absolute right-2 top-2 rounded-full bg-butter px-2 py-0.5 text-xs font-black text-ink">
              ★ {f.weightedRating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="font-display text-lg font-black leading-tight text-ink">
            {f.title} <span className="text-sm font-bold text-ink/50">{f.year}</span>
          </h3>

          <ul className="flex-1 space-y-1">
            {item.explanation.reasons.map((r) => (
              <li key={r} className="flex gap-1.5 text-xs font-semibold text-ink/80">
                <span className="text-coral-deep">✦</span>
                {r}
              </li>
            ))}
          </ul>

          {done ? (
            <p className="rounded-full bg-mint px-3 py-1.5 text-center text-xs font-black uppercase text-ink">
              {done === "loved" ? "♥ on your list!" : "✓ seen it"}
            </p>
          ) : (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => act("loved")}
                className="brutal-sm flex-1 rounded-full bg-blush px-2 py-1.5 text-xs font-black uppercase text-ink"
              >
                ♥ Love
              </button>
              <button
                type="button"
                onClick={() => act("seen")}
                className="brutal-sm flex-1 rounded-full bg-sky px-2 py-1.5 text-xs font-black uppercase text-ink"
              >
                Seen
              </button>
              <button
                type="button"
                onClick={() => act("not_interested")}
                className="brutal-sm rounded-full bg-paper-deep px-2 py-1.5 text-xs font-black uppercase text-ink"
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
