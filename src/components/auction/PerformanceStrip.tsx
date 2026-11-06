import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { measureFromBasis, type Measure } from "@/lib/evaluation-v3";
import { useRoomSnapshot } from "./RoomEvidenceContext";
import type { Player } from "@/lib/auction-rules";
import { cn } from "@/lib/utils";

type Scores = { snapshot: string | null; cutoff: string | null; byKey: Map<string, Measure> };
const cache = new Map<string, Promise<Scores>>();

function load(snapshot: string | null | undefined, format: string): Promise<Scores> {
  const key = (snapshot ?? "latest") + "|" + format;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      let sid = snapshot ?? null;
      if (!sid) sid = (await supabase.from("evaluation_snapshots").select("id").eq("status", "validated").order("imported_at", { ascending: false }).limit(1).maybeSingle()).data?.id ?? null;
      if (!sid) return { snapshot: null, cutoff: null, byKey: new Map() };
      const [g, s] = await Promise.all([
        supabase.from("pool_groups").select("identity_key,grp,basis").eq("snapshot_id", sid).eq("format", format).eq("rules_version", "pool-groups-2"),
        supabase.from("evaluation_snapshots").select("cutoff").eq("id", sid).maybeSingle(),
      ]);
      return { snapshot: sid, cutoff: s.data?.cutoff ?? null, byKey: new Map((g.data ?? []).map((r) => [r.identity_key, measureFromBasis(r.grp, r.basis as Record<string, unknown>)])) };
    })().catch((e) => { cache.delete(key); throw e; }));
  }
  return cache.get(key)!;
}

/** Role-relative Cricket Auction performance scores for one format (frozen room snapshot when available). */
export function usePerformanceScores(format: string) {
  const snapshot = useRoomSnapshot();
  const [scores, setScores] = useState<Scores | null>(null);
  useEffect(() => { let alive = true; load(snapshot, format).then((s) => alive && setScores(s)).catch(() => alive && setScores(null)); return () => { alive = false; }; }, [snapshot, format]);
  return scores;
}

const fmt = (v: number | undefined) => (v === undefined ? "—" : Math.round(v).toString());

export function PerformanceStrip({ player, compact = false, className }: { player: Player; compact?: boolean; className?: string }) {
  const scores = usePerformanceScores(player.format);
  if (!scores) return null;
  const m = scores.byKey.get(player.name + "|" + player.country);
  const scope = player.format === "T20" ? "T20I + IPL" : player.format;
  if (!m || m.status !== "measured") {
    return <p className={cn("text-xs text-muted-foreground", className)}>Performance: <strong>insufficient data</strong> in {scope}{m?.raw?.innings ? ` (${m.raw.innings} covered innings)` : ""} · cutoff {scores.cutoff ?? "—"}</p>;
  }
  const ar = m.bat !== undefined && m.bowl !== undefined && player.role === "AR" ? (m.bat + m.bowl) / 2 : undefined;
  const recent = player.role === "BOWL" ? m.recentBowl : player.role === "AR" ? (m.recentBat !== undefined && m.recentBowl !== undefined ? (m.recentBat + m.recentBowl) / 2 : m.recentBat ?? m.recentBowl) : m.recentBat;
  const cells: [string, string][] = [["BAT", fmt(m.bat)], ["BOWL", fmt(m.bowl)]];
  if (player.role === "AR") cells.push(["AR", fmt(ar)]);
  cells.push(["Form", fmt(recent)]);
  const r = m.raw;
  return (
    <div className={cn("space-y-1", className)}>
      <dl className="grid grid-cols-4 gap-1" aria-label="Cricket Auction performance scores">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded border bg-secondary/40 px-1.5 py-1 text-center">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
            <dd className={cn("font-display font-bold tabular", compact ? "text-base" : "text-xl")}>{v}</dd>
          </div>
        ))}
      </dl>
      {!compact && r && (
        <p className="text-[11px] text-muted-foreground">
          {scope}: {r.innings} inns · {r.runs} runs off {r.balls} balls{r.dismissals ? ` · avg ${(r.runs / r.dismissals).toFixed(1)}` : ""}{r.balls ? ` · SR ${((100 * r.runs) / r.balls).toFixed(1)}` : ""}
          {r.legal_balls ? ` · ${r.wickets} wkts in ${r.legal_balls} balls · econ ${((6 * r.conceded) / r.legal_balls).toFixed(2)}` : ""} · cutoff {scores.cutoff ?? "—"}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">Cricket Auction performance scores: percentile among this app's {scope} players with enough covered matches (Cricsheet). Not official ratings.</p>
    </div>
  );
}
