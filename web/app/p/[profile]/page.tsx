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
import { PaperCard } from "@/components/ui/PaperCard";
import { Sticker } from "@/components/ui/Sticker";
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

  return (
    <main className="relative mx-auto max-w-5xl px-6 py-14">
      <FloatingShapes />

      <header className="mb-10 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-ink-faint">Your taste map</p>
        <h1 className="font-display text-5xl font-black text-ink">
          {summary?.displayName ?? summary?.username ?? "You"}
        </h1>
        {taste && topGenre && (
          <p className="max-w-xl text-lg text-ink-soft">
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
        {summary && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Sticker label={`${summary.filmCount} films`} pastel="sky" index={0} />
          </div>
        )}
      </header>

      {!taste ? (
        <PaperCard>
          <p className="text-ink-soft">
            Your taste map is still being drawn — refresh in a moment.
          </p>
        </PaperCard>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <GenreTile taste={taste} tilt={-0.8} delay={0} />
            <ThemesTile taste={taste} tilt={-1.2} delay={0.1} />
            <DiggingTile taste={taste} tilt={0.8} delay={0.15} />
          </div>
          <div className="flex flex-col gap-6">
            <DirectorsTile taste={taste} tilt={1.1} delay={0.05} />
            <DecadeTile taste={taste} tilt={-0.9} delay={0.1} />
            <PassportTile taste={taste} tilt={1.3} delay={0.15} />
            <PersonalityTile taste={taste} tilt={-0.7} delay={0.2} />
          </div>
        </div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10 text-center text-sm text-ink-faint"
      >
        Recommendations — blind spots, hidden gems, director rabbit holes — are coming next.
      </motion.p>
    </main>
  );
}

function Hl({ text, k }: { text: string; k: string }) {
  return (
    <span
      className="rounded-md px-1.5 font-semibold text-ink"
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
