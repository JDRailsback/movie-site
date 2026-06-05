// An infinite horizontal scrolling banner (ink bar, cream chunky type).
export function Marquee({ items }: { items: string[] }) {
  return (
    <div className="relative overflow-hidden border-y-[3px] border-ink bg-ink py-2">
      <div className="flex w-max animate-marquee gap-6 whitespace-nowrap">
        {["copy-a", "copy-b"].map((copy) =>
          items.map((t) => (
            <span
              key={`${copy}-${t}`}
              className="font-display text-sm font-black uppercase tracking-wider text-paper"
            >
              {t} <span className="text-coral">✦</span>
            </span>
          )),
        )}
      </div>
    </div>
  );
}
