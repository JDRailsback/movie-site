"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Recs", href: (id: string) => `/p/${id}/recs` },
  { label: "Taste", href: (id: string) => `/p/${id}/taste` },
  { label: "Settings", href: (id: string) => `/p/${id}/settings` },
];

export function Navbar({ profileId }: { profileId: string }) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-30 grid items-center px-8"
      style={{
        gridTemplateColumns: "1fr auto 1fr",
        height: 56,
        background: "rgba(10,10,10,0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo — left */}
      <div>
        <Link
          href="/"
          className="font-display italic text-lg font-light transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Recs
        </Link>
      </div>

      {/* Nav links — center */}
      <nav className="flex items-center gap-0.5">
        {NAV.map(({ label, href }) => {
          const target = href(profileId);
          const active = pathname === target;
          return (
            <Link
              key={label}
              href={target}
              className="rounded-full px-4 py-1.5 text-sm transition-all duration-150"
              style={{
                color: active ? "#fff" : "rgba(255,255,255,0.35)",
                background: active ? "rgba(255,255,255,0.09)" : "transparent",
                fontWeight: active ? 500 : 400,
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Import button — right */}
      <div className="flex justify-end">
        <Link
          href="/"
          className="rounded-full px-4 py-1.5 text-sm font-medium transition-opacity hover:opacity-85"
          style={{
            background: "#fff",
            color: "#0a0a0a",
            letterSpacing: "-0.01em",
          }}
        >
          + Import
        </Link>
      </div>
    </header>
  );
}
