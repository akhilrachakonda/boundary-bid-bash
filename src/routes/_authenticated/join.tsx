import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import {IplTeamPicker} from "@/components/IplTeamPicker";
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
  const [franchise,setFranchise]=useState('');
  const [entry,setEntry]=useState<{name:string;format:string;status:string;ipl_franchises:boolean;taken:string[];is_member:boolean;my_team:string|null;full:boolean}|null>(null);
  const [entryError,setEntryError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let alive=true;setEntry(null);setEntryError('');setFranchise('');
    if(code.trim().length!==6)return;
    const load=async()=>{const {data,error}=await supabase.rpc('room_entry' as never,{p_code:code} as never);if(!alive)return;
      if(error||!data){setEntryError('Room unavailable. Check the code and try again.');setEntry(null);return;}
      const next=data as unknown as NonNullable<typeof entry>;setEntry(next);setEntryError('');
      setFranchise(current=>next.my_team??(next.taken.includes(current)?'':current));
    };
    const debounce=setTimeout(()=>void load(),350),timer=setInterval(()=>void load(),10000);
    return()=>{alive=false;clearTimeout(debounce);clearInterval(timer);};
  },[code,refresh]);
  useEffect(() => setNick(localStorage.getItem("auction-nick") ?? ""), []);

  const join = async () => {
    if (code.trim().length !== 6) { toast.error("Room codes are 6 characters"); return; }
    setBusy(true);
    const args=entry?.ipl_franchises?{p_code:code,p_nickname:nick||'Player',p_team:franchise}:{
      p_code: code,
      p_nickname: nick || "Player",
      p_team: team || `${nick || "Player"} XI`,
      p_color: color,
    };
    const { data, error } = await supabase.rpc((entry?.ipl_franchises?'join_franchise_room':'join_room') as never,args as never);
    setBusy(false);
    if (error) { toast.error(error.message); setRefresh(n=>n+1); return; }
    if (!data) { toast.error('Unable to join. Check the code or try again later.'); return; }
    navigate({ to: "/room/$roomId", params: { roomId: data as string } });
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6 sm:py-12">
        <h1 className="text-center text-4xl font-extrabold uppercase sm:text-5xl">Join <span className="text-gold">room</span></h1>
        <div className="panel space-y-4 p-5">
          <div className="space-y-1">
            <Label>Room code</Label>
            <Input value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} className="h-14 text-center font-display text-3xl tracking-[0.4em]" placeholder="ABC123" />
          </div>
          <div className="space-y-1">
            <Label>Nickname</Label>
            <Input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} />
          </div>
          {entryError&&<p role="alert" className="text-sm text-destructive">{entryError}<Button variant="ghost" onClick={()=>setRefresh(n=>n+1)}>Retry</Button></p>}
          {entry&&<p className="rounded-lg border bg-secondary/30 p-3 text-sm"><strong>{entry.name}</strong> · {entry.format}{entry.is_member?' · You already joined':entry.full?' · Room full':entry.status!=='lobby'?' · Auction already started':''}</p>}
          {entry?.ipl_franchises?<IplTeamPicker value={franchise} onChange={setFranchise} taken={entry.taken} disabled={busy||entry.is_member}/>:entry&&!entry.is_member&&<><div className="space-y-1">
            <Label>Team name</Label>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={30} placeholder="e.g. Chennai Chargers" />
          </div>
          <div>
            <Label>Team colour</Label>
            <div className="mt-1"><ColorPicker value={color} onChange={setColor} /></div>
          </div></>}
          <Button className="h-14 w-full bg-gold text-lg font-bold text-primary-foreground" onClick={join} disabled={busy||!entry||(!entry.is_member&&(entry.full||entry.status!=='lobby'||(entry.ipl_franchises&&!franchise)))}>
            {busy ? 'Joining…' : entry?.is_member ? 'Return to your room' : 'Join auction'}
          </Button>
        </div>
      </main>
    </div>
  );
}
