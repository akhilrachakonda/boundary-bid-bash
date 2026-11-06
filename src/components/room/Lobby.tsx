import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Crown, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { generateBalancedPool, poolRequirements, squadCounts, type Player, type Settings } from "@/lib/auction-rules";
import { SettingsForm } from "@/components/SettingsForm";
import { ColorPicker } from "@/components/TeamPicker";
import { PlayerTable } from "@/components/auction/PlayerTable";
import { TeamDot } from "@/components/auction/TeamPurseBar";
import type { RoomData, Derived } from "@/components/auction/derive";
import { rpc } from "./rpc";
import { POOL_RULES, ratioCounts, type PoolGeneration } from "@/lib/pool-ratio";

export function Lobby({ data, d, now }: { data: RoomData; d: Derived; now: number }) {
  const room = data.room!;
  const s = room.settings;
  const me = d.me!;
  const [team, setTeam] = useState(me.team_name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Settings>(s);
  const [all, setAll] = useState<Player[]>([]);
  const [seed, setSeed] = useState(1);
  const [preview, setPreview] = useState<ReturnType<typeof generateBalancedPool> | null>(null);

  useEffect(() => setDraft(s), [s]);
  useEffect(() => {
    if (!d.isHost) return;
    supabase.from("players").select("*").eq("format", room.format).then(({ data }) => setAll((data ?? []) as Player[]));
  }, [d.isHost, room.format]);

  const link = typeof window !== "undefined" ? `${window.location.origin}/join?code=${room.code}` : "";
  const share = async () => {
    if (navigator.share) await navigator.share({ title: room.name, text: `Join my cricket auction — code ${room.code}`, url: link }).catch(() => {});
    else {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    }
  };
  const taken = data.participants.filter((p) => p.id !== me.id).map((p) => p.color);
  const req = poolRequirements(s);
  const poolCounts = squadCounts(data.pool.map((r) => r.player));
  const enoughTeams = data.participants.length >= 2;
  const poolReady = data.pool.length > 0;

  const ratioRoom = (room as { pool_rules?: string | null }).pool_rules === POOL_RULES;
  const generation = (room as { pool_generation?: PoolGeneration | null }).pool_generation ?? null;
  const [generating, setGenerating] = useState(false);
  const generateServer = async () => {
    if (s.pool_size === "all") { toast.error("Choose a numeric pool size: random 80/20 pools need an exact size."); return; }
    setGenerating(true);
    const res = await rpc<PoolGeneration>("generate_pool", { p_room: room.id, p_size: s.pool_size });
    setGenerating(false);
    if (res) toast.success(`Pool saved: ${res.established} established + ${res.emerging} emerging`);
  };
  const gen = (sd: number) => {
    setSeed(sd);
    setPreview(generateBalancedPool(all, s, sd));
  };
  const previewRows = useMemo(() => (preview ? preview.players.map((p) => ({ player: p })) : []), [preview]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <p className="border-l-2 border-electric px-3 py-2 text-sm">Surprise player reveal: <strong>{s.surprise_reveal ? "ON — future order hidden from everyone" : "OFF — upcoming players visible"}</strong>. The confirmed scouting pool is unchanged.</p>
        <div className="panel flex flex-wrap items-center gap-4 p-5">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Room code</p>
            <p className="font-display text-5xl font-extrabold tracking-[0.25em] text-gold">{room.code}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(room.code); toast.success("Code copied"); }}><Copy className="h-4 w-4" /> Code</Button>
            <Button onClick={share}><Share2 className="h-4 w-4" /> Invite link</Button>
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="mb-3 text-2xl font-bold uppercase">Teams {data.participants.length}/{s.max_teams}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.participants.map((p) => {
              const online = now - new Date(p.last_seen).getTime() < 30000;
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
                  <TeamDot color={p.color} className="h-5 w-5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate font-semibold">
                      {p.team_name}
                      {p.user_id === room.host_id && <Crown className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.nickname} · {online ? "online" : "away"}</div>
                  </div>
                  {p.is_ready ? <span className="flex items-center gap-1 text-xs font-bold text-success"><Check className="h-4 w-4" /> Ready</span> : <span className="text-xs text-muted-foreground">Not ready</span>}
                  {d.isHost && p.id !== me.id && (
                    <Button size="sm" variant="ghost" onClick={() => confirm(`Make ${p.team_name} the host?`) && rpc("transfer_host", { p_room: room.id, p_participant: p.id })}>Make host</Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {d.isHost && (
          <div className="panel space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold uppercase">Room settings · {room.format}</h3>
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit"}</Button>
            </div>
            {editing ? (
              <>
                <SettingsForm s={draft} onChange={setDraft} available={all.length} />
                <Button onClick={async () => { if (await rpc("update_room_settings", { p_room: room.id, p_settings: draft })) { toast.success("Settings saved"); setEditing(false); setPreview(null); } }}>Save settings</Button>
              </>
            ) : (
              <SettingsSummary s={s} />
            )}
          </div>
        )}
        {!d.isHost && (
          <div className="panel p-5">
            <h3 className="mb-2 text-2xl font-bold uppercase">Rules · {room.format}</h3>
            <SettingsSummary s={s} />
          </div>
        )}

        {d.isHost && (
          <div className="panel space-y-3 p-5">
            {ratioRoom ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="mr-auto text-2xl font-bold uppercase">Player pool</h3>
                  <Button variant="outline" onClick={generateServer} disabled={generating}>
                    <RefreshCw className="h-4 w-4" /> {generating ? "Generating…" : poolReady ? "Regenerate random pool" : "Generate random pool"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.pool_size === "all" ? "Set a numeric pool size first." : `${s.pool_size} players = ${ratioCounts(s.pool_size).established} established + ${ratioCounts(s.pool_size).emerging} emerging, drawn at random.`} Needs at least {req.total} players · WK {req.WK} · BAT {req.BAT} · AR {req.AR} · BOWL {req.BOWL} · spin {req.spin} · pace {req.pace}
                </p>
                <PoolMixExplainer />
                {poolReady && generation ? (
                  <p className="text-sm text-success">Pool saved: {generation.size} players — {generation.established} established + {generation.emerging} emerging (WK {poolCounts.WK}, BAT {poolCounts.BAT}, AR {poolCounts.AR}, BOWL {poolCounts.BOWL}). Available for {room.format}: {generation.capacity.established} established, {generation.capacity.emerging} emerging.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Generate a pool; it is saved straight away and stays fixed on refresh or reconnect until you regenerate it.</p>
                )}
              </>
            ) : (<>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="mr-auto text-2xl font-bold uppercase">Player pool</h3>
              <Button variant="outline" onClick={() => gen(Math.floor(Math.random() * 1e9))} disabled={!all.length}>
                <RefreshCw className="h-4 w-4" /> {preview ? "Regenerate" : "Generate balanced pool"}
              </Button>
              {preview && (
                <Button
                  disabled={!preview.feasible}
                  onClick={async () => {
                    const n = await rpc<number>("set_pool", { p_room: room.id, p_player_ids: preview.players.map((p) => p.id) });
                    if (n) { toast.success(`Pool locked in: ${n} players`); setPreview(null); }
                  }}
                >
                  Confirm pool
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Needs at least {req.total} players · WK {req.WK} · BAT {req.BAT} · AR {req.AR} · BOWL {req.BOWL} · spin {req.spin} · pace {req.pace}
            </p>
            {preview ? (
              <>
                {preview.notes.map((n) => <p key={n} className="rounded-md border border-primary/40 bg-primary/10 p-2 text-sm text-primary">{n}</p>)}
                <PoolSummary players={preview.players} />
                <p className="text-xs text-muted-foreground">Preview (seed {seed}) — not saved until you confirm.</p>
                <PlayerTable rows={previewRows} currency={s.currency} />
              </>
            ) : poolReady ? (
              <p className="text-sm text-success">Pool confirmed: {data.pool.length} players (WK {poolCounts.WK}, BAT {poolCounts.BAT}, AR {poolCounts.AR}, BOWL {poolCounts.BOWL}).</p>
            ) : (
              <p className="text-sm text-muted-foreground">Generate a pool to preview it.</p>
            )}
            </>)}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="panel space-y-3 p-5">
          <h3 className="text-xl font-bold uppercase">Your team</h3>
          <Input value={team} onChange={(e) => setTeam(e.target.value)} onBlur={() => team !== me.team_name && rpc("update_my_team", { p_room: room.id, p_team: team, p_color: null, p_ready: null })} maxLength={30} />
          <ColorPicker value={me.color} taken={taken} onChange={(c) => rpc("update_my_team", { p_room: room.id, p_team: null, p_color: c, p_ready: null })} />
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="font-semibold">I'm ready</span>
            <Switch checked={me.is_ready} onCheckedChange={(v) => rpc("update_my_team", { p_room: room.id, p_team: null, p_color: null, p_ready: v })} />
          </label>
        </div>
        {d.isHost ? (
          <div className="panel space-y-2 p-5">
            <Button
              className="h-14 w-full bg-gold text-lg font-bold text-primary-foreground shadow-glow"
              disabled={!enoughTeams || !poolReady}
              onClick={() => rpc("start_review", { p_room: room.id })}
            >
              Start auction
            </Button>
            {!enoughTeams && <p className="text-xs text-muted-foreground">Waiting for at least 2 teams.</p>}
            {!poolReady && <p className="text-xs text-muted-foreground">Confirm the player pool first.</p>}
            {enoughTeams && data.participants.some((p) => !p.is_ready) && <p className="text-xs text-muted-foreground">Some teams aren't ready yet.</p>}
          </div>
        ) : (
          <div className="panel p-5 text-sm text-muted-foreground">Waiting for the host to start. {poolReady ? `Pool of ${data.pool.length} players is set.` : "The host is building the player pool."}</div>
        )}
      </aside>
    </div>
  );
}

function SettingsSummary({ s }: { s: Settings }) {
  const items = [
    ["Purse", `${s.purse} Cr`],
    ["Squad", `${s.min_squad}-${s.max_squad}`],
    ["Overseas max", s.max_overseas],
    ["Min WK/BAT/AR/BOWL", `${s.min_wk}/${s.min_bat}/${s.min_ar}/${s.min_bowl}`],
    ["Min spin/pace", `${s.min_spinners}/${s.min_pacers}`],
    ["Pool", s.pool_size === "all" ? "All" : s.pool_size],
    ["Timer", `${s.bid_timer}s (+${s.bid_reset}s on bid)`],
    ["Increments", s.increments.map((i) => `+${i.step}${i.upto != null ? ` ≤${i.upto}` : "+"}`).join(", ")],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k as string} className="rounded-md bg-secondary/40 p-2">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PoolSummary({ players }: { players: Player[] }) {
  const by = (f: (p: Player) => string) => {
    const m = new Map<string, number>();
    players.forEach((p) => m.set(f(p), (m.get(f(p)) ?? 0) + 1));
    return [...m.entries()];
  };
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="flex flex-wrap gap-1">{by((p) => p.sub_role).map(([k, v]) => <span key={k} className="rounded bg-secondary px-2 py-1">{k}: <b>{v}</b></span>)}</div>
      <div className="flex flex-wrap gap-1">{by((p) => p.tier).map(([k, v]) => <span key={k} className="rounded bg-secondary px-2 py-1">{k}: <b>{v}</b></span>)}</div>
    </div>
  );
}

function PoolMixExplainer() {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">How players are grouped</summary>
      <p className="mt-1">Established: enough recent matches in this format (last 36 months of covered Cricsheet data) and a top-half Cricket Auction performance score for their batting or bowling. Emerging: a small covered sample in every format so far. Experienced players outside the top half, or with no covered matches, are left out of random 80/20 pools. These groups only shape the pool — they are not official rankings.</p>
    </details>
  );
}
