"use client";

import { Poster } from "@/components/film/Poster";
import { type RecItem, sendFeedback } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";

// A recommendation card: poster, why-this reasons, and a single dismiss action.
// "Not for me" removes the card and excludes the film from future recs.
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

  function dismiss() {
    sendFeedback(profileId, f.tmdbId, "not_interested", surface);
    onRemove(f.tmdbId);
  }

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-30px" }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="brutal relative flex flex-col overflow-hidden rounded-xl bg-paper"
      >
        <div className="relative">
          <Poster path={f.posterPath} title={f.title} />
          {f.weightedRating != null && (
            <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-xs font-medium text-paper">
              ★ {f.weightedRating.toFixed(1)}
            </span>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not for me"
            title="Not for me"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-ink/55 text-sm text-paper transition hover:bg-ink/80"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="font-display text-base font-semibold leading-tight text-ink">
            {f.title} <span className="text-sm font-normal text-ink/45">{f.year}</span>
          </h3>
          <ul className="space-y-1">
            {item.explanation.reasons.map((r) => (
              <li key={r} className="flex gap-1.5 text-xs text-ink/65">
                <span className="text-ink/30">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
