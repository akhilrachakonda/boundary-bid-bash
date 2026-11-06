import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRoomEvaluation } from "@/lib/evaluation.functions";
import type { V3Result } from "@/lib/evaluation-v3";
import type { RoomData, Derived } from "@/components/auction/derive";
import { PlayerProfile } from "@/components/auction/PlayerProfile";
import { PlayerPortrait } from "@/components/auction/PlayerPortrait";
import { PerformanceStrip } from "@/components/auction/PerformanceStrip";

interface Result { version: string; cutoff: string | null; attribution: string; teams: { id: string; rank: number; score: V3Result }[] }
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function ResultsV3({ data, d }: { data: RoomData; d: Derived }) {
  const calculate = useServerFn(getRoomEvaluation);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (!data.room) return;
    calculate({ data: { roomId: data.room.id } }).then((r) => alive && setResult(r as unknown as Result)).catch(() => alive && setError("Team results could not be loaded. Refresh to retry."));
    return () => { alive = false; };
  }, [data.room?.id, calculate]);
  if (error) return <p role="alert">{error}</p>;
  if (!result) return <p>Evaluating frozen evidence…</p>;
  const leaders = result.teams.filter((t) => t.rank === 1 && t.score.eligible);
  return (
    <div className="space-y-5">
      <section className="border-y py-6">
        <p className="text-xs uppercase text-electric">V3 descriptive XI comparison · cutoff {result.cutoff ?? "unavailable"} · frozen snapshot</p>
        <h2 className="mt-2 text-4xl font-bold uppercase">{leaders.length ? leaders.map((t) => d.partById.get(t.id)?.team_name).join(" + ") : "No valid XI"}</h2>
        <p className="text-sm text-muted-foreground">Ordered by combined batting and bowling strength (50/50). This describes each XI from covered match data; it is not a prediction or win probability. No leadership or bench points.</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {result.teams.map((t) => (
          <article key={t.id} className="border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-2xl font-bold">#{t.rank} {d.partById.get(t.id)?.team_name}</h3>
              <strong className="font-display text-3xl text-gold">{t.score.combined.toFixed(1)}</strong>
            </div>
            <p className="text-xs text-muted-foreground">{t.score.eligible ? "Valid XI" : "INELIGIBLE"} · {t.score.source === "submitted" ? "submitted lineup" : "automatic lineup"} · data coverage {pct(t.score.confidence)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Batting strength</dt><dd className="text-lg font-bold">{t.score.batting.toFixed(1)}</dd><dd className="text-muted-foreground">measured {pct(t.score.battingCoverage)}</dd></div>
              <div><dt className="text-muted-foreground">Bowling strength</dt><dd className="text-lg font-bold">{t.score.bowling.toFixed(1)}</dd><dd className="text-muted-foreground">measured {pct(t.score.bowlingCoverage)}</dd></div>
              <div><dt className="text-muted-foreground">Overs covered</dt><dd className="text-lg font-bold">{t.score.oversCovered}/{t.score.oversRequired}</dd></div>
              <div><dt className="text-muted-foreground">Recent form</dt><dd className="text-lg font-bold">{t.score.recentForm?.toFixed(1) ?? "—"}</dd><dd className="text-muted-foreground">shown, not scored</dd></div>
            </dl>
            {(t.score.reasons.length > 0 || t.score.weaknesses.length > 0) && <p className="mt-2 text-sm text-destructive">{[...t.score.reasons, ...t.score.weaknesses].join("; ")}</p>}
            <h4 className="mt-4 text-lg">Evaluated XI</h4>
            <ol>
              {t.score.contributions.map((c) => {
                const p = d.playerById.get(c.id);
                if (!p) return null;
                return (
                  <li key={c.id} className="border-b py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 tabular">{c.slot}</span>
                      <PlayerProfile player={p}><div className="flex items-center gap-2"><PlayerPortrait player={p} className="h-10 w-8 rounded" />{p.name}</div></PlayerProfile>
                      <span className="ml-auto text-xs text-muted-foreground">{c.overs ? `${c.overs} overs` : ""}</span>
                    </div>
                    <PerformanceStrip player={p} compact className="mt-1 pl-7" />
                    {c.note && <p className="pl-7 text-[11px] text-muted-foreground">{c.note}</p>}
                  </li>
                );
              })}
            </ol>
            {t.score.bench.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Bench (not scored): {t.score.bench.map((id) => d.playerById.get(id)?.name).join(", ")}</p>}
          </article>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{result.attribution}. Batting strength: slot-weighted batting scores of the top order. Bowling strength: overs-weighted bowling scores with realistic per-bowler limits. Players with insufficient data add nothing and lower coverage.</p>
    </div>
  );
}
