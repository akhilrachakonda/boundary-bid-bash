import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { SettingsForm } from "@/components/SettingsForm";
import { ColorPicker, TEAM_COLORS } from "@/components/TeamPicker";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, type Format, type Settings } from "@/lib/auction-rules";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create a room — Cricket Auction" },
      { name: "description", content: "Pick a format, budget, squad rules and pool size for your cricket auction." },
      { property: "og:title", content: "Create a room — Cricket Auction" },
      { property: "og:description", content: "Set up an IPL, T20 or ODI player auction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();
  const [format, setFormat] = useState<Format>("IPL");
  const [name, setName] = useState("Friday Night Auction");
  const [nick, setNick] = useState("");
  const [team, setTeam] = useState("");
  const [color, setColor] = useState<string>(TEAM_COLORS[0]!);
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => setNick(localStorage.getItem("auction-nick") ?? ""), []);

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_catalogue_room" as never, {
      p_name: name,
      p_format: format,
      p_settings: s as unknown as Json,
      p_nickname: nick || "Host",
      p_team: team || `${nick || "Host"} XI`,
      p_color: color,
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const { room_id } = data as unknown as { room_id: string };
    navigate({ to: "/room/$roomId", params: { roomId: room_id } });
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <h1 className="text-5xl font-extrabold uppercase">Create <span className="text-gold">room</span></h1>
        <div className="panel grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Room name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <div className="sm:col-span-2">
            <Label>Format</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["IPL", "T20", "ODI"] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`h-14 rounded-lg border font-display text-2xl font-bold ${format === f ? "border-primary bg-primary/15 text-primary shadow-glow" : ""}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Your nickname</Label>
            <Input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} />
          </div>
          <div className="space-y-1">
            <Label>Team name</Label>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={30} placeholder="e.g. Mumbai Mavericks" />
          </div>
          <div className="sm:col-span-2">
            <Label>Team colour</Label>
            <div className="mt-1"><ColorPicker value={color} onChange={setColor} /></div>
          </div>
        </div>
        <div className="panel p-5">
          <SettingsForm s={s} onChange={setS} available={format === 'IPL' ? 273 : 150} />
        </div>
        <Button className="h-14 w-full bg-gold text-lg font-bold text-primary-foreground shadow-glow" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create room & open lobby"}
        </Button>
      </main>
    </div>
  );
}
