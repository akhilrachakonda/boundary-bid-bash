import photos from "@/data/player-photos.json";
import type { Player } from "./auction-rules";
import { portraitImprovements } from './portrait-improvements';
const canonical = new Map(photos.map(photo => [`${photo.name}\u0000${photo.country}`, photo]));
export function withCanonicalPhoto(player: Player): Player {
  const photo=canonical.get(`${player.name}\u0000${player.country}`);
  if(!photo){
    // Newer catalogue identities have only openly licensed improvements; owner overrides still win.
    const extra=portraitImprovements.find(p=>p.name===player.name&&p.country===player.country);
    if(player.photo_url||!extra)return player;
    return {...player,photo_url:extra.url,photo_source:extra.source,photo_credit:extra.credit};
  }
  if(player.photo_url && player.photo_url!==photo.url)return player;
  const improved=portraitImprovements.find(p=>p.name===player.name&&p.country===player.country);
  if(improved)return {...player,photo_url:improved.url,photo_source:improved.source,photo_credit:improved.credit};
  return {...player,photo_url:photo.url,photo_source:photo.source,photo_credit:photo.credit};
}