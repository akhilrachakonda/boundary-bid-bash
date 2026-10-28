import photos from "@/data/player-photos.json";
import type { Player } from "./auction-rules";
export function withCanonicalPhoto(player: Player): Player {
  const photo=photos.find(p=>p.name===player.name && p.country===player.country);
  if(!photo)return player;
  if(player.photo_url && player.photo_url!==photo.url)return player;
  return {...player,photo_url:photo.url,photo_source:photo.source,photo_credit:photo.credit};
}