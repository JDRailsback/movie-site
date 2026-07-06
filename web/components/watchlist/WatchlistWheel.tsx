"use client";

import { type FilmCard, posterUrl } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

const POSTER_W = 132;
const POSTER_H = 198;            // 2:3
const GAP = 12;
const ITEM_H = POSTER_H + GAP;
const SLOTS = 9;                  // DOM nodes in the virtual reel
const ROTATIONS = 3;             // full cycles before landing

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// A vertical reel that fills the column height and spins downward (posters
// enter from the top), decelerating onto a randomly chosen film.
export function WatchlistWheel({ films }: { films: FilmCard[] }) {
  const [shuffled] = useState<FilmCard[]>(() => {
    const d = [...films];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  });

  const [winner, setWinner] = useState<FilmCard | null>(null);
  const [spinning, setSpinning] = useState(false);

  const slotEls = useRef<(HTMLDivElement | null)[]>(Array(SLOTS).fill(null));
  const slotImgs = useRef<(HTMLImageElement | null)[]>(Array(SLOTS).fill(null));
  const slotFilm = useRef<number[]>(Array(SLOTS).fill(-1));
  const scrollPos = useRef(0);
  const baseAbs = useRef(0);
  const containerH = useRef(0);
  const filmsRef = useRef<FilmCard[]>(shuffled);
  const rafId = useRef(0);

  const slotRefs = useRef(
    Array.from({ length: SLOTS }, (_, s) => (el: HTMLDivElement | null) => {
      slotEls.current[s] = el;
      if (el) el.style.transform = "translateY(-9999px)";
    }),
  );
  const imgRefs = useRef(
    Array.from({ length: SLOTS }, (_, s) => (el: HTMLImageElement | null) => {
      slotImgs.current[s] = el;
    }),
  );

  filmsRef.current = shuffled;

  useEffect(() => {
    shuffled.forEach((f) => {
      const u = posterUrl(f.posterPath);
      if (u) { const i = new Image(); i.src = u; }
    });
  }, [shuffled]);

  const centerOffset = useCallback(
    (absIdx: number) => absIdx * ITEM_H + ITEM_H / 2 - containerH.current / 2,
    [],
  );

  const updateSlots = useCallback((offset: number) => {
    const fs = filmsRef.current;
    const N = fs.length;
    if (!N) return;
    const first = Math.floor(offset / ITEM_H) - 1;
    for (let s = 0; s < SLOTS; s++) {
      const abs = first + s;
      const fi = ((abs % N) + N) % N;
      const y = abs * ITEM_H - offset;
      const el = slotEls.current[s];
      if (el) el.style.transform = `translateY(${y}px)`;
      if (slotFilm.current[s] !== fi) {
        slotFilm.current[s] = fi;
        const img = slotImgs.current[s];
        if (img) {
          img.src = posterUrl(fs[fi].posterPath) ?? "";
          img.alt = fs[fi].title;
        }
      }
    }
  }, []);

  const initReel = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const fs = filmsRef.current;
    if (!fs.length) return;
    containerH.current = el.clientHeight || 400;
    const startIdx = Math.floor(Math.random() * fs.length);
    const initialAbs = fs.length * 6 + startIdx; // high so we can scroll down for a while
    baseAbs.current = initialAbs;
    const pos = centerOffset(initialAbs);
    scrollPos.current = pos;
    slotFilm.current.fill(-1);
    updateSlots(pos);
    setWinner(fs[startIdx]);
  }, [centerOffset, updateSlots]);

  function spin() {
    if (spinning || shuffled.length < 2) return;
    setSpinning(true);

    const N = shuffled.length;
    const winIdx = Math.floor(Math.random() * N);
    const b = ((baseAbs.current % N) + N) % N;
    const down0 = ((b - winIdx) % N + N) % N;       // steps down to bring winner to center
    const targetAbs = baseAbs.current - (N * ROTATIONS + (down0 === 0 ? N : down0));
    const startPos = scrollPos.current;
    const endPos = centerOffset(targetAbs);
    const duration = 2800;
    let t0: number | null = null;

    const frame = (now: number) => {
      if (t0 === null) t0 = now;
      const t = Math.min((now - t0) / duration, 1);
      const pos = startPos + (endPos - startPos) * easeOutCubic(t);
      scrollPos.current = pos;
      updateSlots(pos);
      if (t < 1) {
        rafId.current = requestAnimationFrame(frame);
      } else {
        setSpinning(false);
        setWinner(shuffled[winIdx]);
        // Re-base to a high index (visually identical) so we never drift far.
        const rebase = N * 6 + winIdx;
        baseAbs.current = rebase;
        scrollPos.current = centerOffset(rebase);
        slotFilm.current.fill(-1);
        updateSlots(scrollPos.current);
      }
    };

    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(frame);
  }

  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  const lbHref = winner
    ? winner.lbSlug
      ? `https://letterboxd.com${winner.lbSlug}`
      : `https://letterboxd.com/tmdb/${winner.tmdbId}/`
    : undefined;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Reel — fills available vertical space */}
      <div ref={initReel} style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        {Array.from({ length: SLOTS }, (_, s) => (
          <div
            key={s}
            ref={slotRefs.current[s]}
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              marginLeft: -POSTER_W / 2,
              width: POSTER_W,
              height: POSTER_H,
              border: "1px solid var(--line)",
              background: "#ece7db",
              overflow: "hidden",
            }}
          >
            <img
              ref={imgRefs.current[s]}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ))}
        {/* Edge fades blend the reel into the background */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "24%", background: "linear-gradient(to bottom, var(--bg), transparent)", pointerEvents: "none", zIndex: 2 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "24%", background: "linear-gradient(to top, var(--bg), transparent)", pointerEvents: "none", zIndex: 2 }} />
      </div>

      {/* Winner */}
      <div style={{ textAlign: "center", minHeight: 38, flexShrink: 0 }}>
        {winner && (
          <>
            <a
              href={lbHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "none",
                borderBottom: "1px solid var(--line)",
              }}
            >
              {winner.title}
            </a>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {[winner.year, winner.lbRating != null && `★ ${winner.lbRating.toFixed(1)}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </>
        )}
      </div>

      {/* Spin */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        style={{
          flexShrink: 0,
          padding: "9px 0",
          background: spinning ? "transparent" : "var(--text)",
          color: spinning ? "var(--muted)" : "var(--bg)",
          border: `1px solid ${spinning ? "var(--line)" : "var(--text)"}`,
          font: "inherit",
          fontSize: 14,
          fontWeight: 600,
          cursor: spinning ? "default" : "pointer",
        }}
      >
        {spinning ? "Spinning…" : "Spin"}
      </button>
    </div>
  );
}
