"use client";

import { Poster } from "@/components/film/Poster";
import { type RecItem, sendFeedback } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";

// A recommendation card: poster, title and genres, linking out to the film's
// Letterboxd page in a new tab. The ✕ overlay dismisses it ("not for me"),
// removing the card and excluding the film from future recs.
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
        <a
          href={`https://letterboxd.com/tmdb/${f.tmdbId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 flex-col"
        >
          <div className="relative">
            <Poster path={f.posterPath} title={f.title} />
            {f.weightedRating != null && (
              <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-xs font-medium text-paper">
                ★ {f.weightedRating.toFixed(1)}
              </span>
            )}
            <span className="absolute bottom-2 left-2 rounded-full bg-mint-deep/90 px-2 py-0.5 text-xs font-semibold text-paper">
              {item.fit}% match
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-2 p-3">
            <h3 className="font-display text-base font-semibold leading-tight text-ink">
              {f.title} <span className="text-sm font-normal text-ink/45">{f.year}</span>
            </h3>
            {f.genres && f.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {f.genres.map((g) => (
                  <span key={g} className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </a>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Not for me"
          title="Not for me"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-ink/55 text-sm text-paper transition hover:bg-ink/80"
        >
          ✕
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
