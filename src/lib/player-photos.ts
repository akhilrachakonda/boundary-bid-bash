import photos from "@/data/player-photos.json";
import repairs from "@/data/ipl-portrait-repairs.json";
import type { Player } from "./auction-rules";
import { classicProfile } from "./ipl-classic-profiles";
import { portraitImprovements } from "./portrait-improvements";

const key = (p: { name: string; country: string }) => p.name + "|" + p.country;
const canonical = new Map(photos.map((photo) => [key(photo), photo]));
const corrections = new Map(repairs.map((photo) => [key(photo), photo]));

export function withCanonicalPhoto(player: Player): Player {
  const classic = classicProfile(player);
  if (classic && !player.photo_url) {
    return {
      ...player,
      photo_url: classic.photo,
      photo_source: classic.profile,
      photo_credit: "Cricbuzz",
    };
  }
  const correction = corrections.get(key(player));
  if (
    correction &&
    player.format === "IPL" &&
    (!player.photo_url || player.photo_url === correction.replaces)
  ) {
    return {
      ...player,
      photo_url: correction.photo,
      photo_source: correction.profile,
      photo_credit: correction.credit,
    };
  }
  const photo = canonical.get(key(player));
  if (!photo || (player.photo_url && player.photo_url !== photo.url)) return player;
  const improved = portraitImprovements.find((p) => key(p) === key(player));
  if (improved)
    return {
      ...player,
      photo_url: improved.url,
      photo_source: improved.source,
      photo_credit: improved.credit,
    };
  return {
    ...player,
    photo_url: photo.url,
    photo_source: photo.source,
    photo_credit: photo.credit,
  };
}

// Legacy portraits have a provider original for use when the hosted asset cannot load.
export function originalPhotoUrl(player: Player, primary?: string | null) {
  const photo = canonical.get(key(player));
  return photo && primary === photo.url && photo.original_url !== primary
    ? photo.original_url
    : undefined;
}
