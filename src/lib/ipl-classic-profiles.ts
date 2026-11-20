import records from "@/data/ipl-classic-profiles.json";
import type { Player } from "./auction-rules";

const profiles = new Map(records.map((record) => [record.name, record]));

export function classicProfile(player: Player) {
  if (player.format !== "IPL" || player.age_group !== "Classic") return;
  const profile = profiles.get(player.name);
  return profile?.country === player.country ? profile : undefined;
}
