"use client";

// Profile hub (whimsical). A scrapbook of pastel tiles in two balanced columns
// so nothing stretches into empty space. Recently-watched omitted (lives on
// Letterboxd).

import {
  DecadeTile,
  DiggingTile,
  DirectorsTile,
  GenreTile,
  PassportTile,
  PersonalityTile,
  ThemesTile,
} from "@/components/taste/Tiles";
import { FloatingShapes } from "@/components/ui/FloatingShapes";
import { Marquee } from "@/components/ui/Marquee";
import { PaperCard } from "@/components/ui/PaperCard";
import {
  type ProfileSummary,
  type TasteProfile,
  getProfileSummary,
  getTasteProfile,
} from "@/lib/api";
import { HEX, pastelFor } from "@/lib/pastels";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfileHubPage() {
  const { profile } = useParams<{ profile: string }>();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProfileSummary(profile).catch(() => null),
      getTasteProfile(profile).catch(() => null),
    ]).then(([s, t]) => {
      setSummary(s);
      setTaste(t);
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
        { key: "g", el: <GenreTile taste={taste} tilt={-2} /> },
        { key: "d", el: <DirectorsTile taste={taste} tilt={2.5} /> },
        { key: "t", el: <ThemesTile taste={taste} tilt={-2.5} /> },
        { key: "c", el: <DecadeTile taste={taste} tilt={2} /> },
        { key: "p", el: <PassportTile taste={taste} tilt={-2} /> },
        { key: "v", el: <PersonalityTile taste={taste} tilt={2.5} /> },
        { key: "w", el: <DiggingTile taste={taste} tilt={-2} /> },
      ]
    : [];

  const marquee = [
    "Your taste map",
    `${summary?.filmCount ?? ""} films`,
    topGenre ? `${topGenre} lover` : "",
    topDirector ?? "",
    "Now showing",
    "Reel",
  ].filter(Boolean) as string[];

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden pb-20">
      <FloatingShapes />

      <div className="mb-8">
        <Marquee items={marquee} />
      </div>

      <div className="mx-auto max-w-[1380px] px-6 sm:px-10 lg:px-16">
        <header className="mb-8">
          <motion.span
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: -3 }}
            transition={{ type: "spring", stiffness: 240, damping: 12 }}
            className="brutal-sm inline-block rounded-full bg-mint px-3 py-1 text-xs font-black uppercase tracking-widest text-ink"
          >
            ✦ Your taste map ✦
          </motion.span>
          <motion.h1
            initial={{ y: 30, opacity: 0, rotate: -3 }}
            animate={{ y: 0, opacity: 1, rotate: -1.5 }}
            transition={{ type: "spring", stiffness: 130, damping: 11 }}
            className="mt-3 inline-block font-display text-7xl font-black uppercase leading-none text-ink [text-shadow:4px_4px_0_#F6AE96,7px_7px_0_#3B322C] sm:text-8xl"
          >
            {summary?.displayName ?? summary?.username ?? "You"}
          </motion.h1>
          {taste && topGenre && (
            <p className="mt-5 max-w-2xl text-2xl font-bold text-ink">
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
          <div className="md:columns-2 xl:columns-3 [column-gap:1.25rem]">
            {tiles.map((tile, i) => (
              <div
                key={tile.key}
                className="mb-5 break-inside-avoid animate-float"
                style={{
                  animationDelay: `${(i % 5) * 0.6}s`,
                  animationDuration: `${7 + (i % 3)}s`,
                }}
              >
                {tile.el}
              </div>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-base font-black uppercase tracking-wide text-ink/40">
          ✦ Recs — blind spots · hidden gems · rabbit holes — coming next ✦
        </p>
      </div>
    </main>
  );
}

function Hl({ text, k }: { text: string; k: string }) {
  return (
    <span
      className="brutal-sm mx-0.5 inline-block -rotate-1 rounded-md px-1.5 font-black text-ink"
      style={{ background: HEX[pastelFor(k)].fill }}
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
