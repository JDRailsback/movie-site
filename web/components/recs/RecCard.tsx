"use client";

import { type RecItem, posterUrl, sendFeedback } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";

export function RecCard({
  item,
  profileId,
  surface,
  showFitBadge,
  onRemove,
}: {
  item: RecItem;
  profileId: string;
  surface: string;
  showFitBadge?: boolean;
  onRemove: (tmdbId: number) => void;
}) {
  const f = item.film;
  const url = posterUrl(f.posterPath);

  function dismiss() {
    sendFeedback(profileId, f.tmdbId, "not_interested", surface);
    onRemove(f.tmdbId);
  }

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-20px" }}
        exit={{ opacity: 0, scale: 0.88, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2 }}
        className="group relative"
      >
        <a
          href={`https://letterboxd.com/tmdb/${f.tmdbId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col"
        >
          {/* Poster */}
          <div
            className="relative w-full overflow-hidden rounded-sm"
            style={{ aspectRatio: "2/3", background: "rgba(255,255,255,0.05)" }}
          >
            {url ? (
              <img
                src={url}
                alt={f.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="flex h-full items-end p-2">
                <span
                  className="line-clamp-3 text-[9px] leading-tight"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {f.title}
                </span>
              </div>
            )}

            {/* Subtle bottom gradient on hover for depth */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 45%)",
              }}
            />

            {/* Fit badge */}
            {showFitBadge !== false && (
              <div className="absolute bottom-2 left-2">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                  style={{
                    background: "rgba(0,0,0,0.65)",
                    color: "rgba(255,255,255,0.75)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {item.fit}%
                </span>
              </div>
            )}
          </div>

          {/* Meta below poster */}
          <div className="mt-2 px-0.5">
            <p className="truncate text-[12px] font-medium text-white leading-tight">
              {f.title}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
              {f.year ?? ""}
              {f.lbRating != null ? (
                <span> · ★ {f.lbRating.toFixed(1)}</span>
              ) : f.weightedRating != null ? (
                <span> · ★ {(f.weightedRating / 2).toFixed(1)}</span>
              ) : null}
            </p>
          </div>
        </a>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not for me"
          title="Not for me"
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-[11px] transition-all duration-150 opacity-0 group-hover:opacity-100 hover:scale-110"
          style={{
            background: "rgba(0,0,0,0.72)",
            color: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(4px)",
          }}
        >
          ✕
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
