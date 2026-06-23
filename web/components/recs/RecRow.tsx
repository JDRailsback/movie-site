"use client";

import { RecCard } from "@/components/recs/RecCard";
import type { RecItem } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { useCallback, useEffect, useRef, useState } from "react";

const CARD_WIDTH: Record<string, string> = {
  comfortable: "w-44",
  compact: "w-32",
};

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
  const [settings] = useSettings();
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const cardWidth = CARD_WIDTH[settings.cardDensity] ?? "w-44";

  const syncArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    syncArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncArrows, { passive: true });
    return () => el.removeEventListener("scroll", syncArrows);
  }, [syncArrows]);

  function scroll(dir: 1 | -1) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* Left fade — only when scrolled past start */}
      {canLeft && (
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 flex h-full w-14 items-center justify-start"
          style={{ background: "linear-gradient(to right, #0a0a0a 30%, transparent)" }}
        >
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full text-base transition-all duration-150 text-white/40 hover:text-white/90 hover:bg-white/[0.08]"
          >
            ‹
          </button>
        </div>
      )}

      {/* Scrolling track */}
      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => (
          <div key={it.film.tmdbId} className={`${cardWidth} shrink-0`}>
            <RecCard
              item={it}
              profileId={profileId}
              surface={surface}
              showFitBadge={settings.showFitBadge}
              onRemove={onRemove}
            />
          </div>
        ))}
      </div>

      {/* Right fade — only when more content to the right */}
      {canRight && (
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 flex h-full w-14 items-center justify-end"
          style={{ background: "linear-gradient(to left, #0a0a0a 30%, transparent)" }}
        >
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full text-base transition-all duration-150 text-white/40 hover:text-white/90 hover:bg-white/[0.08]"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
