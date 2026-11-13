import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Crown, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PlayerCard } from "@/components/auction/PlayerCard";
import { formatMoney } from "@/lib/auction-rules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { useNow, useRoom } from "@/hooks/use-room";
import { derive } from "@/components/auction/derive";
import { PlayerTable } from "@/components/auction/PlayerTable";
import { TeamPurseBar } from "@/components/auction/TeamPurseBar";
import { Lobby } from "@/components/room/Lobby";
import { Auction, AuctionLog } from "@/components/room/Auction";
import { PrivatePanel } from "@/components/room/PrivatePanel";
import { Trades } from "@/components/room/Trades";
import { Results } from "@/components/room/Results";
import { rpc } from "@/components/room/rpc";
import { getSoundPref, setSoundPref } from "@/lib/sound";
import { RoomEvidenceContext } from "@/components/auction/RoomEvidenceContext";
import {RoomEvaluationContext} from '@/components/auction/RoomEvaluationContext';
import {EvaluationLineup} from '@/components/auction/EvaluationLineup';
import { hostActionArgs } from '@/lib/room-actions';
import { repairsEnabled } from '@/lib/post-launch-controls';

import {CommunityStage} from '@/components/room/CommunityStage';
import {CommunityContext} from '@/components/auction/CommunityContext';

