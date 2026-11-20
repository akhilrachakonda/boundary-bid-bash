import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PlayerPortrait } from "@/components/auction/PlayerPortrait";
import { SourceStats } from "@/components/auction/SourceStats";
import { withCanonicalPhoto } from "@/lib/player-photos";
import classics from "@/data/ipl-classic-profiles.json";
import repairs from "@/data/ipl-portrait-repairs.json";
import catalogue from "@/data/crickauction/import.json";
import photos from "@/data/player-photos.json";
import type { Player } from "@/lib/auction-rules";

afterEach(cleanup);

it("matches every imported classic to an IPL stats record and a distinct portrait", () => {
  const sql = readFileSync("scripts/ipl-classics-import.sql", "utf8");
  const roster: string[][] = JSON.parse(sql.match(/roster constant jsonb := '([\s\S]*?)';/)![1]!);
  expect(classics.map((p) => [p.name, p.country]).sort()).toEqual(
    roster.map((r) => r.slice(0, 2)).sort(),
  );
  expect(new Set(classics.map((p) => p.photo)).size).toBe(roster.length);
  for (const profile of classics) {
    const player = {
      name: profile.name,
      country: profile.country,
      format: "IPL",
      age_group: "Classic",
    } as Player;
    expect(withCanonicalPhoto(player).photo_url).toBe(profile.photo);
    expect(profile.stats.matches).toBeGreaterThan(0);
    expect(profile.stats.wickets).toBeGreaterThanOrEqual(0);
  }
});

it("shows career totals and their source even when the classic room stores no statistics", () => {
  const player = {
    name: "Sachin Tendulkar",
    source_stats: {},
    country: "India",
    age_group: "Classic",
    format: "IPL",
  } as Player;
  render(<SourceStats player={player} />);
  expect(screen.getByText("2334")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Cricbuzz player profile" })).toHaveAttribute(
    "href",
    classics[0]!.profile,
  );
});

it("uses the repaired URL for the imported image and preserves a later owner upload", () => {
  for (const correction of repairs) {
    const record = catalogue.find((p) => p.player.name === correction.name)!.player as Player;
    expect(withCanonicalPhoto(record).photo_url).toBe(correction.photo);
    expect(withCanonicalPhoto({ ...record, photo_url: "/owner.webp" }).photo_url).toBe(
      "/owner.webp",
    );
  }
});

it("tries the original photo once if a legacy hosted asset fails", () => {
  const p = photos.find((p) => p.name === "Mohsin Khan")!;
  const player = { name: p.name, country: p.country, format: "T20", photo_url: p.url } as Player;
  render(<PlayerPortrait player={player} />);
  const img = screen.getByRole("img", { name: p.name });
  fireEvent.error(img);
  expect(img).toHaveAttribute("src", p.original_url);
  fireEvent.error(img);
  expect(screen.getByRole("img", { name: p.name + ": photo unavailable" })).toBeInTheDocument();
});
