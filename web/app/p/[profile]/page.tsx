"use client";

import {
  type ProfileSummary,
  type RecItem,
  type TasteProfile,
  getRecs,
  getProfileSummary,
  getTasteProfile,
  posterUrl,
} from "@/lib/api";
import { type SemanticStyle, semStyle } from "@/lib/semantic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileDashboard() {
  const { profile } = useParams<{ profile: string }>();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [topRecs, setTopRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProfileSummary(profile).catch(() => null),
      getTasteProfile(profile).catch(() => null),
      getRecs(profile, "overall").catch(() => null),
    ]).then(([s, t, r]) => {
      setSummary(s);
      setTaste(t);
      setTopRecs(r?.items ?? []);
      setLoading(false);
    });
  }, [profile]);

  if (loading) return <DashSkeleton />;

  const genres = taste
    ? Object.values(taste.genreAffinity)
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 8)
    : [];
  const directors = taste
    ? Object.values(taste.directorAffinity)
        .filter((d) => d.affinity > 0)
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 5)
    : [];
  const themes = taste?.topKeywords?.slice(0, 10) ?? [];

  const displayName = summary?.displayName ?? summary?.username ?? "You";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const viewingStyle = taste
    ? taste.sigma >= 2.2
      ? "Eclectic"
      : taste.sigma <= 1.3
        ? "Consistent"
        : "Decisive"
    : null;

  return (
    <main
      style={{ background: "#1C1C1E", color: "#F0F0EE" }}
      className="min-h-screen w-full pb-20"
    >
      <div className="mx-auto max-w-[1200px] px-6 pt-10 sm:px-8">
        <div className="flex flex-col gap-4">

          {/* ── Tile 1: Hero + navigation ─────────────────────────────── */}
          <Tile>
            <div className="flex flex-wrap items-center justify-between gap-6">
              {/* Identity */}
              <div className="flex items-center gap-4">
                <div
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-xl font-semibold"
                  style={{ background: "#0E3A3A", color: "#78D8D8" }}
                >
                  {initials}
                </div>
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: "#636366" }}
                  >
                    Film profile
                  </p>
                  <h1
                    className="font-display text-4xl font-semibold"
                    style={{ color: "#F0F0EE" }}
                  >
                    {displayName}
                  </h1>
                </div>
              </div>

              {/* Nav buttons */}
              <div className="flex flex-wrap gap-2">
                <NavBtn href={`/p/${profile}/recs`} label="Watch next" />
                <NavBtn href={`/p/${profile}/taste`} label="Taste map" />
                <NavBtn label="Lists" soon />
                <NavBtn label="Compare" soon />
                <NavBtn label="Year in review" soon />
              </div>
            </div>
          </Tile>

          {/* ── Tile 2: Top picks ─────────────────────────────────────── */}
          <Tile>
            <div className="mb-4 flex items-baseline justify-between">
              <h2
                className="font-display text-xl font-semibold"
                style={{ color: "#F0F0EE" }}
              >
                Top picks
              </h2>
              <Link
                href={`/p/${profile}/recs`}
                className="text-xs transition"
                style={{ color: "#636366" }}
              >
                All recommendations →
              </Link>
            </div>
            {topRecs.length ? (
              <div className="grid grid-cols-8 gap-3">
                {topRecs.slice(0, 8).map((item) => {
                  const url = posterUrl(item.film.posterPath);
                  return (
                    <a
                      key={item.film.tmdbId}
                      href={`https://letterboxd.com/tmdb/${item.film.tmdbId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative"
                    >
                      <div
                        className="relative aspect-[2/3] w-full overflow-hidden rounded-lg"
                        style={{ background: "#3A3A3C" }}
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={item.film.title}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-end p-2">
                            <span
                              className="line-clamp-3 text-[9px] leading-tight"
                              style={{ color: "#636366" }}
                            >
                              {item.film.title}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: "#0E3A3A", color: "#78D8D8" }}
                        >
                          {item.fit}%
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#636366" }}>
                Recommendations loading — check back in a moment.
              </p>
            )}
          </Tile>

          {/* ── Tile 3: Taste snapshot ────────────────────────────────── */}
          <Tile>
            <div className="mb-5 flex items-baseline justify-between">
              <h2
                className="font-display text-xl font-semibold"
                style={{ color: "#F0F0EE" }}
              >
                Taste snapshot
              </h2>
              <Link
                href={`/p/${profile}/taste`}
                className="text-xs transition"
                style={{ color: "#636366" }}
              >
                Full taste map →
              </Link>
            </div>

            {/* Stats row */}
            {(summary || taste) && (
              <div
                className="mb-6 flex gap-8 pb-6"
                style={{ borderBottom: "1px solid #3A3A3C" }}
              >
                <Stat
                  value={(summary?.filmCount ?? 0).toLocaleString()}
                  label="films rated"
                />
                {taste && (
                  <Stat value={taste.mu.toFixed(1)} label="avg rating" />
                )}
                {viewingStyle && (
                  <Stat value={viewingStyle} label="viewing style" />
                )}
              </div>
            )}

            {taste ? (
              <div className="grid grid-cols-3 gap-8">
                {/* Genres */}
                <div>
                  <Label>Genres</Label>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => {
                      const s = semStyle(g.name);
                      return (
                        <Chip key={g.name} style={s}>
                          {g.name}
                        </Chip>
                      );
                    })}
                  </div>
                </div>

                {/* Directors */}
                <div>
                  <Label>Directors</Label>
                  <ul className="flex flex-col gap-2">
                    {directors.map((d, i) => (
                      <li key={d.name} className="flex items-center gap-3">
                        <span
                          className="w-4 shrink-0 text-right text-[10px]"
                          style={{ color: "#636366" }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="truncate text-sm"
                          style={{ color: "#F0F0EE" }}
                        >
                          {d.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Themes */}
                <div>
                  <Label>Themes</Label>
                  <div className="flex flex-wrap gap-2">
                    {themes.map((k) => {
                      const s = semStyle(k.name);
                      return (
                        <Chip key={k.id} style={s}>
                          {k.name}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#636366" }}>
                Taste profile loading…
              </p>
            )}
          </Tile>
        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "#2C2C2E", border: "1px solid #3A3A3C" }}
    >
      {children}
    </div>
  );
}

function NavBtn({
  href,
  label,
  soon,
}: {
  href?: string;
  label: string;
  soon?: boolean;
}) {
  if (soon) {
    return (
      <span
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium opacity-40"
        style={{ background: "#3A3A3C", color: "#AEAEB2" }}
      >
        {label}
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: "#48484A", color: "#636366" }}
        >
          soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={href ?? "#"}
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:brightness-125"
      style={{ background: "#0E3A3A", color: "#78D8D8" }}
    >
      {label} →
    </Link>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div
        className="font-display text-2xl font-semibold"
        style={{ color: "#F0F0EE" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px]" style={{ color: "#636366" }}>
        {label}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: "#636366" }}
    >
      {children}
    </p>
  );
}

function Chip({
  children,
  style,
}: {
  children: React.ReactNode;
  style: SemanticStyle;
}) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="text-[10px] leading-none">{style.icon}</span>
      {children}
    </span>
  );
}

function DashSkeleton() {
  return (
    <main
      style={{ background: "#1C1C1E" }}
      className="min-h-screen w-full pb-20"
    >
      <div className="mx-auto max-w-[1200px] flex flex-col gap-4 px-6 pt-10 sm:px-8">
        <div className="h-28 skeleton rounded-xl" />
        <div className="h-72 skeleton rounded-xl" />
        <div className="h-56 skeleton rounded-xl" />
      </div>
    </main>
  );
}
