import { useState } from "react";
import { UserRound } from "lucide-react";
import type { Player } from "@/lib/auction-rules";
import { cn } from "@/lib/utils";
import { withCanonicalPhoto, originalPhotoUrl } from "@/lib/player-photos";

export function PlayerPortrait({
  player,
  className,
  priority = false,
}: {
  player: Player;
  className?: string;
  priority?: boolean | undefined;
}) {
  const primary = withCanonicalPhoto(player).photo_url;
  return (
    <PortraitImage
      key={primary ?? player.id}
      player={player}
      primary={primary}
      className={className}
      priority={priority}
    />
  );
}

function PortraitImage({
  player,
  primary,
  className,
  priority,
}: {
  player: Player;
  primary: string | null | undefined;
  className: string | undefined;
  priority: boolean;
}) {
  const [failures, setFailures] = useState(0);
  const url =
    failures === 0 ? primary : failures === 1 ? originalPhotoUrl(player, primary) : undefined;
  return (
    <div className={cn("portrait relative overflow-hidden bg-secondary", className)}>
      {url ? (
        <img
          src={url}
          alt={player.name}
          className="h-full w-full object-cover object-top"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailures((count) => count + 1)}
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center text-muted-foreground"
          role="img"
          aria-label={`${player.name}: photo unavailable`}
        >
          <UserRound className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
}
