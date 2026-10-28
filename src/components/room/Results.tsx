import { useMemo } from "react";
import { Download, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compareTeams, formatMoney } from "@/lib/auction-rules";
import { RadarChart } from "@/components/auction/RadarChart";
import { TeamDot } from "@/components/auction/TeamPurseBar";
import type { RoomData, Derived } from "@/components/auction/derive";

export function Results({ data, d }: { data: RoomData; d: Derived }) {
  const room = data.room!;
  const ranked = useMemo(
    () => compareTeams(data.participants.map((p) => ({ id: p.id, squad: d.squadOf(p.id), spent: d.spentOf(p.id) })), room.format),
    [data.participants, d, room.format],
  );
  const champ = ranked[0] ? d.partById.get(ranked[0].id) : null;

  const download = () => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 260 + ranked.length * 90;
    const g = c.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    g.fillStyle = css.getPropertyValue("--background") || "black";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = css.getPropertyValue("--primary") || "gold";
    g.font = "bold 64px 'Barlow Condensed', sans-serif";
    g.fillText(`${room.name} · ${room.format}`, 60, 110);
    g.font = "bold 40px 'Barlow Condensed', sans-serif";
    g.fillStyle = css.getPropertyValue("--foreground") || "white";
    g.fillText(`Champion: ${champ?.team_name ?? ""}`, 60, 180);
    ranked.forEach((r, i) => {
      const p = d.partById.get(r.id)!;
      const y = 260 + i * 90;
      g.fillStyle = p.color;
      g.fillRect(60, y - 36, 14, 50);
      g.fillStyle = css.getPropertyValue("--foreground") || "white";
      g.font = "bold 40px 'Barlow Condensed', sans-serif";
      g.fillText(`${i + 1}. ${p.team_name}`, 96, y);
      g.fillText(`${r.score.total}`, 920, y);
    });
    const a = document.createElement("a");
    a.download = `${room.code}-results.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };

  if (!ranked.length) return <p className="text-muted-foreground">No teams.</p>;

  return (
    <div className="space-y-6">
      {champ && (
        <div className="panel relative overflow-hidden p-8 text-center shadow-glow">
          <Trophy className="mx-auto h-14 w-14 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">Champion team</p>
          <h2 className="font-display text-6xl font-extrabold uppercase sm:text-7xl" style={{ color: champ.color }}>{champ.team_name}</h2>
          <p className="mt-1 font-display text-3xl font-bold text-gold">{ranked[0]!.score.total} / 100</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Download results image</Button>
          </div>
        </div>
      )}
      <div className="panel p-4">
        <h3 className="mb-2 text-2xl font-bold uppercase">Team comparison</h3>
        <RadarChart
          series={ranked.map((r) => {
            const p = d.partById.get(r.id)!;
            return { name: p.team_name, color: p.color, values: r.score };
          })}
        />
        <p className="text-xs text-muted-foreground">
          Team Rating = Playing XI 50% · Role balance 20% · Combinations 15% · Bench 10% · Budget efficiency 5%. XIs are picked automatically so every team is judged the same way.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map((r, i) => {
          const p = d.partById.get(r.id)!;
          return (
            <div key={r.id} className="panel p-4">
              <div className="flex items-center gap-2">
                <span className="font-display text-3xl font-extrabold text-muted-foreground">#{i + 1}</span>
                <TeamDot color={p.color} className="h-4 w-4" />
                <h4 className="flex-1 truncate text-2xl font-bold uppercase">{p.team_name}</h4>
                <span className="font-display text-3xl font-extrabold text-gold">{r.score.total}</span>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
                {(["xi", "balance", "combo", "bench", "budget"] as const).map((k) => (
                  <div key={k} className="rounded bg-secondary/50 p-1">
                    <div className="text-muted-foreground uppercase">{k}</div>
                    <div className="font-bold">{r.score[k]}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Spent {formatMoney(d.spentOf(r.id), room.settings.currency)} · Squad {d.squadOf(r.id).length}</p>
              <ol className="mt-2 grid grid-cols-1 gap-0.5 text-sm sm:grid-cols-2">
                {r.score.xiPlayers.map((x, j) => (
                  <li key={x.id} className="truncate"><span className="mr-1 text-muted-foreground tabular">{j + 1}.</span>{x.name} <span className="text-xs text-muted-foreground">{x.rating}</span></li>
                ))}
              </ol>
              {r.score.strengths.length > 0 && <p className="mt-2 text-xs text-success">Strengths: {r.score.strengths.join(", ")}</p>}
              {r.score.weaknesses.length > 0 && <p className="mt-1 text-xs text-destructive">Weaknesses: {r.score.weaknesses.join(", ")}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
