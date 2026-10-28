import { describe,it,expect } from "vitest";
import photos from "@/data/player-photos.json";
import { withCanonicalPhoto } from "@/lib/player-photos";
import type { Player } from "@/lib/auction-rules";
describe("complete identity matched portrait catalogue",()=>{
  it("contains 150 distinct name-country identities with source credits",()=>{expect(photos).toHaveLength(150);expect(new Set(photos.map(p=>`${p.name}|${p.country}`)).size).toBe(150);expect(photos.every(p=>p.url.startsWith('/__l5e/assets-v1/')&&p.source.startsWith('https://')&&p.credit.length>0)).toBe(true);});
  it("never counts a provider default shirt as a portrait",()=>{expect(photos.filter(p=>/\/default-player|\/default-avatar/i.test(p.original_url))).toEqual([]);});
  it("matches Mohsin Khan India rather than a similar name",()=>{expect(photos.find(p=>p.name==='Mohsin Khan')?.country).toBe('India');});
  it("preserves owner replacement photos",()=>{const p={name:'Virat Kohli',country:'India',photo_url:'https://example.org/owner.jpg'} as Player;expect(withCanonicalPhoto(p).photo_url).toBe('https://example.org/owner.jpg');});
});