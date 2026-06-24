"use client";

import { useMemo } from "react";

const VW = 1400;
const VH = 280;
const FRAME = 52;
const BR = 9;    // bulb radius
const BS = 30;   // bulb spacing

function seed(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Bulb { x: number; y: number; k: number }

function row(y: number, xStart: number, xEnd: number, kStart: number): Bulb[] {
  const out: Bulb[] = [];
  for (let x = xStart; x <= xEnd; x += BS) {
    out.push({ x, y, k: kStart + out.length });
  }
  return out;
}

function col(x: number, yStart: number, yEnd: number, kStart: number): Bulb[] {
  const out: Bulb[] = [];
  for (let y = yStart; y <= yEnd; y += BS) {
    out.push({ x, y, k: kStart + out.length });
  }
  return out;
}

export function MarqueeBanner() {
  const bulbs = useMemo<Bulb[]>(() => {
    const xMin = 16, xMax = VW - 16;
    const yMin = 16, yMax = VH - 16;
    const t1 = row(16, xMin, xMax, 0);
    const t2 = row(36, xMin + BS / 2, xMax - BS / 2, t1.length);
    const b1 = row(VH - 16, xMin, xMax, t1.length + t2.length);
    const b2 = row(VH - 36, xMin + BS / 2, xMax - BS / 2, t1.length + t2.length + b1.length);
    const l = col(26, 56, VH - 56, t1.length + t2.length + b1.length + b2.length);
    const r = col(VW - 26, 56, VH - 56, t1.length + t2.length + b1.length + b2.length + l.length);
    return [...t1, ...t2, ...b1, ...b2, ...l, ...r];
  }, []);

  const ix = FRAME, iy = FRAME;
  const iw = VW - FRAME * 2, ih = VH - FRAME * 2;

  return (
    <>
      <style>{`
        @keyframes bl { from { opacity: 1; } to { opacity: 0.08; } }
      `}</style>
      <div
        style={{
          padding: "32px 0",
          filter: "drop-shadow(0 0 48px rgba(180,70,0,0.45)) drop-shadow(0 0 96px rgba(120,40,0,0.25))",
        }}
      >
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          style={{ display: "block" }}
          aria-label="Watch Next marquee sign"
        >
          <defs>
            {/* Interior grid pattern */}
            <pattern id="mgrid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="rgba(140,100,40,0.12)" strokeWidth="0.8" />
            </pattern>
            {/* Bulb glow filter */}
            <filter id="bglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Frame — three layers for depth */}
          <rect x={0} y={0} width={VW} height={VH} rx={5} fill="#2e0800" />
          <rect x={4} y={4} width={VW-8} height={VH-8} rx={4} fill="#7a1a00" />
          <rect x={8} y={8} width={VW-16} height={VH-16} rx={3} fill="#a82800" />
          <rect x={12} y={12} width={VW-24} height={VH-24} rx={2} fill="#c43800" />

          {/* Inner frame edge (bright highlight) */}
          <rect x={ix-4} y={iy-4} width={iw+8} height={ih+8} rx={2} fill="#d84000" />

          {/* Cream interior */}
          <rect x={ix} y={iy} width={iw} height={ih} fill="#f0e6c0" />
          <rect x={ix} y={iy} width={iw} height={ih} fill="url(#mgrid)" />

          {/* Text */}
          <text
            x={VW / 2}
            y={VH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontFamily: "var(--font-display), serif", fontSize: 92 }}
            fill="#1a0800"
            letterSpacing={6}
          >
            WATCH NEXT
          </text>

          {/* Bulb sockets */}
          {bulbs.map((b) => (
            <circle key={`s${b.k}`} cx={b.x} cy={b.y} r={BR + 3} fill="#1e0600" />
          ))}

          {/* Animated bulbs */}
          {bulbs.map((b) => {
            const delay = seed(b.k * 7.3) * 3;
            const dur = 0.6 + seed(b.k * 3.1 + 99) * 1.1;
            return (
              <circle
                key={`b${b.k}`}
                cx={b.x}
                cy={b.y}
                r={BR}
                fill="#ffe8a0"
                filter="url(#bglow)"
                style={{
                  animationName: "bl",
                  animationDuration: `${dur}s`,
                  animationDelay: `${delay}s`,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDirection: "alternate",
                }}
                suppressHydrationWarning
              />
            );
          })}
        </svg>
      </div>
    </>
  );
}
