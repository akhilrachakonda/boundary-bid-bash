import type { Player } from '@/lib/auction-rules';

const labels: Record<string, string> = {
  matches: 'Matches', runs: 'Runs', wickets: 'Wickets', avg: 'Average',
  sr: 'Strike rate', econ: 'Economy', hs: 'Highest score', bb: 'Best bowling',
};

export function SourceStats({ player }: { player: Player }) {
  const entries = Object.entries(player.source_stats ?? {}).filter(([key, value]) => key in labels && value != null);
  if (!entries.length) return null;
  return <section aria-label={`${player.name} statistics`} className="mt-4 space-y-2">
    <dl className="grid grid-cols-3 gap-x-4 gap-y-3 rounded-xl border border-border/60 bg-background/40 p-3 sm:grid-cols-4">
      {entries.map(([key, value]) => <div key={key}>
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{labels[key]}</dt>
        <dd className="font-display text-xl font-bold tabular text-foreground">{value}</dd>
      </div>)}
    </dl>
    <p className="text-[10px] text-muted-foreground">
      Crick Auction stats · imported {player.stats_imported} · source cutoff unspecified.
      {' '}<a className="underline" href="https://github.com/Shaurya01836/ipl-auction/blob/ddb56cc8282cbb997cc8c93ae24c7d8328b9bf1c/src/data/players.js" target="_blank" rel="noreferrer">Source</a>
    </p>
  </section>;
}
