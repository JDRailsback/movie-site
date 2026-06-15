"use client";

import { RecRow } from "@/components/recs/RecRow";
import { type RecItem, getRecs } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const SURFACES = [
  {
    key: "overall",
    title: "Top picks",
    blurb: "Your best overall matches — the highest-scoring films for your taste.",
  },
  {
    key: "blind_spots",
    title: "Blind spots",
    blurb: "Popular, acclaimed films you've somehow missed — that fit your taste.",
  },
  {
    key: "hidden_gems",
    title: "Hidden gems",
    blurb: "Niche, less-popular films the algorithm dug up just for you.",
  },
];

export default function RecsPage() {
  const { profile } = useParams<{ profile: string }>();
  const [recs, setRecs] = useState<Record<string, RecItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(SURFACES.map((s) => getRecs(profile, s.key).catch(() => null))).then((sets) => {
      const out: Record<string, RecItem[]> = {};
      sets.forEach((set, i) => {
        out[SURFACES[i].key] = set?.items ?? [];
      });
      setRecs(out);
      setLoading(false);
    });
  }, [profile]);

  function remove(surface: string, tmdbId: number) {
    setRecs((r) => ({
      ...r,
      [surface]: (r[surface] ?? []).filter((i) => i.film.tmdbId !== tmdbId),
    }));
  }

  return (
    <main className="relative min-h-screen w-full pb-20">
      <div className="mx-auto max-w-[1200px] px-6 pt-12 sm:px-8">
        <header className="mb-10">
          <Link href={`/p/${profile}`} className="text-sm text-ink/50 hover:text-ink">
            ← back to your map
          </Link>
          <h1 className="mt-3 font-display text-5xl font-semibold text-ink sm:text-6xl">
            Watch next
          </h1>
        </header>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {["a", "b", "c", "d", "e", "f"].map((k) => (
              <div key={k} className="aspect-[2/3] w-44 shrink-0 skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-12">
            {SURFACES.map((s) => {
              const items = recs[s.key] ?? [];
              return (
                <section key={s.key}>
                  <h2 className="font-display text-2xl font-semibold text-ink">{s.title}</h2>
                  <p className="mb-5 mt-1 text-sm text-ink/50">{s.blurb}</p>
                  {items.length ? (
                    <RecRow
                      items={items}
                      profileId={profile}
                      surface={s.key}
                      onRemove={(id) => remove(s.key, id)}
                    />
                  ) : (
                    <p className="text-sm font-semibold text-ink/50">
                      Nothing here yet — try importing more films, or check back as the corpus
                      grows.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
