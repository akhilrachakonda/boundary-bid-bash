import { useState } from "react";
import { UserRound } from "lucide-react";
import type { Player } from "@/lib/auction-rules";
import { cn } from "@/lib/utils";

export function PlayerPortrait({ player, className, priority = false }: { player: Player; className?: string; priority?: boolean | undefined }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = player.photo_url;
  return <div className={cn("portrait relative overflow-hidden bg-secondary", className)}>
    {url && failedUrl !== url ? <img src={url} alt={player.name} className="h-full w-full object-cover object-top" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" onError={() => setFailedUrl(url)} /> : <div className="grid h-full w-full place-items-center text-muted-foreground" role="img" aria-label={`${player.name}: photo unavailable`}><UserRound className="h-1/2 w-1/2" /></div>}
  </div>;
}