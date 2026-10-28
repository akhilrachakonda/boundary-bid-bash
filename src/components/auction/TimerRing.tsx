import { cn } from "@/lib/utils";

export function TimerRing({ remainingMs, totalMs, paused }: { remainingMs: number; totalMs: number; paused?: boolean }) {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const frac = Math.max(0, Math.min(1, remainingMs / Math.max(totalMs, 1)));
  const r = 44;
  const c = 2 * Math.PI * r;
  const danger = secs <= 5 && !paused;
  return (
    <div className="timer-ring relative h-24 w-24 shrink-0" role="timer" aria-label={paused ? "Auction paused" : `${secs} seconds remaining`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} className="fill-none stroke-secondary" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className={cn("fill-none transition-[stroke-dashoffset] duration-100", danger ? "stroke-destructive" : "stroke-electric")}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn("font-display text-3xl font-bold tabular", danger && "text-destructive")}>
          {paused ? "II" : secs}
        </span>
      </div>
    </div>
  );
}
