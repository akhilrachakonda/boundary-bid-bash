import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlayerPortrait } from "./PlayerPortrait";
import { formatMoney, ROLE_LABEL, type Player, type Settings } from "@/lib/auction-rules";
import { withCanonicalPhoto } from "@/lib/player-photos";
import { EvidencePanel } from "./EvidencePanel";

export function PlayerProfile({ player, children, currency = "cr" }: { player: Player; children?: React.ReactNode; currency?: Settings["currency"] }) {
  const [open, setOpen] = useState(false);
  player=withCanonicalPhoto(player);
  return <><Button variant="ghost" onClick={() => setOpen(true)} className="player-profile-trigger h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent" aria-label={`View ${player.name} profile`}>{children ?? player.name}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <PlayerPortrait player={player} className="mx-auto h-64 w-52 rounded-md" priority />
      <DialogTitle className="font-display text-4xl uppercase">{player.name}</DialogTitle><DialogDescription>{player.country} · {ROLE_LABEL[player.role]} · {player.sub_role}</DialogDescription>
      <dl className="grid grid-cols-3 gap-3 border-y py-4"><div><dt className="text-xs text-muted-foreground">Rating</dt><dd className="font-display text-3xl text-primary">{player.rating}</dd></div><div><dt className="text-xs text-muted-foreground">Base price</dt><dd className="font-display text-2xl">{formatMoney(Number(player.base_price),currency)}</dd></div><div><dt className="text-xs text-muted-foreground">Tier</dt><dd className="font-display text-2xl">{player.tier}</dd></div></dl>
      <p className="text-sm text-muted-foreground">{player.batting_hand}-hand bat · {player.bowling_style} · {player.format}</p>
      <EvidencePanel player={player} />
      {player.photo_credit && <p className="text-xs text-muted-foreground">Photo: {player.photo_credit} {player.photo_source && <a href={player.photo_source} target="_blank" rel="noreferrer" className="underline">Source</a>}</p>}
    </DialogContent></Dialog>
  </>;
}