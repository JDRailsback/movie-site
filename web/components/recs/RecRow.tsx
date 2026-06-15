"use client";

import { RecCard } from "@/components/recs/RecCard";
import type { RecItem } from "@/lib/api";
import { useRef } from "react";

// A single horizontal row of recommendations. Arrow buttons page the track
// left/right; trackpad/drag scrolling still works. Scrollbar is hidden.
export function RecRow({
  items,
  profileId,
  surface,
  onRemove,
}: {
  items: RecItem[];
  profileId: string;
  surface: string;
  onRemove: (tmdbId: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="absolute -left-3 top-[38%] z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-paper text-xl text-ink shadow-md transition hover:bg-paper/80"
      >
        ‹
      </button>
      <div
        ref={trackRef}
        className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => (
          <div key={it.film.tmdbId} className="w-44 shrink-0 snap-start">
            <RecCard item={it} profileId={profileId} surface={surface} onRemove={onRemove} />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="absolute -right-3 top-[38%] z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-paper text-xl text-ink shadow-md transition hover:bg-paper/80"
      >
        ›
      </button>
    </div>
  );
}
