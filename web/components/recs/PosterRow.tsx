"use client";

import { type RecItem, posterUrl } from "@/lib/api";
import { useEffect, useRef } from "react";

// A horizontally scrollable row of equal-height posters, packed tight.
// The scrollbar is hidden, so a vertical mouse wheel is translated into
// horizontal scrolling (trackpad horizontal gestures work natively).
export function PosterRow({ items }: { items: RecItem[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={ref}
      className="poster-row"
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        gap: 6,
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {items.map((it) => {
        const f = it.film;
        const url = posterUrl(f.posterPath);
        return (
          <a
            key={f.tmdbId}
            href={`https://letterboxd.com/tmdb/${f.tmdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
            title={`${f.title}${f.year ? ` (${f.year})` : ""}`}
            style={{ height: "100%", flexShrink: 0 }}
          >
            {url ? (
              <img
                src={url}
                alt={f.title}
                style={{
                  height: "100%",
                  width: "auto",
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  border: "1px solid var(--line)",
                  display: "block",
                }}
              />
            ) : (
              <span
                style={{
                  height: "100%",
                  aspectRatio: "2 / 3",
                  border: "1px solid var(--line)",
                  background: "#ece7db",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: 6,
                  fontSize: 10,
                  color: "var(--muted)",
                  overflow: "hidden",
                }}
              >
                {f.title}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
