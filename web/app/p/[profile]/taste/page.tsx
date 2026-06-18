"use client";

import {
  type FilmDatum,
  type ProfileSummary,
  type TasteProfile,
  getFilms,
  getProfileSummary,
  getTasteProfile,
  posterUrl,
} from "@/lib/api";
import { semStyle } from "@/lib/semantic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function TasteMapPage() {
  const { profile } = useParams<{ profile: string }>();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [films, setFilms] = useState<FilmDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getProfileSummary(profile).catch(() => null),
      getTasteProfile(profile).catch(() => null),
      getFilms(profile).catch(() => [] as FilmDatum[]),
    ]).then(([s, t, f]) => {
      setSummary(s);
      setTaste(t);
      setFilms(f);
      if (t) {
        const top = Object.values(t.genreAffinity).sort(
          (a, b) => b.affinity - a.affinity,
        )[0];
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
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.liked !== b.liked) return a.liked ? -1 : 1;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    }
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
    for (const list of map.values()) {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return map;
  }, [films]);

  if (loading) return <TasteSkeleton />;

  const genres = taste
    ? Object.values(taste.genreAffinity).sort((a, b) => b.affinity - a.affinity)
    : [];

  const directors = taste
    ? Object.values(taste.directorAffinity)
        .filter((d) => d.affinity > 0)
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 8)
    : [];

  const themes = taste?.topKeywords?.slice(0, 24) ?? [];
  const displayName = summary?.displayName ?? summary?.username ?? "You";

  const activeGenre = genres.find((g) => g.name === selectedGenre) ?? null;
  const activeFilms = selectedGenre ? (filmsByGenre.get(selectedGenre) ?? []) : [];
  const maxAff = Math.max(...genres.map((g) => g.affinity), 0.01);

  return (
    <main style={{ background: "#1C1C1E", color: "#F0F0EE" }} className="min-h-screen pb-24">
      <div className="mx-auto max-w-[1200px] px-6 pt-10 sm:px-8">

        {/* ── Header ── */}
        <header className="mb-10">
          <Link href={`/p/${profile}`} className="text-sm transition" style={{ color: "#636366" }}>
            ← back
          </Link>
          <h1 className="mt-4 font-display text-5xl font-semibold sm:text-6xl" style={{ color: "#F0F0EE" }}>
            {displayName}
          </h1>
          <div className="mt-4 flex gap-8">
            <Stat value={(summary?.filmCount ?? 0).toLocaleString()} label="films rated" />
            {taste && <Stat value={taste.mu.toFixed(1)} label="avg rating" />}
            {taste && (
              <Stat
                value={taste.sigma >= 2.2 ? "Eclectic" : taste.sigma <= 1.3 ? "Consistent" : "Decisive"}
                label="viewing style"
              />
            )}
          </div>
        </header>

        {/* ── Genres: two-column explorer ── */}
        {genres.length > 0 && (
          <section className="mb-14">
            <SectionLabel>Genres</SectionLabel>
            <div
              className="overflow-hidden rounded-xl"
              style={{
                display: "flex",
                height: "min(calc(100vh - 300px), 700px)",
                minHeight: 420,
                border: "1px solid #3A3A3C",
              }}
            >
              {/* Left: genre bar chart */}
              <div
                className="no-scrollbar flex flex-col overflow-y-auto"
                style={{ width: 232, flexShrink: 0, borderRight: "1px solid #3A3A3C", background: "#242426" }}
              >
                {genres.map((g, i) => {
                  const s = semStyle(g.name);
                  const active = g.name === selectedGenre;
                  const barPct = Math.max(0, g.affinity / maxAff) * 100;
                  return (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => setSelectedGenre(g.name)}
                      className="group flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:brightness-110"
                      style={{
                        background: active
                          ? s.bg
                          : i % 2 === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.025)",
                        borderBottom: "1px solid #3A3A3C",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xs leading-none" style={{ color: s.fg }}>{s.icon}</span>
                          <span
                            className="truncate text-sm font-medium"
                            style={{ color: active ? s.fg : "#AEAEB2" }}
                          >
                            {g.name}
                          </span>
                        </div>
                        <span
                          className="shrink-0 text-[11px] font-semibold tabular-nums"
                          style={{ color: active ? s.fg : "#636366" }}
                        >
                          {g.affinity >= 0 ? "+" : ""}{g.affinity.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#3A3A3C" }}>
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${barPct}%`, background: s.fg }}
                        />
                      </div>
                      <span className="text-[10px]" style={{ color: "#636366" }}>{g.count} films</span>
                    </button>
                  );
                })}
              </div>

              {/* Right: film grid */}
              <div className="no-scrollbar flex-1 overflow-y-auto" style={{ background: "#2C2C2E" }}>
                {activeGenre ? (
                  <div className="p-5">
                    {/* Genre header */}
                    <div className="mb-5 flex items-center gap-3">
                      <span
                        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold"
                        style={{
                          background: semStyle(activeGenre.name).bg,
                          color: semStyle(activeGenre.name).fg,
                        }}
                      >
                        <span className="text-[11px] leading-none">{semStyle(activeGenre.name).icon}</span>
                        {activeGenre.name}
                      </span>
                      <span className="text-sm" style={{ color: "#636366" }}>
                        {activeGenre.count} films · avg {activeGenre.avg_rating.toFixed(1)} ·{" "}
                        {activeGenre.affinity >= 0 ? "+" : ""}{activeGenre.affinity.toFixed(2)} affinity
                      </span>
                    </div>

                    {/* Film grid */}
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
                    >
                      {activeFilms.slice(0, 30).map((film) => {
                        const url = posterUrl(film.posterPath);
                        return (
                          <a
                            key={film.tmdbId}
                            href={`https://letterboxd.com/tmdb/${film.tmdbId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col gap-1.5"
                          >
                            <div
                              className="relative w-full overflow-hidden rounded-lg"
                              style={{ aspectRatio: "2/3", background: "#3A3A3C" }}
                            >
                              {url ? (
                                <img
                                  src={url}
                                  alt={film.title}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-end p-2">
                                  <span className="line-clamp-3 text-[9px] leading-tight" style={{ color: "#636366" }}>
                                    {film.title}
                                  </span>
                                </div>
                              )}
                              {film.liked && (
                                <span
                                  className="absolute right-1.5 top-1.5 text-xs leading-none"
                                  style={{ color: "#F0A0C4" }}
                                >
                                  ♥
                                </span>
                              )}
                            </div>
                            <div>
                              <p
                                className="truncate text-[11px] font-medium leading-tight"
                                style={{ color: "#F0F0EE" }}
                              >
                                {film.title}
                              </p>
                              <p className="text-[10px]" style={{ color: "#636366" }}>
                                {film.year ?? ""}
                                {film.rating != null && (
                                  <span style={{ color: "#AEAEB2" }}> · ★ {(film.rating / 2).toFixed(1)}</span>
                                )}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm" style={{ color: "#636366" }}>Select a genre</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Themes ── */}
        {themes.length > 0 && (
          <section className="mb-14">
            <SectionLabel>Themes</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {themes.map((k) => {
                const s = semStyle(k.name);
                return (
                  <span
                    key={k.id}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
                    style={{ background: s.bg, color: s.fg }}
                  >
                    <span className="text-[11px] leading-none">{s.icon}</span>
                    {k.name}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Directors ── */}
        {directors.length > 0 && (
          <section>
            <SectionLabel>Directors</SectionLabel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {directors.map((d, i) => {
                const dirFilms = (filmsByDirector.get(d.name) ?? []).slice(0, 4);
                return (
                  <div
                    key={d.name}
                    className="rounded-lg p-4"
                    style={{ background: "#2C2C2E", border: "1px solid #3A3A3C" }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs tabular-nums" style={{ color: "#636366" }}>{i + 1}</span>
                      <span className="truncate text-sm font-semibold" style={{ color: "#F0F0EE" }}>{d.name}</span>
                    </div>
                    <div className="flex gap-1.5">
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
                              className="overflow-hidden rounded"
                              style={{ width: 44, height: 66, background: "#3A3A3C" }}
                            >
                              {url && (
                                <img
                                  src={url}
                                  alt={f.title}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 text-[10px]" style={{ color: "#636366" }}>
                      {d.count} films · {d.affinity >= 0 ? "+" : ""}{d.affinity.toFixed(2)} affinity
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#636366" }}>
      {children}
    </p>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold" style={{ color: "#F0F0EE" }}>{value}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: "#636366" }}>{label}</div>
    </div>
  );
}

function TasteSkeleton() {
  return (
    <main style={{ background: "#1C1C1E" }} className="min-h-screen pb-24">
      <div className="mx-auto max-w-[1200px] flex flex-col gap-6 px-6 pt-10 sm:px-8">
        <div className="h-36 skeleton rounded-xl" />
        <div className="h-12 skeleton rounded-xl" />
        <div
          className="skeleton rounded-xl"
          style={{ height: "min(calc(100vh - 300px), 700px)", minHeight: 420 }}
        />
        <div className="h-20 skeleton rounded-xl" />
        <div className="h-48 skeleton rounded-xl" />
      </div>
    </main>
  );
}
