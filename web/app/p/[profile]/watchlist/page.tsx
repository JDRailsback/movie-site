"use client";

import { type FilmCard, getWatchlist, posterUrl } from "@/lib/api";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const EDGE = "rgba(196,154,60,0.2)";
const POSTER_W = 220;
const POSTER_H = 330;
const GAP = 14;
const ITEM_W = POSTER_W + GAP;   // 234px slot pitch
const REEL_H = POSTER_H + 48;    // 378px container height
const CARD_W = 480;
const SLOTS = 16;                 // DOM nodes in virtual reel (independent of watchlist size)
const ROTATIONS = 2;              // full cycles before landing

function centerOffset(absIdx: number, ww: number): number {
  return absIdx * ITEM_W + ITEM_W / 2 - ww / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function WatchlistPage() {
  const { profile } = useParams<{ profile: string }>();
  const [films, setFilms] = useState<FilmCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<FilmCard | null>(null);
  const [expandCard, setExpandCard] = useState(false);

  // Reel is driven entirely through refs — no React state updated per frame
  const containerRef = useRef<HTMLDivElement>(null);
  const slotEls = useRef<(HTMLDivElement | null)[]>(Array(SLOTS).fill(null));
  const slotImgs = useRef<(HTMLImageElement | null)[]>(Array(SLOTS).fill(null));
  const slotFilm = useRef<number[]>(Array(SLOTS).fill(-1)); // filmIdx currently shown per slot
  const scrollPos = useRef(0);   // current scroll offset
  const baseAbs = useRef(0);     // absIdx of the centered film
  const filmsRef = useRef<FilmCard[]>([]);
  const rafId = useRef(0);

  useEffect(() => { filmsRef.current = films; }, [films]);

  useEffect(() => {
    getWatchlist(profile)
      .then((d) => { setFilms(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [profile]);

  // Pre-load every poster so img.src swaps during spin are instant (cache hit, no decode)
  useEffect(() => {
    films.forEach(f => {
      const u = posterUrl(f.posterPath);
      if (u) { const i = new Image(); i.src = u; }
    });
  }, [films]);

  // Move slots to match the current scroll position (called every rAF frame)
  const updateSlots = useCallback((offset: number) => {
    const fs = filmsRef.current;
    const N = fs.length;
    if (!N) return;
    const first = Math.floor(offset / ITEM_W) - 2;
    for (let s = 0; s < SLOTS; s++) {
      const abs = first + s;
      const fi = ((abs % N) + N) % N;
      // Poster left edge = abs * ITEM_W + GAP/2 − offset (centers the item at windowW/2)
      const x = abs * ITEM_W + GAP / 2 - offset;
      const el = slotEls.current[s];
      if (el) el.style.transform = `translateX(${x}px)`;
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

  // Initialise slot positions once films are in the DOM
  useEffect(() => {
    if (films.length < 2 || !containerRef.current) return;
    const ww = containerRef.current.clientWidth;
    const pos = centerOffset(films.length, ww);
    scrollPos.current = pos;
    baseAbs.current = films.length;
    slotFilm.current.fill(-1);
    updateSlots(pos);
  }, [films, updateSlots]);

  function spin() {
    if (spinning || films.length < 2) return;
    const hadCard = expandCard;
    setExpandCard(false);
    setSpinning(true);

    const N = films.length;
    const winIdx = Math.floor(Math.random() * N);
    const ww = containerRef.current?.clientWidth ?? window.innerWidth;
    const steps = ((winIdx - (baseAbs.current % N)) + N) % N;
    const targetAbs = baseAbs.current + N * ROTATIONS + (steps === 0 ? N : steps);
    const startPos = scrollPos.current;
    const endPos = centerOffset(targetAbs, ww);
    const duration = 5200;
    let t0: number | null = null;

    function frame(now: number) {
      if (t0 === null) t0 = now;
      const t = Math.min((now - t0) / duration, 1);
      const pos = startPos + (endPos - startPos) * easeOutCubic(t);
      scrollPos.current = pos;
      updateSlots(pos);

      if (t < 1) {
        rafId.current = requestAnimationFrame(frame);
      } else {
        setSpinning(false);
        setWinner(films[winIdx]);
        requestAnimationFrame(() => setExpandCard(true));
        // Snap back one full cycle (visually identical, keeps absIdx bounded)
        setTimeout(() => {
          baseAbs.current = N + winIdx;
          const reset = centerOffset(N + winIdx, ww);
          scrollPos.current = reset;
          slotFilm.current.fill(-1);
          updateSlots(reset);
        }, 60);
      }
    }

    cancelAnimationFrame(rafId.current);
    setTimeout(
      () => { rafId.current = requestAnimationFrame(frame); },
      hadCard ? 420 : 0,
    );
  }

  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  if (loading) return <Skeleton />;
  const N = films.length;
  const winPosterUrl = winner ? posterUrl(winner.posterPath) : null;

  return (
    <main
      style={{
        height: "calc(100vh - 56px)",
        overflow: "hidden",
        background: "#1c1108",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "22px 48px 16px",
          flexShrink: 0,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <h1
          className="font-display tracking-tight"
          style={{ color: "rgba(240,210,150,0.95)", fontSize: "3rem", lineHeight: 1 }}
        >
          Watchlist
        </h1>
        {N > 0 && (
          <span style={{ color: "rgba(196,154,60,0.6)", fontSize: 13 }}>
            {N} film{N !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {N < 2 ? (
        <div style={{ padding: "0 48px" }}>
          <div
            style={{
              borderRadius: 4,
              padding: "48px 32px",
              textAlign: "center",
              background: "rgba(196,154,60,0.04)",
              border: `1px solid ${EDGE}`,
            }}
          >
            <p style={{ color: "rgba(196,154,60,0.6)", fontSize: 14 }}>
              {N === 0 ? "Your watchlist is empty." : "Add at least 2 films to spin."}
            </p>
            <p style={{ color: "rgba(196,154,60,0.4)", fontSize: 12, marginTop: 8 }}>
              Add films on Letterboxd, then sync from Settings.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Virtual reel ── */}
          <div
            ref={containerRef}
            style={{
              height: REEL_H,
              flexShrink: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* 16 poster slots — the entire animation happens by moving these */}
            {Array.from({ length: SLOTS }, (_, s) => (
              <div
                key={s}
                ref={(el) => {
                  slotEls.current[s] = el;
                  // Start off-screen; updateSlots will place them correctly
                  if (el) el.style.transform = "translateX(-9999px)";
                }}
                style={{
                  position: "absolute",
                  top: (REEL_H - POSTER_H) / 2,
                  left: 0,
                  width: POSTER_W,
                  height: POSTER_H,
                  borderRadius: 4,
                  overflow: "hidden",
                  background: "rgba(196,154,60,0.08)",
                }}
              >
                <img
                  ref={(el) => { slotImgs.current[s] = el; }}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ))}

            {/* Gradient fades */}
            <div
              style={{
                position: "absolute", top: 0, left: 0, bottom: 0, width: "28%",
                background: "linear-gradient(to right, #1c1108 10%, transparent 100%)",
                pointerEvents: "none", zIndex: 2,
              }}
            />
            <div
              style={{
                position: "absolute", top: 0, right: 0, bottom: 0, width: "28%",
                background: "linear-gradient(to left, #1c1108 10%, transparent 100%)",
                pointerEvents: "none", zIndex: 2,
              }}
            />

            {/* Backdrop dims the reel behind the card */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(28,17,8,0.72)",
                opacity: expandCard ? 1 : 0,
                transition: "opacity 0.4s ease",
                pointerEvents: "none",
                zIndex: 4,
              }}
            />

            {/* Expanding winner card */}
            {winner && (
              <div
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 5,
                  width: expandCard ? CARD_W : POSTER_W,
                  height: POSTER_H,
                  display: "flex",
                  overflow: "hidden",
                  borderRadius: expandCard ? 12 : 4,
                  border: "1px solid rgba(196,154,60,0.35)",
                  boxShadow: expandCard
                    ? "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(196,154,60,0.15)"
                    : "none",
                  opacity: expandCard ? 1 : 0,
                  pointerEvents: expandCard ? "auto" : "none",
                  transition:
                    "width 0.45s cubic-bezier(0.4,0,0.2,1), border-radius 0.45s ease, box-shadow 0.45s ease, opacity 0.3s ease",
                }}
              >
                {/* Poster */}
                <div
                  style={{
                    width: POSTER_W,
                    height: "100%",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {winPosterUrl && (
                    <img
                      src={winPosterUrl}
                      alt={winner.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  )}
                </div>

                {/* Details panel */}
                <div
                  style={{
                    flex: 1,
                    background: "#1c1108",
                    padding: "24px 20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minWidth: 0,
                    opacity: expandCard ? 1 : 0,
                    transition: "opacity 0.25s ease 0.22s",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      className="font-display"
                      style={{
                        color: "rgba(240,210,150,0.95)",
                        fontSize: "1.35rem",
                        lineHeight: 1.3,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical" as const,
                      }}
                    >
                      {winner.title}
                    </p>
                    <p style={{ color: "rgba(196,154,60,0.55)", fontSize: 13, marginTop: 8 }}>
                      {[
                        winner.year,
                        winner.lbRating != null && `★ ${winner.lbRating.toFixed(1)}`,
                        winner.runtimeMin != null && `${winner.runtimeMin} min`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <a
                    href={`https://letterboxd.com/tmdb/${winner.tmdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "9px 0",
                      textAlign: "center",
                      borderRadius: 24,
                      background: "#c9a84c",
                      color: "#1c1108",
                      fontSize: 13,
                      fontWeight: 500,
                      textDecoration: "none",
                      display: "block",
                    }}
                  >
                    View on Letterboxd ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* ── SPIN button ── */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 48px 24px",
              borderTop: `1px solid ${EDGE}`,
            }}
          >
            <button
              type="button"
              onClick={spin}
              disabled={spinning}
              style={{
                padding: "13px 44px",
                borderRadius: 32,
                background: spinning ? "rgba(196,154,60,0.06)" : "#c9a84c",
                color: spinning ? "rgba(196,154,60,0.3)" : "#1c1108",
                border: spinning ? `1px solid ${EDGE}` : "none",
                fontFamily: "var(--font-display)",
                fontSize: 20,
                letterSpacing: "0.1em",
                cursor: spinning ? "not-allowed" : "pointer",
                transition: "background 0.3s, color 0.3s",
                minWidth: 160,
              }}
            >
              {spinning ? "…" : "SPIN"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Skeleton() {
  return (
    <main
      style={{
        height: "calc(100vh - 56px)",
        overflow: "hidden",
        background: "#1c1108",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "22px 48px 16px", flexShrink: 0 }}>
        <div style={{ width: 220, height: 48, borderRadius: 4, background: "rgba(196,154,60,0.06)" }} />
      </div>
      <div style={{ height: REEL_H, flexShrink: 0, background: "rgba(196,154,60,0.025)" }} />
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          padding: "20px 48px 24px",
          borderTop: "1px solid rgba(196,154,60,0.2)",
        }}
      >
        <div style={{ width: 160, height: 50, borderRadius: 32, background: "rgba(196,154,60,0.06)" }} />
      </div>
    </main>
  );
}
