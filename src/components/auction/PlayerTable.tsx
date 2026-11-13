import { useMemo, useState } from "react";
import { LayoutGrid, List, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney, ROLE_LABEL, SUB_ROLES, type Player, type Role, type Settings } from "@/lib/auction-rules";
import { PlayerCard, TierBadge } from "./PlayerCard";
import { PlayerPortrait } from "./PlayerPortrait";
import { PlayerProfile } from "./PlayerProfile";

export interface PoolRow {
  player: Player;
  set?: string;
  order?: number | undefined;
  round?: number;
  status?: string;
  owner?: { name: string; color: string } | null;
  price?: number | null;
}

const sel = "min-h-11 sm:min-h-9 h-11 sm:h-9 rounded-md border border-input bg-background px-2 text-base sm:text-sm";

export function PlayerTable({
  rows,
  currency = "cr",
  starred,
  onStar,
}: {
  rows: PoolRow[];
  currency?: Settings["currency"];
  starred?: Set<string>;
  onStar?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [sub, setSub] = useState("");
  const [tier, setTier] = useState("");
  const [nat, setNat] = useState("");
  const [maxBase, setMaxBase] = useState("");
  const [sort, setSort] = useState<"order" | "rating" | "base" | "name">(rows[0]?.order != null ? "order" : "name");
  const [view, setView] = useState<"table" | "cards">("table");
  const [onlyStar, setOnlyStar] = useState(false);

  const filtered = useMemo(() => {
    const out = rows.filter(({ player: p }) => {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && !p.country.toLowerCase().includes(q.toLowerCase())) return false;
      if (role && p.role !== role) return false;
      if (sub && p.sub_role !== sub) return false;
      if (tier && p.tier !== tier) return false;
      if (nat && p.nationality_type !== nat) return false;
      if (maxBase && Number(p.base_price) > Number(maxBase)) return false;
      if (onlyStar && !starred?.has(p.id)) return false;
      return true;
    });
    out.sort((a, b) =>
      sort === "rating"
        ? b.player.rating - a.player.rating
        : sort === "base"
          ? Number(b.player.base_price) - Number(a.player.base_price)
          : sort === "name"
            ? a.player.name.localeCompare(b.player.name)
            : (a.round ?? 1) - (b.round ?? 1) || (a.order ?? 0) - (b.order ?? 0),
    );
    return out;
  }, [rows, q, role, sub, tier, nat, maxBase, sort, onlyStar, starred]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Input placeholder="Search name or country" value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2 h-11 w-full sm:h-9 sm:w-56" />
        <select className={`${sel} max-w-full`} value={role} onChange={(e) => { setRole(e.target.value); setSub(""); }} aria-label="Role">
          <option value="">All roles</option>
          {Object.keys(SUB_ROLES).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select className={`${sel} max-w-full`} value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Sub-role">
          <option value="">All sub-roles</option>
          {(role ? SUB_ROLES[role as Role] : Object.values(SUB_ROLES).flat()).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={sel} value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Tier">
          <option value="">All tiers</option>
          {["Marquee", "A", "B", "C", "Uncapped"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={sel} value={nat} onChange={(e) => setNat(e.target.value)} aria-label="Nationality">
          <option value="">Indian + Overseas</option>
          <option>Indian</option>
          <option>Overseas</option>
        </select>
        <select className={sel} value={maxBase} onChange={(e) => setMaxBase(e.target.value)} aria-label="Max base price">
          <option value="">Any base price</option>
          {[0.2, 0.5, 1, 1.5, 2].map((b) => <option key={b} value={b}>≤ {formatMoney(b, currency)}</option>)}
        </select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          {rows[0]?.order != null && <option value="order">Auction order</option>}
          <option value="rating">Legacy setup estimate</option>
          <option value="base">Base price</option>
          <option value="name">Name</option>
        </select>
        {onStar && (
          <Button variant={onlyStar ? "default" : "outline"} size="sm" onClick={() => setOnlyStar(!onlyStar)}>
            <Star className="h-4 w-4" /> Targets
          </Button>
        )}
        <div className="ml-auto hidden gap-1 sm:flex">
          <Button size="icon" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")} aria-label="Table view"><List className="h-4 w-4" /></Button>
          <Button size="icon" variant={view === "cards" ? "secondary" : "ghost"} onClick={() => setView("cards")} aria-label="Card view"><LayoutGrid className="h-4 w-4" /></Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {rows.length} players · tiers, base prices and balanced pool selection are legacy setup estimates, not measured evaluation rankings.</p>
      <div className="grid gap-3 sm:hidden" aria-label="Player cards">{filtered.map(r=><article key={r.player.id} className="panel min-w-0 p-3">
        <div className="flex items-center gap-3"><PlayerPortrait player={r.player} className="h-16 w-12 shrink-0 rounded-lg"/><div className="min-w-0 flex-1"><PlayerProfile player={r.player} currency={currency}><strong className="block break-words text-base">{r.player.name}</strong></PlayerProfile><p className="mt-1 text-xs text-muted-foreground">{r.player.country} · {r.player.sub_role}</p></div>{onStar&&<Button variant="ghost" size="icon" className="shrink-0" aria-label={`Toggle target ${r.player.name}`} onClick={()=>onStar(r.player.id)}><Star className={cn('h-5 w-5',starred?.has(r.player.id)&&'fill-primary text-primary')}/></Button>}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3"><TierBadge tier={r.player.tier}/><span className="text-sm font-semibold">Base {formatMoney(Number(r.player.base_price),currency)}</span></div>
        {(r.status||r.order!=null)&&<p className="mt-2 break-words text-xs text-muted-foreground">{r.order!=null?`Round ${r.round??1} · #${r.order} · `:''}{r.status==='sold'&&r.owner?`${r.owner.name} · ${formatMoney(r.price,currency)}`:r.status}</p>}
      </article>)}</div>
      <div className="hidden sm:block">{view === "cards" ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <PlayerCard key={r.player.id} player={r.player} currency={currency} starred={starred?.has(r.player.id)} onStar={onStar ? () => onStar(r.player.id) : undefined} />
          ))}
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                {onStar && <th className="p-2" />}
                {rows[0]?.order != null && <th className="p-2">Round / queue</th>}
                <th className="p-2">Player</th>
                <th className="p-2">Role</th>
                <th className="p-2">Tier</th>
                <th className="p-2 text-right">Evidence</th>
                <th className="p-2 text-right">Est. base</th>
                {rows[0]?.set && <th className="p-2">Category</th>}
                {rows[0]?.status && <th className="p-2">Status</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.player.id} className="border-b border-border/50 hover:bg-secondary/40">
                  {onStar && (
                    <td className="p-2">
                      <button onClick={() => onStar(r.player.id)} aria-label="Toggle target">
                        <Star className={cn("h-4 w-4 text-muted-foreground", starred?.has(r.player.id) && "fill-primary text-primary")} />
                      </button>
                    </td>
                  )}
                  {r.order != null && <td className="p-2 tabular text-muted-foreground">{r.round ?? 1} / {r.order}</td>}
                  <td className="p-2">
                    <PlayerProfile player={r.player} currency={currency}><div className="flex items-center gap-3"><PlayerPortrait player={r.player} className="h-12 w-10 shrink-0 rounded"/><div><div className="whitespace-nowrap font-semibold">{r.player.name}</div><div className="text-xs text-muted-foreground">{r.player.country}{r.player.nationality_type === "Overseas" ? " ✈" : ""}</div></div></div></PlayerProfile>
                  </td>
                  <td className="p-2 text-xs">{r.player.sub_role}</td>
                  <td className="p-2"><TierBadge tier={r.player.tier} /></td>
                  <td className="p-2 text-right text-xs text-electric"><PlayerProfile player={r.player}>Stats / fit / C–VC</PlayerProfile></td>
                  <td className="p-2 text-right tabular">{formatMoney(Number(r.player.base_price), currency)}</td>
                  {r.set && <td className="p-2 text-xs">{r.set}</td>}
                  {r.status && (
                    <td className="p-2 text-xs">
                      {r.status === "sold" && r.owner ? (
                        <span style={{ color: r.owner.color }}>{r.owner.name} · {formatMoney(r.price, currency)}</span>
                      ) : (
                        <span className="capitalize text-muted-foreground">{r.status}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}</div>
    </div>
  );
}
