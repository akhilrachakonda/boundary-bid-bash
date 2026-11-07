import identities from "@/data/legacy-catalogue.json";

export const originalCatalogueNames = identities.map(({ name }) => name);
const keys = new Set(identities.map(({ name, country }) => `${name}|${country}`));

/** Catalogue selection only; never filter historical holdings or player lookup. */
export function selectOriginalCatalogue<T extends { name: string; country: string }>(players: T[]): T[] {
  return players.filter(({ name, country }) => keys.has(`${name}|${country}`));
}