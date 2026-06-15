"use client";

// Profile hub (whimsical). A scrapbook of pastel tiles in two balanced columns
// so nothing stretches into empty space. Recently-watched omitted (lives on
// Letterboxd).

import { FilterBanner, FilterProvider } from "@/components/taste/FilterContext";
import {
  DecadeTile,
  DirectorsTile,
  GenreTile,
  PassportTile,
  PersonalityTile,
  ThemesTile,
} from "@/components/taste/Tiles";
import { PaperCard } from "@/components/ui/PaperCard";
import {
  type FilmDatum,
  type ProfileSummary,
  type TasteProfile,
  getFilms,
  getProfileSummary,
  getTasteProfile,
} from "@/lib/api";
import { HEX, pastelFor } from "@/lib/pastels";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfileHubPage() {
  const { profile } = useParams<{ profile: string }>();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [films, setFilms] = useState<FilmDatum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProfileSummary(profile).catch(() => null),
      getTasteProfile(profile).catch(() => null),
      getFilms(profile).catch(() => [] as FilmDatum[]),
    ]).then(([s, t, f]) => {
      setSummary(s);
      setTaste(t);
      setFilms(f);
      setLoading(false);
    });
  }, [profile]);

  if (loading) return <HubSkeleton />;

  const genres = taste
    ? Object.values(taste.genreAffinity).sort((a, b) => b.affinity - a.affinity)
    : [];
  const directors = taste
    ? Object.values(taste.directorAffinity).sort((a, b) => b.affinity - a.affinity)
    : [];
  const topGenre = genres[0]?.name;
  const topDirector = directors.filter((d) => d.affinity > 0)[0]?.name;

  const tiles = taste
    ? [
        { key: "g", el: <GenreTile taste={taste} /> },
        { key: "d", el: <DirectorsTile taste={taste} /> },
        { key: "t", el: <ThemesTile taste={taste} /> },
        { key: "c", el: <DecadeTile taste={taste} /> },
        { key: "p", el: <PassportTile taste={taste} /> },
        { key: "v", el: <PersonalityTile taste={taste} /> },
      ]
    : [];

  return (
    <main className="relative min-h-screen w-full pb-20">
      <div className="mx-auto max-w-[1200px] px-6 pt-12 sm:px-8">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/40">
            Your taste map
          </p>
          <h1 className="mt-2 font-display text-5xl font-semibold text-ink sm:text-6xl">
            {summary?.displayName ?? summary?.username ?? "You"}
          </h1>
          {taste && topGenre && (
            <p className="mt-4 max-w-2xl text-lg text-ink/70">
              You light up for <Hl text={topGenre} k={topGenre} />
              {topDirector ? (
                <>
                  {" "}
                  and anything by <Hl text={topDirector} k={topDirector} />
                </>
              ) : null}
              .
            </p>
          )}
        </header>

        {!taste ? (
          <PaperCard>
            <p className="text-ink-soft">
              Your taste map is still being drawn — refresh in a moment.
            </p>
          </PaperCard>
        ) : (
          <FilterProvider films={films}>
            <FilterBanner />
            <p className="mb-5 text-sm text-ink/40">
              Tap any genre, director, decade, country or theme to filter your whole map.
            </p>
            <div className="md:columns-2 [column-gap:1.5rem]">
              {tiles.map((tile) => (
                <div key={tile.key} className="mb-6 break-inside-avoid">
                  {tile.el}
                </div>
              ))}
            </div>
          </FilterProvider>
        )}

        <div className="mt-14 text-center">
          <Link
            href={`/p/${profile}/recs`}
            className="inline-block rounded-full bg-ink px-7 py-3 font-medium text-paper transition hover:opacity-90"
          >
            See what to watch next →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Hl({ text, k }: { text: string; k: string }) {
  return (
    <span
      className="rounded px-1.5 font-semibold text-ink"
      style={{ backgroundColor: `${HEX[pastelFor(k)].fill}40` }}
    >
      {text}
    </span>
  );
}

function HubSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-10 h-14 w-64 skeleton" />
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="h-96 skeleton rounded-squircle" />
          <div className="h-40 skeleton rounded-squircle" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="h-60 skeleton rounded-squircle" />
          <div className="h-40 skeleton rounded-squircle" />
          <div className="h-40 skeleton rounded-squircle" />
        </div>
      </div>
    </main>
  );
}
