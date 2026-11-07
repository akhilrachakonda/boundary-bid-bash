import { describe, expect, it } from "vitest";
import identities from "@/data/legacy-catalogue.json";
import { originalCatalogueNames, selectOriginalCatalogue } from "@/lib/legacy-catalogue";

describe("original future-room catalogue", () => {
  it("contains exactly 150 original identities per format", () => {
    expect(new Set(originalCatalogueNames).size).toBe(150);
    for (const format of ["IPL", "T20", "ODI"]) {
      const rows = identities.map(p => ({ ...p, format }));
      expect(selectOriginalCatalogue([...rows, { name: "Expanded test player", country: "India", format }])).toHaveLength(150);
    }
  });
  it("requires canonical country as well as name", () => {
    expect(selectOriginalCatalogue([{ name: "Virat Kohli", country: "Australia" }])).toHaveLength(0);
    expect(selectOriginalCatalogue([{ name: "Virat Kohli", country: "India" }])).toHaveLength(1);
  });
});