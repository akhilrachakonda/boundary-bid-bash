import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { ColorPicker, TEAM_COLORS } from "@/components/TeamPicker";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/join")({
  validateSearch: (s: Record<string, unknown>) => ({ code: typeof s["code"] === "string" ? s["code"] : "" }),
  head: () => ({
    meta: [
      { title: "Join a room — Cricket Auction" },
      { name: "description", content: "Enter a 6-character room code to join your friends' cricket auction." },
      { property: "og:title", content: "Join a room — Cricket Auction" },
      { property: "og:description", content: "You've been invited to a live cricket auction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code: initial } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState(initial.toUpperCase());
  const [nick, setNick] = useState("");
  const [team, setTeam] = useState("");
  const [color, setColor] = useState<string>(TEAM_COLORS[1]!);
  const [busy, setBusy] = useState(false);
  useEffect(() => setNick(localStorage.getItem("auction-nick") ?? ""), []);

  const join = async () => {
    if (code.trim().length !== 6) { toast.error("Room codes are 6 characters"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("join_room", {
      p_code: code,
      p_nickname: nick || "Player",
      p_team: team || `${nick || "Player"} XI`,
      p_color: color,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/room/$roomId", params: { roomId: data as string } });
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md space-y-4 px-4 py-12">
        <h1 className="text-center text-5xl font-extrabold uppercase">Join <span className="text-gold">room</span></h1>
        <div className="panel space-y-4 p-5">
          <div className="space-y-1">
            <Label>Room code</Label>
            <Input value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} className="h-14 text-center font-display text-3xl tracking-[0.4em]" placeholder="ABC123" />
          </div>
          <div className="space-y-1">
            <Label>Nickname</Label>
            <Input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} />
          </div>
          <div className="space-y-1">
            <Label>Team name</Label>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={30} placeholder="e.g. Chennai Chargers" />
          </div>
          <div>
            <Label>Team colour</Label>
            <div className="mt-1"><ColorPicker value={color} onChange={setColor} /></div>
          </div>
          <Button className="h-14 w-full bg-gold text-lg font-bold text-primary-foreground" onClick={join} disabled={busy}>
            {busy ? "Joining…" : "Join auction"}
          </Button>
        </div>
      </main>
    </div>
  );
}
