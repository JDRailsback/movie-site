"use client";

import { useFilter } from "@/components/taste/FilterContext";
import { GenreBubbles } from "@/components/taste/GenreBubbles";
import { BrutalCard, BrutalTitle } from "@/components/ui/BrutalCard";
import type { TasteProfile } from "@/lib/api";
import { countryName, flag } from "@/lib/countries";
import { HEX, pastelFor } from "@/lib/pastels";
import { motion } from "framer-motion";

interface TileProps {
  taste: TasteProfile;
  delay?: number;
}

const SELECTED_RING = "0 0 0 2px #3B322C";

// ---------- Genre bubbles ----------
export function GenreTile({ taste, delay }: TileProps) {
  return (
    <BrutalCard bg="peach" delay={delay}>
      <BrutalTitle hint="Bigger = you love it more.">Genre galaxy</BrutalTitle>
      <GenreBubbles genres={taste.genreAffinity} />
    </BrutalCard>
  );
}

// ---------- Directors ----------
export function DirectorsTile({ taste, delay }: TileProps) {
  const { isActive, selection, toggle, top } = useFilter();
  const directors: { name: string; count: number }[] = isActive
    ? top("director", 6).map(([name, count]) => ({ name, count }))
    : Object.values(taste.directorAffinity)
        .filter((d) => d.affinity > 0)
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 6)
        .map((d) => ({ name: d.name, count: d.count }));

  return (
    <BrutalCard bg="lilac" delay={delay}>
      <BrutalTitle hint="Filmmakers you rate above your average.">
        {isActive ? "Directors here" : "Directors you adore"}
      </BrutalTitle>
      <ul className="min-h-[17rem] space-y-1.5">
        {directors.length ? (
          directors.map((d, i) => {
            const isSel = selection?.dim === "director" && selection.value === d.name;
            return (
              <li key={d.name}>
                <button
                  type="button"
                  onClick={() => toggle("director", d.name)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/5 ${isSel ? "bg-ink/5" : ""}`}
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-ink"
                    style={{ backgroundColor: `${HEX[pastelFor(d.name)].fill}55` }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-ink">{d.name}</span>
                  <span className="text-xs text-ink/40">{d.count}</span>
                </button>
              </li>
            );
          })
        ) : (
          <li className="px-2 text-sm text-ink/50">No directors in this slice.</li>
        )}
      </ul>
    </BrutalCard>
  );
}

// ---------- Decades ----------
function decadeColor(a: number): string {
  if (a >= 0.3) return HEX.coral.fill;
  if (a >= 0.12) return HEX.peach.fill;
  if (a >= -0.05) return HEX.butter.fill;
  if (a >= -0.2) return HEX.mint.fill;
  return HEX.sky.fill;
}

export function DecadeTile({ taste, delay }: TileProps) {
  const { isActive, selection, toggle, countOf } = useFilter();
  const decades = Object.entries(taste.eraAffinity)
    .map(([d, v]) => ({ decade: Number(d), ...v }))
    .sort((a, b) => a.decade - b.decade);
  const maxCount = Math.max(1, ...decades.map((d) => d.count));

  return (
    <BrutalCard bg="sky" delay={delay}>
      <BrutalTitle hint="Size = how many you've seen · warm = you love it.">
        Cinema century
      </BrutalTitle>
      <div className="grid grid-cols-5 place-items-center gap-x-1 gap-y-3 py-1">
        {decades.map((d) => {
          const size = 32 + (d.count / maxCount) * 28;
          const sliceCount = countOf("decade", String(d.decade));
          const dimmed = isActive && sliceCount === 0;
          const isSel = selection?.dim === "decade" && selection.value === String(d.decade);
          return (
            <button
              type="button"
              key={d.decade}
              onClick={() => toggle("decade", String(d.decade))}
              className="flex flex-col items-center gap-1 transition hover:scale-105"
              style={{ opacity: dimmed ? 0.35 : 1 }}
              title={`${d.count} films · ${d.avg_rating}/10`}
            >
              <span
                className="grid place-items-center rounded-full text-[10px] font-semibold text-ink/80"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: decadeColor(d.affinity),
                  boxShadow: isSel ? SELECTED_RING : undefined,
                }}
              >
                {isActive ? sliceCount : d.count}
              </span>
              <span className="text-[11px] text-ink/50">{`'${String(d.decade).slice(2)}`}</span>
            </button>
          );
        })}
      </div>
    </BrutalCard>
  );
}

// ---------- Countries ----------
export function PassportTile({ taste, delay }: TileProps) {
  const { isActive, selection, toggle, countOf } = useFilter();
  const countries = Object.entries(taste.countryAffinity)
    .map(([cc, v]) => ({ cc, ...v }))
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <BrutalCard bg="mint" delay={delay}>
      <BrutalTitle hint="Where your cinema comes from — ♥ = you rate it highest.">
        Film passport
      </BrutalTitle>
      <div className="flex flex-wrap gap-2">
        {countries.map((c) => {
          const sliceCount = countOf("country", c.cc);
          const dimmed = isActive && sliceCount === 0;
          const isSel = selection?.dim === "country" && selection.value === c.cc;
          return (
            <button
              type="button"
              key={c.cc}
              onClick={() => toggle("country", c.cc)}
              className="flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-sm transition hover:scale-105"
              style={{
                opacity: dimmed ? 0.35 : 1,
                boxShadow: isSel ? SELECTED_RING : "0 1px 2px rgba(59,50,44,0.06)",
              }}
            >
              <span className="text-base leading-none">{flag(c.cc)}</span>
              <span className="font-medium text-ink">{countryName(c.cc)}</span>
              <span className="text-xs text-ink/40">
                {isActive ? sliceCount : c.count}
                {!isActive && c.affinity > 0.2 ? " ♥" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </BrutalCard>
  );
}

// ---------- Personality ----------
export function PersonalityTile({ taste, delay }: TileProps) {
  const { isActive, filtered, totalFilms } = useFilter();

  if (isActive) {
    const rated = filtered.filter((f) => f.rating != null);
    const avgRating = rated.length
      ? rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length
      : 0;
    const withRt = filtered.filter((f) => f.runtimeMin);
    const avgRt = withRt.length
      ? withRt.reduce((s, f) => s + (f.runtimeMin ?? 0), 0) / withRt.length
      : 0;
    return (
      <BrutalCard bg="blush" delay={delay}>
        <BrutalTitle>This slice</BrutalTitle>
        <div className="flex items-start justify-around gap-2">
          <Ring value={filtered.length} max={totalFilms} unit="" label="films" pastel="peach" />
          <Ring
            value={avgRating}
            max={10}
            unit="/10"
            label="you rate"
            pastel="butter"
            decimals={1}
          />
          <Ring value={avgRt} max={200} unit="m" label="avg length" pastel="mint" />
        </div>
      </BrutalCard>
    );
  }

  const rt = taste.runtimePref?.pref_min ?? null;
  const runtimeLabel =
    rt == null
      ? ""
      : rt < 95
        ? "tight & punchy"
        : rt < 125
          ? "feature-length"
          : rt < 150
            ? "room to breathe"
            : "epic-leaning";
  const ratingLabel =
    taste.mu >= 7.2 ? "generous" : taste.mu <= 5.8 ? "tough crowd" : "even-handed";

  return (
    <BrutalCard bg="blush" delay={delay}>
      <BrutalTitle>Viewing personality</BrutalTitle>
      <div className="flex items-start justify-around gap-2">
        <Ring value={rt ?? 0} max={200} unit="m" label={runtimeLabel} pastel="peach" />
        <Ring
          value={taste.mu}
          max={10}
          unit="/10"
          label={ratingLabel}
          pastel="butter"
          decimals={1}
        />
        <Ring
          value={taste.sigma}
          max={4}
          unit="σ"
          label={taste.sigma >= 2.2 ? "eclectic" : taste.sigma <= 1.3 ? "consistent" : "decisive"}
          pastel="mint"
          decimals={1}
        />
      </div>
    </BrutalCard>
  );
}

function Ring({
  value,
  max,
  unit,
  label,
  pastel,
  decimals = 0,
}: {
  value: number;
  max: number;
  unit: string;
  label: string;
  pastel: "peach" | "butter" | "mint";
  decimals?: number;
}) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-20 w-20">
        <svg aria-hidden="true" viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(59,50,44,0.08)" strokeWidth="9" />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={HEX[pastel].fill}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c * (1 - f) }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-base font-semibold text-ink">
            {value.toFixed(decimals)}
            <span className="text-[9px] text-ink/50">{unit}</span>
          </span>
        </div>
      </div>
      <span className="text-xs text-ink/55">{label}</span>
    </div>
  );
}

// ---------- Themes ----------
export function ThemesTile({ taste, delay }: TileProps) {
  const { isActive, selection, toggle, countOf } = useFilter();
  const kws = taste.topKeywords.slice(0, 16);
  const maxW = Math.max(...kws.map((k) => k.weight), 0.01);
  return (
    <BrutalCard bg="butter" delay={delay}>
      <BrutalTitle hint="The threads running through your favourites.">Your themes</BrutalTitle>
      <div className="flex flex-wrap gap-2">
        {kws.map((k) => {
          const t = k.weight / maxW;
          const p = pastelFor(k.name);
          const dimmed = isActive && countOf("theme", k.name) === 0;
          const isSel = selection?.dim === "theme" && selection.value === k.name;
          return (
            <button
              type="button"
              key={k.id}
              onClick={() => toggle("theme", k.name)}
              className="rounded-full px-3 py-1 font-medium transition hover:scale-105"
              style={{
                backgroundColor: `${HEX[p].fill}40`,
                color: HEX[p].deep,
                fontSize: 12 + t * 6,
                opacity: dimmed ? 0.35 : 1,
                boxShadow: isSel ? SELECTED_RING : undefined,
              }}
            >
              {k.name}
            </button>
          );
        })}
      </div>
    </BrutalCard>
  );
}
