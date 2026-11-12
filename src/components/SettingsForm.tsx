import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { poolRequirements, type Settings } from "@/lib/auction-rules";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";

function Num({ label, value, onChange, step = 1, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={value} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function SettingsForm({ s, onChange, available }: { s: Settings; onChange: (s: Settings) => void; available?: number }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...s, [k]: v });
  const req = poolRequirements(s);
  const poolN = s.pool_size === "all" ? available ?? 150 : s.pool_size;
  const presets = ["all", 40, 70, 100];
  return (
    <div className="space-y-5">
      <label className="flex items-center justify-between gap-4 rounded-md border p-3"><span><strong className="block">Surprise player reveal</strong><span className="text-xs text-muted-foreground">Everyone can scout the pool; future sequence stays secret until each lot opens.</span></span><Switch checked={s.surprise_reveal === true} onCheckedChange={v => set("surprise_reveal", v)} /></label>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1"><Label htmlFor="team-count" className="text-xs">Teams (2–10)</Label><select id="team-count" className={sel} value={s.max_teams} onChange={e => set('max_teams', Number(e.target.value))}>{Array.from({length:9},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} teams</option>)}</select></div>
        <Num label="Purse per team (Cr)" value={s.purse} step={5} min={10} onChange={(n) => set("purse", n)} />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Currency display</Label>
          <select className={sel} value={s.currency} onChange={(e) => set("currency", e.target.value as Settings["currency"])}>
            <option value="cr">₹ Crore</option>
            <option value="lakh">₹ Lakh</option>
            <option value="coins">Coins</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Bid timer</Label>
          <select className={sel} value={s.bid_timer} onChange={(e) => set("bid_timer", Number(e.target.value))}>
            {[15, 20, 30].map((t) => <option key={t} value={t}>{t} seconds</option>)}
          </select>
        </div>
      </section>
      <section>
        <h4 className="mb-2 text-lg font-bold uppercase">Squad rules</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Num label="Min squad" value={s.min_squad} min={1} onChange={(n) => set("min_squad", n)} />
          <Num label="Max squad" value={s.max_squad} min={s.min_squad} onChange={(n) => set("max_squad", n)} />
          <Num label="Max overseas" value={s.max_overseas} onChange={(n) => set("max_overseas", n)} />
          <Num label="Min spinners" value={s.min_spinners} onChange={(n) => set("min_spinners", n)} />
          <Num label="Min pacers" value={s.min_pacers} onChange={(n) => set("min_pacers", n)} />
          <Num label="Min WK" value={s.min_wk} onChange={(n) => set("min_wk", n)} />
          <Num label="Min batsmen" value={s.min_bat} onChange={(n) => set("min_bat", n)} />
          <Num label="Min all-rounders" value={s.min_ar} onChange={(n) => set("min_ar", n)} />
          <Num label="Min bowlers" value={s.min_bowl} onChange={(n) => set("min_bowl", n)} />
          <Num label="Timer reset on bid (s)" value={s.bid_reset} min={3} onChange={(n) => set("bid_reset", n)} />
        </div>
      </section>
      <section>
        <h4 className="mb-2 text-lg font-bold uppercase">Pool size</h4>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set("pool_size", p as Settings["pool_size"])}
              className={`min-h-11 touch-manipulation rounded-full border px-4 py-1.5 text-sm font-semibold ${s.pool_size === p ? "border-primary bg-primary text-primary-foreground" : ""}`}
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
          <Input
            type="number"
            className="w-28"
            placeholder="Custom"
            value={typeof s.pool_size === "number" && !presets.includes(s.pool_size) ? s.pool_size : ""}
            onChange={(e) => set("pool_size", e.target.value ? Number(e.target.value) : 70)}
          />
        </div>
        {poolN < req.total && (
          <p className="mt-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-sm text-primary">
            {poolN} players isn't enough for {s.max_teams} teams × {s.min_squad} minimum squad. The pool will be raised to {req.total}.
          </p>
        )}
      </section>
      <section><h4 className="mb-2 text-lg font-bold uppercase">After the auction</h4><div className="grid grid-cols-2 gap-3"><Num label="Trade minutes" value={s.trade_minutes??10} min={1} max={120} onChange={n=>set('trade_minutes',n)}/><Num label="Playing XI minutes" value={s.lineup_minutes??5} min={1} max={120} onChange={n=>set('lineup_minutes',n)}/></div><p className="mt-2 text-xs text-muted-foreground">Trading → private Playing XI and match plans → opponent ratings. The host can change remaining time during the timed stages.</p></section>
      <section>
        <h4 className="mb-2 text-lg font-bold uppercase">Bid increments</h4>
        <div className="grid gap-2 sm:grid-cols-3">
          {s.increments.map((inc, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">+</span>
              <Input type="number" step={0.05} value={inc.step} className="w-20" onChange={(e) => {
                const arr = [...s.increments];
                arr[i] = { ...inc, step: Number(e.target.value) };
                set("increments", arr);
              }} />
              <span className="text-muted-foreground">{inc.upto == null ? "above" : "up to"}</span>
              {inc.upto != null && (
                <Input type="number" step={0.5} value={inc.upto} className="w-20" onChange={(e) => {
                  const arr = [...s.increments];
                  arr[i] = { ...inc, upto: Number(e.target.value) };
                  set("increments", arr);
                }} />
              )}
              <span className="text-muted-foreground">Cr</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
