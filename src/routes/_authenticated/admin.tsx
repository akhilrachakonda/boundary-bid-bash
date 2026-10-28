import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SUB_ROLES, type Player, type Role } from "@/lib/auction-rules";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Player database admin — Gavel" },
      { name: "description", content: "Edit ratings, prices and roles in the cricket player database." },
      { property: "og:title", content: "Player database admin — Gavel" },
      { property: "og:description", content: "Admin tools for the player database." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const tierFor = (r: number) => (r >= 90 ? "Marquee" : r >= 82 ? "A" : r >= 72 ? "B" : r >= 60 ? "C" : "Uncapped");
const priceFor = (r: number) => (r >= 90 ? 2 : r >= 82 ? 1.5 : r >= 72 ? 1 : r >= 60 ? 0.5 : 0.2);
const sel = "h-8 rounded border border-input bg-background px-1 text-xs";

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [format, setFormat] = useState("IPL");
  const [rows, setRows] = useState<Player[]>([]);
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState<Record<string, Partial<Player>>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from("players").select("*").eq("format", format).order("role").order("rating", { ascending: false });
    setRows((data ?? []) as Player[]);
    setDirty({});
  }, [format]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const edit = (id: string, patch: Partial<Player>) => setDirty((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const save = async () => {
    for (const [id, patch] of Object.entries(dirty)) {
      const { error } = await supabase.from("players").update(patch).eq("id", id);
      if (error) return toast.error(error.message);
    }
    toast.success(`Saved ${Object.keys(dirty).length} players`);
    load();
  };

  const add = async () => {
    const name = prompt("Player name");
    if (!name) return;
    const { error } = await supabase.from("players").insert({
      name, country: "India", format, role: "BAT", sub_role: "Top order", rating: 65, base_price: 0.5, nationality_type: "Indian", tier: "C",
    });
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) return null;
  if (!isAdmin)
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-4xl font-bold uppercase">Admins only</h1>
          <p className="mt-2 text-muted-foreground">Only the app owner can edit the player database.</p>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-4xl font-extrabold uppercase">Player database</h1>
          {["IPL", "T20", "ODI"].map((f) => (
            <Button key={f} size="sm" variant={format === f ? "default" : "outline"} onClick={() => setFormat(f)}>{f}</Button>
          ))}
          <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-48" />
          <Button size="sm" variant="outline" onClick={add}>Add player</Button>
          <Button size="sm" onClick={save} disabled={!Object.keys(dirty).length}>Save {Object.keys(dirty).length || ""}</Button>
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b"><th className="p-2">Name</th><th className="p-2">Country</th><th className="p-2">Sub-role</th><th className="p-2">Bats</th><th className="p-2">Rating</th><th className="p-2">Base (Cr)</th><th className="p-2">Tier</th><th className="p-2" /></tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const v = { ...r, ...dirty[r.id] };
                return (
                  <tr key={r.id} className={`border-b border-border/50 ${dirty[r.id] ? "bg-primary/5" : ""}`}>
                    <td className="p-1"><Input className="h-8" value={v.name} onChange={(e) => edit(r.id, { name: e.target.value })} /></td>
                    <td className="p-1"><Input className="h-8 w-32" value={v.country} onChange={(e) => edit(r.id, { country: e.target.value, nationality_type: e.target.value === "India" ? "Indian" : "Overseas" })} /></td>
                    <td className="p-1">
                      <select className={sel} value={`${v.role}|${v.sub_role}`} onChange={(e) => { const [role, sub_role] = e.target.value.split("|"); edit(r.id, { role, sub_role }); }}>
                        {(Object.keys(SUB_ROLES) as Role[]).flatMap((role) => SUB_ROLES[role].map((s) => <option key={s} value={`${role}|${s}`}>{role} · {s}</option>))}
                      </select>
                    </td>
                    <td className="p-1">
                      <select className={sel} value={v.batting_hand} onChange={(e) => edit(r.id, { batting_hand: e.target.value })}><option>Right</option><option>Left</option></select>
                    </td>
                    <td className="p-1"><Input className="h-8 w-16" type="number" min={1} max={100} value={v.rating} onChange={(e) => { const n = Number(e.target.value); edit(r.id, { rating: n, tier: tierFor(n), base_price: priceFor(n) }); }} /></td>
                    <td className="p-1"><Input className="h-8 w-20" type="number" step={0.05} value={v.base_price} onChange={(e) => edit(r.id, { base_price: Number(e.target.value) })} /></td>
                    <td className="p-1 text-xs">{v.tier}</td>
                    <td className="p-1">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                        if (!confirm(`Delete ${r.name}?`)) return;
                        const { error } = await supabase.from("players").delete().eq("id", r.id);
                        if (error) toast.error(error.message.includes("foreign key") ? "Player is used in a room and can't be deleted" : error.message); else load();
                      }}>Delete</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
