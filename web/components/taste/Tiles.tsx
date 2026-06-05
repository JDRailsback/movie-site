"use client";

import { AffinityBars } from "@/components/taste/AffinityBars";
import { PaperCard } from "@/components/ui/PaperCard";
import { Sticker } from "@/components/ui/Sticker";
import type { ProfileSummary, TasteProfile } from "@/lib/api";
import { countryName, flag } from "@/lib/countries";
import { HEX, pastelFor } from "@/lib/pastels";

const MINT = "#C2E6CD";
const CLAY = "#D8C8BE";

export function CardTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export function GenreTile({ taste, tilt, delay }: TileProps) {
  return (
    <PaperCard tilt={tilt} delay={delay}>
      <CardTitle
        title="Genre affinities"
        hint="How you rate each genre vs. your own average — tap a row for the why."
      />
      <AffinityBars genres={taste.genreAffinity} />
    </PaperCard>
  );
}

export function DirectorsTile({ taste, tilt, delay }: TileProps) {
  const directors = Object.values(taste.directorAffinity)
    .filter((d) => d.affinity > 0)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 6);
  return (
    <PaperCard tilt={tilt} delay={delay}>
      <CardTitle
        title="Directors you adore"
        hint="Filmmakers you reliably rate above your average."
      />
      {directors.length ? (
        <ul className="space-y-2.5">
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
  );
}

export function ThemesTile({ taste, tilt, delay }: TileProps) {
  return (
    <PaperCard tilt={tilt} delay={delay}>
      <CardTitle title="Your themes" hint="The threads that run through your favourites." />
      <div className="flex flex-wrap gap-2">
        {taste.topKeywords.slice(0, 16).map((k, i) => (
          <Sticker key={k.id} label={k.name} index={i} />
        ))}
      </div>
    </PaperCard>
  );
}

export function DecadeTile({ taste, tilt, delay }: TileProps) {
  const decades = Object.entries(taste.eraAffinity)
    .map(([d, v]) => ({ decade: Number(d), ...v }))
    .sort((a, b) => a.decade - b.decade);
  const maxCount = Math.max(1, ...decades.map((d) => d.count));
  return (
    <PaperCard tilt={tilt} delay={delay}>
      <CardTitle
        title="Across the decades"
        hint="Bubble size = how many you've seen · colour = how much you love them."
      />
      <div className="flex flex-wrap items-end gap-x-3 gap-y-4 pt-2">
        {decades.map((d) => {
          const size = 30 + (d.count / maxCount) * 38;
          return (
            <div key={d.decade} className="flex flex-col items-center gap-1">
              <div
                className="grid place-items-center rounded-full text-[10px] font-bold text-ink/70"
                style={{
                  width: size,
                  height: size,
                  background: d.affinity >= 0 ? MINT : CLAY,
                  opacity: 0.55 + Math.min(Math.abs(d.affinity), 0.5),
                }}
                title={`${d.count} films · ${d.avg_rating}/10`}
              >
                {d.count}
              </div>
              <span className="text-[11px] font-semibold text-ink-soft">{`'${String(d.decade).slice(2)}`}</span>
            </div>
          );
        })}
      </div>
    </PaperCard>
  );
}

export function PassportTile({ taste, tilt, delay }: TileProps) {
  const countries = Object.entries(taste.countryAffinity)
    .map(([cc, v]) => ({ cc, ...v }))
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return (
    <PaperCard tilt={tilt} delay={delay}>
      <CardTitle
        title="Your film passport"
        hint="Where your cinema comes from — ♥ marks the ones you rate highest."
      />
      <div className="flex flex-wrap gap-2">
        {countries.map((c) => (
          <span
            key={c.cc}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-sm font-semibold text-ink shadow-sticker"
          >
            <span className="text-base">{flag(c.cc)}</span>
            {countryName(c.cc)}
            <span className="text-xs text-ink-faint">{c.count}</span>
            {c.affinity > 0.2 && <span className="text-coral-deep">♥</span>}
          </span>
        ))}
      </div>
    </PaperCard>
  );
}

export function PersonalityTile({ taste, tilt, delay }: TileProps) {
  const rt = taste.runtimePref?.pref_min;
  const runtimeLabel =
    rt == null
      ? null
      : rt < 95
        ? "a tight-and-punchy"
        : rt < 125
          ? "a comfortably feature-length"
          : rt < 150
            ? "a give-it-room-to-breathe"
            : "an epic-leaning";
  const avg = taste.mu / 1; // 0-10
  const generosity = avg >= 7.2 ? "generous" : avg <= 5.8 ? "tough" : "even-handed";
  const decisiveness =
    taste.sigma >= 2.2
      ? "all over the map"
      : taste.sigma <= 1.3
        ? "remarkably consistent"
        : "fairly decisive";
  return (
    <PaperCard tilt={tilt} delay={delay}>
      <CardTitle title="Your viewing personality" />
      <div className="space-y-3 text-ink">
        {runtimeLabel && (
          <p>
            You&apos;re <strong>{runtimeLabel}</strong> viewer — about{" "}
            <span className="rounded bg-peach px-1.5 font-bold">
              {Math.round(rt as number)} min
            </span>{" "}
            is your sweet spot.
          </p>
        )}
        <p>
          A <strong>{generosity}</strong> rater who&apos;s <strong>{decisiveness}</strong> — you
          average{" "}
          <span className="rounded bg-butter px-1.5 font-bold">{taste.mu.toFixed(1)}/10</span>.
        </p>
      </div>
    </PaperCard>
  );
}

export function DiggingTile({ taste, tilt, delay }: TileProps) {
  // The *useful* blind spot: something you rate highly but have barely explored.
  const eras = Object.entries(taste.eraAffinity)
    .map(([d, v]) => ({ decade: Number(d), ...v }))
    .filter((e) => e.affinity > 0.1 && e.count > 0 && e.count <= 20)
    .sort((a, b) => b.avg_rating - a.avg_rating);
  const era = eras[0];

  const country = Object.entries(taste.countryAffinity)
    .map(([cc, v]) => ({ cc, ...v }))
    .filter((c) => c.affinity > 0.25 && c.count >= 2 && c.count <= 25)
    .sort((a, b) => b.affinity - a.affinity)[0];

  return (
    <PaperCard tilt={tilt} delay={delay} className="bg-coral/20">
      <CardTitle
        title="Worth digging into"
        hint="Corners you clearly love but have barely scratched."
      />
      <ul className="space-y-2 text-sm text-ink">
        {era && (
          <li>
            ✦ <strong>{era.decade}s cinema</strong> — you rate it {era.avg_rating}/10 but have only
            seen {era.count}.
          </li>
        )}
        {country && (
          <li>
            ✦ <strong>{countryName(country.cc)} film</strong> {flag(country.cc)} — a clear favourite
            ({country.count} so far).
          </li>
        )}
        {!era && !country && (
          <li className="text-ink-soft">You&apos;re remarkably well-rounded already.</li>
        )}
      </ul>
    </PaperCard>
  );
}

interface TileProps {
  taste: TasteProfile;
  summary?: ProfileSummary | null;
  tilt?: number;
  delay?: number;
}
