import { FACTORS, FACTOR_NAME, type DiscLetter } from "@/data/discWords";

const COLOR: Record<DiscLetter, string> = {
  D: "#C1442A",
  I: "#C8901A",
  S: "#3E7D56",
  C: "#2E5F8A",
};

export function DiscBarChart({ scores, compact = false }: { scores: Record<DiscLetter, number>; compact?: boolean }) {
  const order = FACTORS.slice().sort((a, b) => scores[b] - scores[a]);
  return (
    <div className="flex flex-col gap-2.5">
      {order.map((f) => (
        <div key={f} className={compact ? "grid grid-cols-[28px_1fr_38px] items-center gap-2" : "grid grid-cols-[110px_1fr_46px] items-center gap-3"}>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COLOR[f] }} />
            {!compact && (
              <span className="font-semibold">
                {f} <span className="font-normal text-[var(--ink-muted)]">{FACTOR_NAME[f]}</span>
              </span>
            )}
            {compact && <span className="font-semibold">{f}</span>}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${scores[f]}%`, background: COLOR[f] }} />
          </div>
          <div className="text-right font-mono text-sm tabular-nums text-[var(--ink-muted)]">{scores[f]}%</div>
        </div>
      ))}
    </div>
  );
}
