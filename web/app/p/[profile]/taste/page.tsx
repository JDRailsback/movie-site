"use client";

import {
  type FilmDatum,
  type TasteProfile,
  getFilms,
  getTasteProfile,
  posterUrl,
} from "@/lib/api";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const EDGE = "rgba(255,255,255,0.06)";
const DIM = "rgba(255,255,255,0.25)";

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-7 text-[10px] uppercase tracking-[0.25em] font-medium"
      style={{ color: "rgba(255,255,255,0.2)" }}
    >
      {children}
    </p>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-sm px-5 py-3"
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${EDGE}` }}
    >
      <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.2)" }}>
        {label}
      </span>
      <span className="text-[15px] font-medium text-white tabular-nums">{value}</span>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function TasteMapPage() {
  const { profile } = useParams<{ profile: string }>();
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [films, setFilms] = useState<FilmDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getTasteProfile(profile).catch(() => null),
      getFilms(profile).catch(() => [] as FilmDatum[]),
    ]).then(([t, f]) => {
      setTaste(t);
      setFilms(f);
      if (t) {
        const top = Object.values(t.genreAffinity).sort((a, b) => b.affinity - a.affinity)[0];
        if (top) setSelectedGenre(top.name);
      }
      setLoading(false);
    });
  }, [profile]);

  const filmsByGenre = useMemo(() => {
    const map = new Map<string, FilmDatum[]>();
    for (const film of films) {
      for (const genre of film.genres) {
        if (!map.has(genre)) map.set(genre, []);
        map.get(genre)!.push(film);
      }
    }
    for (const list of map.values()) list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return map;
  }, [films]);

  const filmsByDirector = useMemo(() => {
    const map = new Map<string, FilmDatum[]>();
    for (const film of films) {
      for (const dir of film.directors) {
        if (!map.has(dir)) map.set(dir, []);
        map.get(dir)!.push(film);
      }
    }
    for (const list of map.values()) list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return map;
  }, [films]);

  const summary = useMemo(() => {
    if (!films.length) return null;
    const rated = films.filter((f) => f.rating != null);
    const avgRating = rated.length
      ? rated.reduce((s, f) => s + f.rating! / 2, 0) / rated.length
      : null;
    const liked = films.filter((f) => f.liked).length;
    return { total: films.length, avgRating, liked };
  }, [films]);

  if (loading) return <Skeleton />;

  const genres = taste
    ? Object.values(taste.genreAffinity).sort((a, b) => b.affinity - a.affinity)
    : [];

  const directors = taste
    ? Object.values(taste.directorAffinity)
        .filter((d) => d.affinity > 0 && d.count >= 2)
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 12)
    : [];

  const eras = taste
    ? Object.entries(taste.eraAffinity)
        .map(([decade, data]) => ({ decade: parseInt(decade), ...data }))
        .filter((e) => e.count > 0)
        .sort((a, b) => a.decade - b.decade)
    : [];

  const activeGenre = genres.find((g) => g.name === selectedGenre) ?? null;
  const activeFilms = selectedGenre ? (filmsByGenre.get(selectedGenre) ?? []) : [];
  const maxAff = Math.max(...genres.map((g) => g.affinity), 0.01);
  const maxEraCount = Math.max(...eras.map((e) => e.count), 1);

  return (
    <main style={{ background: "#0a0a0a" }} className="min-h-screen pb-32">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-8 pt-14">
        <h1 className="font-display text-[5.5rem] italic font-light text-white leading-none tracking-tight">
          Taste map.
        </h1>

        {summary && (
          <div className="mt-8 flex flex-wrap gap-3">
            <StatPill label="Films watched" value={summary.total.toLocaleString()} />
            {summary.avgRating != null && (
              <StatPill label="Avg rating" value={`★ ${summary.avgRating.toFixed(2)}`} />
            )}
            <StatPill label="Liked" value={summary.liked.toLocaleString()} />
            {genres[0] && <StatPill label="Top genre" value={genres[0].name} />}
            {directors[0] && <StatPill label="Top director" value={directors[0].name} />}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-8 mt-16 space-y-20">

        {/* ── Genres ───────────────────────────────────────────────────────── */}
        {genres.length > 0 && (
          <section>
            <div className="border-t pt-8" style={{ borderColor: EDGE }}>
              <SectionLabel>Genres</SectionLabel>
            </div>

            <div
              className="flex overflow-hidden rounded-sm"
              style={{
                height: "min(calc(100vh - 200px), 700px)",
                minHeight: 460,
                border: `1px solid ${EDGE}`,
              }}
            >
              {/* Left: genre list */}
              <div
                className="no-scrollbar shrink-0 overflow-y-auto"
                style={{ width: 248, borderRight: `1px solid ${EDGE}`, background: "#0d0d0d" }}
              >
                {genres.map((g) => {
                  const active = g.name === selectedGenre;
                  const barPct = Math.max(0, g.affinity / maxAff) * 100;
                  return (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => setSelectedGenre(g.name)}
                      className="flex w-full flex-col gap-2 px-5 py-3.5 text-left transition-colors"
                      style={{
                        borderBottom: `1px solid ${EDGE}`,
                        borderLeft: `2px solid ${active ? "#fff" : "transparent"}`,
                        background: active ? "rgba(255,255,255,0.05)" : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[13px] font-medium leading-tight"
                          style={{ color: active ? "#fff" : "rgba(255,255,255,0.45)" }}
                        >
                          {g.name}
                        </span>
                        <span
                          className="shrink-0 text-[11px] tabular-nums"
                          style={{ color: active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)" }}
                        >
                          {g.affinity >= 0 ? "+" : ""}
                          {g.affinity.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-full transition-[width] duration-300"
                          style={{
                            width: `${barPct}%`,
                            background: active ? "#fff" : "rgba(255,255,255,0.25)",
                          }}
                        />
                      </div>
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>
                        {g.count} films · ★ {(g.avg_rating / 2).toFixed(1)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right: film grid for selected genre */}
              <div className="no-scrollbar flex-1 overflow-y-auto" style={{ background: "#0b0b0b" }}>
                {activeGenre ? (
                  <div className="p-6">
                    <div className="mb-6 pb-5" style={{ borderBottom: `1px solid ${EDGE}` }}>
                      <h3 className="font-display text-3xl italic font-light text-white leading-none">
                        {activeGenre.name}
                      </h3>
                      <p className="mt-2 text-[12px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {activeGenre.count} films &middot; ★&thinsp;{activeGenre.avg_rating.toFixed(1)} avg &middot;{" "}
                        {activeGenre.affinity >= 0 ? "+" : ""}
                        {activeGenre.affinity.toFixed(2)} affinity
                      </p>
                    </div>

                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))" }}
                    >
                      {activeFilms.slice(0, 40).map((film) => {
                        const url = posterUrl(film.posterPath);
                        return (
                          <a
                            key={film.tmdbId}
                            href={`https://letterboxd.com/tmdb/${film.tmdbId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col gap-1"
                          >
                            <div
                              className="relative overflow-hidden rounded-sm"
                              style={{ aspectRatio: "2/3", background: "rgba(255,255,255,0.06)" }}
                            >
                              {url ? (
                                <img
                                  src={url}
                                  alt={film.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                                />
                              ) : (
                                <div className="flex h-full items-end p-1.5">
                                  <span
                                    className="line-clamp-3 text-[8px] leading-tight"
                                    style={{ color: DIM }}
                                  >
                                    {film.title}
                                  </span>
                                </div>
                              )}
                              {film.liked && (
                                <span
                                  className="absolute right-1 top-1 text-[10px] leading-none"
                                  style={{ color: "rgba(255,160,160,0.85)" }}
                                >
                                  ♥
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[10px] font-medium text-white leading-tight">
                              {film.title}
                            </p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm" style={{ color: DIM }}>
                      Select a genre
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Directors ────────────────────────────────────────────────────── */}
        {directors.length > 0 && (
          <section>
            <div className="border-t pt-8" style={{ borderColor: EDGE }}>
              <SectionLabel>Directors</SectionLabel>
            </div>

            <div style={{ border: `1px solid ${EDGE}` }}>
              {directors.map((d, i) => {
                const dirFilms = (filmsByDirector.get(d.name) ?? []).slice(0, 6);
                return (
                  <div
                    key={d.name}
                    className="flex items-center gap-5 px-6 py-4 transition-colors hover:bg-white/[0.02]"
                    style={{
                      borderBottom: i < directors.length - 1 ? `1px solid ${EDGE}` : "none",
                    }}
                  >
                    {/* Rank */}
                    <span
                      className="w-6 shrink-0 text-right text-[11px] tabular-nums"
                      style={{ color: "rgba(255,255,255,0.18)" }}
                    >
                      {i + 1}
                    </span>

                    {/* Name + stats */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-white leading-tight truncate">
                        {d.name}
                      </p>
                      <p className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                        {d.count} {d.count === 1 ? "film" : "films"} &middot; ★&thinsp;
                        {(d.avg_rating / 2).toFixed(1)} avg &middot;{" "}
                        {d.affinity >= 0 ? "+" : ""}
                        {d.affinity.toFixed(2)}
                      </p>
                    </div>

                    {/* Film thumbnails */}
                    <div className="flex shrink-0 gap-1.5">
                      {dirFilms.map((f) => {
                        const url = posterUrl(f.posterPath);
                        return (
                          <a
                            key={f.tmdbId}
                            href={`https://letterboxd.com/tmdb/${f.tmdbId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={f.title}
                            className="group shrink-0"
                          >
                            <div
                              className="overflow-hidden rounded-sm"
                              style={{
                                width: 32,
                                height: 48,
                                background: "rgba(255,255,255,0.06)",
                              }}
                            >
                              {url && (
                                <img
                                  src={url}
                                  alt={f.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.08]"
                                />
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Decades ──────────────────────────────────────────────────────── */}
        {eras.length > 0 && (
          <section>
            <div className="border-t pt-8" style={{ borderColor: EDGE }}>
              <SectionLabel>Decades</SectionLabel>
            </div>

            <div className="space-y-2">
              {eras.map((era) => {
                const barPct = (era.count / maxEraCount) * 100;
                // Map affinity (-1..+1) to bar opacity (0.12..1.0)
                const opacity = Math.max(0.12, Math.min(1.0, 0.12 + ((era.affinity + 1) / 2) * 0.88));
                return (
                  <div key={era.decade} className="flex items-center gap-4">
                    <span
                      className="w-12 shrink-0 text-right text-[12px] font-medium tabular-nums"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {era.decade}s
                    </span>

                    <div
                      className="relative flex-1 h-7 overflow-hidden rounded-sm"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div
                        className="absolute left-0 top-0 h-full rounded-sm transition-[width] duration-500"
                        style={{
                          width: `${barPct}%`,
                          background: `rgba(255,255,255,${opacity})`,
                          minWidth: 4,
                        }}
                      />
                    </div>

                    <div
                      className="flex w-40 shrink-0 items-center justify-between gap-3 text-[11px] tabular-nums"
                    >
                      <span style={{ color: "rgba(255,255,255,0.22)" }}>
                        {era.count} films
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.25)" }}>
                        ★&thinsp;{(era.avg_rating / 2).toFixed(1)}
                      </span>
                      <span
                        style={{
                          color:
                            era.affinity >= 0.15
                              ? "rgba(255,255,255,0.6)"
                              : era.affinity <= -0.15
                                ? "rgba(255,255,255,0.18)"
                                : "rgba(255,255,255,0.35)",
                        }}
                      >
                        {era.affinity >= 0 ? "+" : ""}
                        {era.affinity.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <main style={{ background: "#0a0a0a" }} className="min-h-screen pb-24">
      <div className="mx-auto max-w-7xl px-8 pt-14 space-y-8">
        <div className="h-20 w-48 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
        <div className="flex gap-3">
          {[80, 72, 64, 96, 112].map((w, i) => (
            <div
              key={i}
              className="h-16 rounded-sm"
              style={{ width: w, background: "rgba(255,255,255,0.03)" }}
            />
          ))}
        </div>
        <div
          className="rounded-sm"
          style={{
            height: "min(calc(100vh - 300px), 700px)",
            background: "rgba(255,255,255,0.03)",
          }}
        />
        <div className="h-64 rounded-sm" style={{ background: "rgba(255,255,255,0.03)" }} />
        <div className="h-40 rounded-sm" style={{ background: "rgba(255,255,255,0.03)" }} />
      </div>
    </main>
  );
}
