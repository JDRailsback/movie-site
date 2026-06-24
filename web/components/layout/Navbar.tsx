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
        background: "rgba(28,17,8,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(196,154,60,0.15)",
      }}
    >
      {/* Logo — left */}
      <div>
        <Link
          href="/"
          className="font-display text-lg transition-colors"
          style={{ color: "rgba(240,210,150,0.4)" }}
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
                color: active ? "#e8c870" : "rgba(240,210,150,0.4)",
                background: active ? "rgba(196,154,60,0.14)" : "transparent",
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
            background: "#c9a84c",
            color: "#1c1108",
            letterSpacing: "-0.01em",
          }}
        >
          + Import
        </Link>
      </div>
    </header>
  );
}
