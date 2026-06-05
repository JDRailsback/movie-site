"use client";

import { GenreBubbles } from "@/components/taste/GenreBubbles";
import { BrutalCard, BrutalTitle } from "@/components/ui/BrutalCard";
import { Sparkle, Star } from "@/components/ui/Doodads";
import type { TasteProfile } from "@/lib/api";
import { countryName, flag } from "@/lib/countries";
import { HEX, pastelFor } from "@/lib/pastels";
import { motion } from "framer-motion";

interface TileProps {
  taste: TasteProfile;
  tilt?: number;
  delay?: number;
}

// ---------- Genre bubble cloud ----------
export function GenreTile({ taste, tilt, delay }: TileProps) {
  return (
    <BrutalCard bg="peach" pattern="dots" tilt={tilt} delay={delay}>
      <Star className="absolute -right-3 -top-3 animate-spin-slow text-4xl drop-shadow" />
      <BrutalTitle hint="Bigger = you love it more.">Genre galaxy</BrutalTitle>
      <GenreBubbles genres={taste.genreAffinity} />
    </BrutalCard>
  );
}

// ---------- Directors as a film strip ----------
export function DirectorsTile({ taste, tilt, delay }: TileProps) {
  const directors = Object.values(taste.directorAffinity)
    .filter((d) => d.affinity > 0)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 6);

  return (
    <motion.div
      initial={{ y: 22, opacity: 0, rotate: tilt ?? 0 }}
      whileInView={{ y: 0, opacity: 1, rotate: tilt ?? 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 130, damping: 14, delay }}
      whileHover={{ rotate: 0, y: -3 }}
      className="brutal overflow-hidden rounded-[1.4rem] bg-lilac"
    >
      <h2 className="border-b-[3px] border-ink bg-lilac px-4 py-2 font-display text-xl font-black uppercase text-ink">
        Directors you adore
      </h2>
      <div className="flex">
        <Sprockets />
        <ul className="flex-1 space-y-2 py-3">
          {directors.length ? (
            directors.map((d, i) => (
              <motion.li
                key={d.name}
                initial={{ x: -14, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: (delay ?? 0) + i * 0.07 }}
                className="brutal-sm flex items-center gap-2 rounded-lg bg-paper px-2 py-1.5"
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-black text-ink"
                  style={{ background: HEX[pastelFor(d.name)].fill }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm font-bold text-ink">{d.name}</span>
                <span className="text-[11px] font-black text-ink/50">{d.count}</span>
              </motion.li>
            ))
          ) : (
            <li className="px-3 text-sm text-ink/70">Not enough repeat directors yet.</li>
          )}
        </ul>
        <Sprockets />
      </div>
    </motion.div>
  );
}

const SPROCKETS = ["a", "b", "c", "d", "e", "f"];
function Sprockets() {
  return (
    <div className="flex w-6 flex-col items-center justify-around bg-ink/85 py-3">
      {SPROCKETS.map((k) => (
        <span key={k} className="h-3 w-3 rounded-[3px] bg-paper" />
      ))}
    </div>
  );
}

// ---------- Decades: colourful outlined bubbles ----------
function decadeColor(a: number): string {
  if (a >= 0.3) return HEX.coral.fill;
  if (a >= 0.12) return HEX.peach.fill;
  if (a >= -0.05) return HEX.butter.fill;
  if (a >= -0.2) return HEX.mint.fill;
  return HEX.sky.fill;
}

export function DecadeTile({ taste, tilt, delay }: TileProps) {
  const decades = Object.entries(taste.eraAffinity)
    .map(([d, v]) => ({ decade: Number(d), ...v }))
    .sort((a, b) => a.decade - b.decade);
  const maxCount = Math.max(1, ...decades.map((d) => d.count));

  return (
    <BrutalCard bg="sky" pattern="grid" tilt={tilt} delay={delay}>
      <BrutalTitle hint="Size = how many you've seen · warm = you love it, cool = less so.">
        Cinema century
      </BrutalTitle>
      <div className="grid grid-cols-5 place-items-center gap-x-1 gap-y-3 py-2">
        {decades.map((d, i) => {
          const size = 34 + (d.count / maxCount) * 30;
          return (
            <motion.div
              key={d.decade}
              initial={{ scale: 0, y: 10 }}
              whileInView={{ scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 13,
                delay: (delay ?? 0) + i * 0.05,
              }}
              whileHover={{ scale: 1.12, rotate: -4 }}
              className="flex flex-col items-center gap-1"
              title={`${d.count} films · ${d.avg_rating}/10`}
            >
              <span
                className="brutal-sm grid place-items-center rounded-full text-[10px] font-black text-ink"
                style={{ width: size, height: size, background: decadeColor(d.affinity) }}
              >
                {d.count}
              </span>
              <span className="text-[11px] font-black text-ink/70">{`'${String(d.decade).slice(2)}`}</span>
            </motion.div>
          );
        })}
      </div>
    </BrutalCard>
  );
}

