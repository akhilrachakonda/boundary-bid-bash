import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney, type Player } from "@/lib/auction-rules";
import { TeamDot } from "@/components/auction/TeamPurseBar";
import type { Trade } from "@/hooks/use-room";
import type { RoomData, Derived } from "@/components/auction/derive";
import { PrivatePanel } from "./PrivatePanel";
import { rpc } from "./rpc";
import { PlayerPortrait } from "@/components/auction/PlayerPortrait";
import { PlayerProfile } from "@/components/auction/PlayerProfile";

export function TradeCard({ t, d, currency, actions }: { t: Trade; d: Derived; currency: "cr" | "lakh" | "coins"; actions?: React.ReactNode }) {
  const from = d.partById.get(t.from_participant);
  const to = d.partById.get(t.to_participant);
  const names = (ids: string[]) => ids.map((id) => d.playerById.get(id)?.name ?? "?").join(", ") || "—";
  return (
    <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        <TeamDot color={from?.color ?? "#888"} /> {from?.team_name}
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        <TeamDot color={to?.color ?? "#888"} /> {to?.team_name}
        <span className={cn("ml-auto text-xs uppercase", t.status === "accepted" ? "text-success" : t.status === "pending" ? "text-primary" : "text-muted-foreground")}>{t.status}</span>
      </div>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <div><span className="text-xs text-muted-foreground">Gives: </span>{names(t.offer_players)}{Number(t.cash) > 0 && ` + ${formatMoney(Number(t.cash), currency)}`}</div>
        <div><span className="text-xs text-muted-foreground">Gets: </span>{names(t.request_players)}{Number(t.cash) < 0 && ` + ${formatMoney(-Number(t.cash), currency)}`}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{[...t.offer_players,...t.request_players].map(id=>{const player=d.playerById.get(id);return player ? <PlayerProfile key={id} player={player} currency={currency}><PlayerPortrait player={player} className="h-14 w-12 rounded"/></PlayerProfile> : null;})}</div>
      {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function PickList({ players, picked, toggle }: { players: Player[]; picked: string[]; toggle: (id: string) => void }) {
  if (!players.length) return <p className="text-xs text-muted-foreground">No players.</p>;
  return (
    <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
      {players.map((p) => (
        <button key={p.id} onClick={() => toggle(p.id)} className={cn("rounded-full border px-2 py-1 text-xs", picked.includes(p.id) && "border-primary bg-primary/20 text-primary")}>
          <PlayerPortrait player={p} className="mr-1 inline-block h-10 w-8 rounded"/>{p.name} · {p.rating}
        </button>
      ))}
    </div>
  );
}

export function Trades({ data, d, now }: { data: RoomData; d: Derived; now: number }) {
  const room = data.room!;
  const s = room.settings;
  const me = d.me!;
  const [minutes, setMinutes] = useState(10);
  const others = data.participants.filter((p) => p.id !== me.id);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [offer, setOffer] = useState<string[]>([]);
  const [req, setReq] = useState<string[]>([]);
  const [cash, setCash] = useState(0);
  const [parent, setParent] = useState<string | null>(null);
  const toggle = (arr: string[], set: (v: string[]) => void) => (id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  if (room.status === "completed") {
    return (
      <div className="space-y-4">
        <div className="panel space-y-3 p-6 text-center">
          <h2 className="text-4xl font-extrabold uppercase">Auction <span className="text-gold">complete</span></h2>
          {d.isHost ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Input type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-24" />
              <span className="text-sm text-muted-foreground">minutes</span>
              <Button onClick={() => rpc("open_trades", { p_room: room.id, p_minutes: minutes })}>Open trade window</Button>
              <Button variant="outline" onClick={() => rpc("host_control", { p_room: room.id, p_action: "results" })}>Skip to results</Button>
              <Button variant="ghost" onClick={() => confirm("Undo the last sale and reopen the auction?") && rpc("host_control", { p_room: room.id, p_action: "undo" })}>Undo last sale</Button>
            </div>
          ) : (
            <p className="text-muted-foreground">Waiting for the host to open the trade window.</p>
          )}
        </div>
        <PrivatePanel data={data} d={d} />
      </div>
    );
  }

  const left = room.trade_ends_at ? Math.max(0, new Date(room.trade_ends_at).getTime() - now) : 0;
  const pending = data.trades.filter((t) => t.status === "pending");
  const history = data.trades.filter((t) => t.status !== "pending");
  const propose = async () => {
    if (parent) {
      const ok = await rpc("respond_trade", { p_trade: parent, p_action: "counter" });
      if (!ok) return;
    }
    const id = await rpc("propose_trade", { p_room: room.id, p_to: to, p_offer: offer, p_request: req, p_cash: cash, p_parent: parent });
    if (id) {
      toast.success("Trade proposed");
      setOffer([]); setReq([]); setCash(0); setParent(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <h2 className="text-3xl font-extrabold uppercase">Trade window</h2>
          <span className="font-display text-3xl font-bold text-gold tabular">{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}</span>
          {d.isHost && <Button variant="outline" className="ml-auto" onClick={() => rpc("host_control", { p_room: room.id, p_action: "results" })}>Close window & show results</Button>}
        </div>
        <div className="panel space-y-3 p-4">
          <h3 className="text-xl font-bold uppercase">{parent ? "Counter-offer" : "Propose a trade"}</h3>
          <div className="flex flex-wrap gap-2">
            {others.map((o) => (
              <button key={o.id} onClick={() => { setTo(o.id); setReq([]); }} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", to === o.id && "border-primary")}>
                <TeamDot color={o.color} /> {o.team_name}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">You give</p>
              <PickList players={d.mySquad} picked={offer} toggle={toggle(offer, setOffer)} />
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">You get</p>
              <PickList players={to ? d.squadOf(to) : []} picked={req} toggle={toggle(req, setReq)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Cash (Cr, positive = you pay, negative = they pay)</span>
            <Input type="number" step={0.25} value={cash} onChange={(e) => setCash(Number(e.target.value))} className="w-28" />
          </div>
          <div className="flex gap-2">
            <Button onClick={propose} disabled={!to || (!offer.length && !req.length)}>Send {parent ? "counter" : "proposal"}</Button>
            {parent && <Button variant="ghost" onClick={() => setParent(null)}>Cancel counter</Button>}
          </div>
        </div>
        <div className="panel space-y-2 p-4">
          <h3 className="text-xl font-bold uppercase">Pending ({pending.length})</h3>
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending trades.</p>}
          {pending.map((t) => (
            <TradeCard
              key={t.id}
              t={t}
              d={d}
              currency={s.currency}
              actions={
                t.to_participant === me.id ? (
                  <>
                    <Button size="sm" onClick={async () => (await rpc("respond_trade", { p_trade: t.id, p_action: "accept" })) && toast.success("Trade accepted")}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => rpc("respond_trade", { p_trade: t.id, p_action: "reject" })}>Reject</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setParent(t.id); setTo(t.from_participant); setOffer(t.request_players); setReq(t.offer_players); setCash(-Number(t.cash)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Counter</Button>
                  </>
                ) : t.from_participant === me.id ? (
                  <Button size="sm" variant="ghost" onClick={() => rpc("respond_trade", { p_trade: t.id, p_action: "cancel" })}>Withdraw</Button>
                ) : undefined
              }
            />
          ))}
        </div>
        <div className="panel space-y-2 p-4">
          <h3 className="text-xl font-bold uppercase">Trade history</h3>
          {history.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          {history.map((t) => <TradeCard key={t.id} t={t} d={d} currency={s.currency} />)}
        </div>
      </div>
      <PrivatePanel data={data} d={d} />
    </div>
  );
}
