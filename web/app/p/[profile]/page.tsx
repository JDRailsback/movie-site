"use client";

// Profile hub (whimsical redesign). A scrapbook of tilted pastel cards: genre
// affinities, the directors you adore, your themes, and your blind spots.
// Recently-watched intentionally omitted (it lives on Letterboxd).

import { AffinityBars } from "@/components/taste/AffinityBars";
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
    ? Object.values(taste.directorAffinity)
        .filter((d) => d.affinity > 0)
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 6)
    : [];
  const topGenre = genres[0]?.name;
  const topDirector = directors[0]?.name;

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
        <div className="flex flex-wrap gap-2 pt-1">
          {summary && <Sticker label={`${summary.filmCount} films`} pastel="sky" index={0} />}
          {taste?.runtimePref?.pref_min ? (
            <Sticker
              label={`~${Math.round(taste.runtimePref.pref_min)} min sweet spot`}
              pastel="peach"
              index={1}
            />
          ) : null}
        </div>
      </header>

      {!taste ? (
        <PaperCard>
          <p className="text-ink-soft">
            Your taste map is still being drawn — refresh in a moment.
          </p>
        </PaperCard>
      ) : (
        <div className="grid gap-6 md:grid-cols-5">
          <PaperCard tilt={-0.8} className="md:col-span-3">
            <CardTitle
              title="Genre affinities"
              hint="How you rate each genre vs. your own average — hover for the why."
            />
            <AffinityBars genres={taste.genreAffinity} />
          </PaperCard>

          <PaperCard tilt={1.2} delay={0.05} className="md:col-span-2">
            <CardTitle title="Directors you adore" />
            {directors.length ? (
              <ul className="space-y-3">
                {directors.map((d, i) => (
                  <li key={d.name} className="flex items-center gap-3">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-ink"
                      style={{ background: HEX[pastelFor(d.name)].fill }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate font-semibold text-ink">{d.name}</span>
                    <span className="text-xs font-bold text-ink-soft">{d.count} films</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Not enough repeat directors yet.</p>
            )}
          </PaperCard>

          <PaperCard tilt={-1.4} delay={0.1} className="md:col-span-2">
            <CardTitle title="Your themes" />
            <div className="flex flex-wrap gap-2">
              {taste.topKeywords.slice(0, 14).map((k, i) => (
                <Sticker key={k.id} label={k.name} index={i} />
              ))}
            </div>
          </PaperCard>

          <PaperCard tilt={0.9} delay={0.15} className="md:col-span-3">
            <CardTitle
              title="Blind spots"
              hint="Eras you've barely touched — we'll help you fill them in Phase 2."
            />
            <div className="flex flex-wrap gap-2">
              {taste.gaps?.decades?.length ? (
                taste.gaps.decades.map((d, i) => (
                  <Sticker key={d.decade} label={`${d.decade}s`} pastel="coral" index={i} />
                ))
              ) : (
                <p className="text-sm text-ink-soft">You're remarkably well-rounded across eras.</p>
              )}
            </div>
          </PaperCard>
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
      style={{ background: `${HEX[pastelFor(k)].fill}` }}
    >
      {text}
    </span>
  );
}

function CardTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function HubSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-10 h-14 w-64 skeleton" />
      <div className="grid gap-6 md:grid-cols-5">
        <div className="h-96 skeleton rounded-squircle md:col-span-3" />
        <div className="h-96 skeleton rounded-squircle md:col-span-2" />
        <div className="h-40 skeleton rounded-squircle md:col-span-2" />
        <div className="h-40 skeleton rounded-squircle md:col-span-3" />
      </div>
    </main>
  );
}