// ---------- Countries as postage stamps ----------
export function PassportTile({ taste, tilt, delay }: TileProps) {
  const countries = Object.entries(taste.countryAffinity)
    .map(([cc, v]) => ({ cc, ...v }))
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <BrutalCard bg="mint" pattern="checks" tilt={tilt} delay={delay}>
      <BrutalTitle hint="Stamps from everywhere your cinema's been — ♥ = you rate it highest.">
        Film passport
      </BrutalTitle>
      <div className="flex flex-wrap gap-2.5">
        {countries.map((c, i) => (
          <motion.div
            key={c.cc}
            initial={{ scale: 0, rotate: -10 }}
            whileInView={{ scale: 1, rotate: (i % 3) - 1 }}
            viewport={{ once: true }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 13,
              delay: (delay ?? 0) + i * 0.05,
            }}
            whileHover={{ rotate: 0, scale: 1.08, y: -3 }}
            className="brutal-sm w-[4.7rem] overflow-hidden rounded-[5px] bg-paper text-center"
          >
            <div
              className="border-b-2 border-dashed border-ink/40 py-1.5 text-2xl leading-none"
              style={{ background: HEX[pastelFor(c.cc)].fill }}
            >
              {flag(c.cc)}
            </div>
            <div className="px-1 py-1">
              <div className="text-[11px] font-black leading-tight text-ink">
                {countryName(c.cc)}
              </div>
              <div className="text-[10px] font-bold text-ink/50">
                {c.count}
                {c.affinity > 0.2 ? " ♥" : ""}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </BrutalCard>
  );
}

// ---------- Personality gauge rings ----------
export function PersonalityTile({ taste, tilt, delay }: TileProps) {
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
    <BrutalCard bg="blush" pattern="stripes" tilt={tilt} delay={delay}>
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
  const r = 36;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="brutal-sm relative h-[5.5rem] w-[5.5rem] rounded-full bg-paper">
        <svg aria-hidden="true" viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#EADDC4" strokeWidth="12" />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={HEX[pastel].fill}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c * (1 - f) }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-lg font-black text-ink">
            {value.toFixed(decimals)}
            <span className="text-[9px] font-bold text-ink/60">{unit}</span>
          </span>
        </div>
      </div>
      <span className="text-[11px] font-black uppercase text-ink/70">{label}</span>
    </div>
  );
}

// ---------- Themes as a tag pile ----------
export function ThemesTile({ taste, tilt, delay }: TileProps) {
  const kws = taste.topKeywords.slice(0, 16);
  const maxW = Math.max(...kws.map((k) => k.weight), 0.01);
  return (
    <BrutalCard bg="butter" pattern="dots" shape="blob" tilt={tilt} delay={delay}>
      <Sparkle className="absolute -left-2 -top-3 text-3xl animate-spin-slow" />
      <BrutalTitle hint="The threads running through your favourites — bigger = stronger.">
        Your themes
      </BrutalTitle>
      <div className="flex flex-wrap items-center justify-center gap-2 py-1">
        {kws.map((k, i) => {
          const t = k.weight / maxW;
          const p = pastelFor(k.name);
          let h = 0;
          for (const ch of k.name) h += ch.charCodeAt(0);
          return (
            <motion.span
              key={k.id}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1, rotate: (h % 9) - 4 }}
              viewport={{ once: true }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 15,
                delay: (delay ?? 0) + i * 0.03,
              }}
              whileHover={{ rotate: 0, scale: 1.12 }}
              className="brutal-sm inline-block cursor-default rounded-full px-3 py-1 font-black"
              style={{ background: HEX[p].fill, color: HEX[p].deep, fontSize: 12 + t * 10 }}
            >
              {k.name}
            </motion.span>
          );
        })}
      </div>
    </BrutalCard>
  );
}

// ---------- Blind spot as a pinned sticky-note ----------
export function DiggingTile({ taste, tilt, delay }: TileProps) {
  const era = Object.entries(taste.eraAffinity)
    .map(([d, v]) => ({ decade: Number(d), ...v }))
    .filter((e) => e.affinity > 0.1 && e.count > 0 && e.count <= 20)
    .sort((a, b) => b.avg_rating - a.avg_rating)[0];
  const country = Object.entries(taste.countryAffinity)
    .map(([cc, v]) => ({ cc, ...v }))
    .filter((c) => c.affinity > 0.25 && c.count >= 2 && c.count <= 25)
    .sort((a, b) => b.affinity - a.affinity)[0];

  return (
    <motion.div
      initial={{ y: 22, opacity: 0, rotate: (tilt ?? 0) - 2 }}
      whileInView={{ y: 0, opacity: 1, rotate: (tilt ?? 0) - 2 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 130, damping: 14, delay }}
      whileHover={{ rotate: 0, y: -4 }}
      className="brutal relative bg-coral p-5"
      style={{ borderRadius: "4px 18px 4px 18px" }}
    >
      <span className="absolute -top-3 left-1/2 h-5 w-20 -translate-x-1/2 -rotate-3 border-2 border-ink bg-paper/70" />
      <h2 className="mb-2 font-display text-xl font-black uppercase italic text-ink">
        Worth digging into
      </h2>
      <ul className="space-y-2 text-sm font-semibold text-ink">
        {era && (
          <li>
            <Star className="mr-1 inline align-[-2px] text-base" />
            <strong>{era.decade}s cinema</strong> — you rate it {era.avg_rating}/10 but have only
            seen {era.count}.
          </li>
        )}
        {country && (
          <li>
            <Star className="mr-1 inline align-[-2px] text-base" fill="#C2E6CD" />
            <strong>{countryName(country.cc)} film</strong> {flag(country.cc)} — a clear favourite (
            {country.count} so far).
          </li>
        )}
        {!era && !country && (
          <li className="text-ink/70">You&apos;re remarkably well-rounded already.</li>
        )}
      </ul>
    </motion.div>
  );
}