export const Route = createFileRoute("/_authenticated/room/$roomId")({
  head: () => ({
    meta: [
      { title: "Live room — Cricket Auction" },
      { name: "description", content: "Live cricket player auction room." },
      { property: "og:title", content: "Live room — Cricket Auction" },
      { property: "og:description", content: "Live cricket player auction room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user } = useAuth();
  const data = useRoom(roomId, user?.id);
  // Presence/review need only seconds; the live lot clock lives inside TimerRing.
  const now = useNow(data.offset, 1000);
  const d = useMemo(() => derive(data, user?.id), [data, user?.id]);
  const [sound, setSound] = useState(false);
  const [selectedTeam,setSelectedTeam] = useState<string|null>(null);
  useEffect(() => setSound(getSoundPref()), []);

  const room = data.room;
  const hostPart = room ? data.participants.find((p) => p.user_id === room.host_id) : null;
  const hostAway = hostPart ? now - new Date(hostPart.last_seen).getTime() > 30000 : false;

  const starred = useMemo(() => new Set(Object.keys(data.notes.targets)), [data.notes.targets]);
  const toggleStar = (id: string) => {
    const t = { ...data.notes.targets };
    if (t[id]) delete t[id];
    else t[id] = {};
    data.saveNotes({ ...data.notes, targets: t });
  };
  const poolRows = useMemo(
    () =>
      data.pool.map((rp) => {
        const owner = d.ownerOf(rp.player_id);
        return {
          player: rp.player,
          set: rp.round === 2 ? "Accelerated" : rp.set_name,
          order: data.room?.settings.surprise_reveal || data.room?.status === "lobby" || data.room?.status === "review" ? undefined : rp.lot_order,
          round: rp.round,
          status: rp.status,
          owner: owner ? { name: owner.team_name, color: owner.color } : null,
          price: rp.sold_price != null ? Number(rp.sold_price) : null,
        };
      }),
    [data.pool, data.room?.status, d],
  );

  if (data.error)
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-4xl font-bold uppercase">Room unavailable</h1>
          <p className="mt-2 text-muted-foreground">{data.error}</p>
          <Button asChild className="mt-4"><Link to="/join" search={{ code: "" }}>Join with a code</Link></Button>
        </div>
      </div>
    );
  if (!data.loaded || !room || !d.me)
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="grid h-[60vh] place-items-center text-muted-foreground">Loading room…</div>
      </div>
    );

  const s = room.settings;
  const live = room.status === "auction" || room.status === "paused";
  const reviewLeft = room.review_ends_at ? Math.max(0, new Date(room.review_ends_at).getTime() - now) : 0;

  const main =
    room.status === "lobby" ? (
      <Lobby data={data} d={d} now={now} />
    ) : room.status === "review" ? (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="panel flex flex-wrap items-center gap-3 p-4">
            <div>
              <h2 className="text-3xl font-extrabold uppercase">Review the pool</h2>
              <p className="text-sm text-muted-foreground">Star your targets. Bidding starts when the clock hits zero.</p>
            </div>
            <span className="ml-auto font-display text-5xl font-bold text-gold tabular">
              {Math.floor(reviewLeft / 60000)}:{String(Math.floor((reviewLeft % 60000) / 1000)).padStart(2, "0")}
            </span>
            {d.isHost && <Button onClick={() => rpc("host_control", hostActionArgs(room, "skip_review"))}>Skip review & start</Button>}
          </div>
          <p className="text-sm text-muted-foreground">Auction order is randomized when bidding starts</p>
          <PlayerTable rows={poolRows} currency={s.currency} starred={starred} onStar={toggleStar} />
        </div>
        <PrivatePanel data={data} d={d} />
      </div>
    ) : live || (repairsEnabled(room,data.capabilities) && room.status==='completed' && room.auction_stage==='final_call') ? (
      <Auction data={data} d={d} sound={sound} />
    ) : room.status === "completed" || room.status === "trade" ? (
      <Trades data={data} d={d} now={now} />
    ) : (
      room.community_mode ? <CommunityStage data={data} d={d} now={now}/> : <Results data={data} d={d} />
    );

  return (
    <CommunityContext.Provider value={!!room.community_mode}><RoomEvaluationContext.Provider value={room.id}><RoomEvidenceContext.Provider value={room.evaluation_snapshot}><div className="min-h-screen pb-10">
      <AppHeader>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{room.name}</div>
          <div className="text-xs text-muted-foreground">{room.format} · {room.code}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label={sound ? "Mute sounds" : "Turn on sounds"}
          onClick={() => { setSound(!sound); setSoundPref(!sound); }}
        >
          {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </AppHeader>
      <main className="room-main mx-auto min-w-0 max-w-7xl space-y-3 px-3 py-3 sm:space-y-4 sm:px-6 sm:py-5">
        {!room.community_mode&&room.evaluation_version==='v2.1'&&<p className="text-xs text-muted-foreground">V2.1 · 35 combination/position + 30 established + 20 recent + 10 bench + 5 leadership · {room.status==='lobby'?'Evidence and leadership freeze before review':'Frozen evidence and leadership rubric'} · <Link to="/scoring" className="text-electric underline">Rules and data coverage</Link></p>}
        {hostAway && !d.isHost && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
            <Crown className="h-4 w-4 text-primary" /> The host seems to have disconnected.
            <Button size="sm" className="ml-auto" onClick={() => { if (d.me) rpc("transfer_host", { p_room: room.id, p_participant: d.me.id }); }}>Become host</Button>
          </div>
        )}
        {room.status !== "lobby" && (
          <TeamPurseBar participants={data.participants} squadCount={(id) => data.squads.filter((x) => x.participant_id === id).length} settings={s} highlight={room.current_bidder} now={now} onSelect={setSelectedTeam}/>
        )}
        {room.status === "lobby" ? (
          main
        ) : (
          <Tabs defaultValue="main">
            <TabsList>
              <TabsTrigger value="main">{live ? "Auction" : room.auction_stage==='final_call'&&room.status==='completed' ? 'Final call' : room.status === "review" ? "Pool" : room.status === "results" ? (room.post_phase==='lineup'?'Playing XI':room.post_phase==='rating'?'Team ratings':'Results') : "Trades"}</TabsTrigger>
              {room.status !== "review" && <TabsTrigger value="pool">Player pool</TabsTrigger>}
              <TabsTrigger value="log">Log</TabsTrigger>
              {!room.community_mode&&room.evaluation_version==='v2.1'&&['completed','trade'].includes(room.status)&&<TabsTrigger value="evaluation">Evaluation XI</TabsTrigger>}
            </TabsList>
            <TabsContent value="main">{main}</TabsContent>
            <TabsContent value="pool">
              <PlayerTable rows={poolRows} currency={s.currency} starred={starred} onStar={toggleStar} />
            </TabsContent>
            <TabsContent value="log"><AuctionLog data={data} /></TabsContent>
            <TabsContent value="evaluation"><EvaluationLineup data={data} d={d}/></TabsContent>
          </Tabs>
        )}
      </main>
      <Sheet open={!!selectedTeam} onOpenChange={open=>{if(!open)setSelectedTeam(null);}}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetTitle className="font-display text-3xl uppercase">{selectedTeam ? d.partById.get(selectedTeam)?.team_name : "Team squad"}</SheetTitle><SheetDescription>{selectedTeam ? `${formatMoney(Number(d.partById.get(selectedTeam)?.purse ?? 0),s.currency)} remaining · ${d.squadOf(selectedTeam).length} players` : ""}</SheetDescription><div className="mt-5 space-y-3">{selectedTeam && d.squadOf(selectedTeam).map(player=><PlayerCard key={player.id} player={player} currency={s.currency}/>)}{selectedTeam && !d.squadOf(selectedTeam).length && <p className="text-sm text-muted-foreground">No signings yet.</p>}</div></SheetContent></Sheet>
    </div></RoomEvidenceContext.Provider></RoomEvaluationContext.Provider></CommunityContext.Provider>
  );
}
