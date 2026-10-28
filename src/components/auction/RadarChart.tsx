import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart as RC, ResponsiveContainer, Legend } from "recharts";

export interface RadarSeries {
  name: string;
  color: string;
  values: { xi: number; balance: number; bench: number; combo: number; budget: number };
}

const AXES: [keyof RadarSeries["values"], string][] = [
  ["xi", "Playing XI"],
  ["balance", "Balance"],
  ["bench", "Bench"],
  ["combo", "Combos"],
  ["budget", "Budget"],
];

export function RadarChart({ series }: { series: RadarSeries[] }) {
  const data = AXES.map(([k, label]) => {
    const row: Record<string, string | number> = { axis: label };
    series.forEach((s) => (row[s.name] = s.values[k]));
    return row;
  });
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <RC data={data} outerRadius="75%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          {series.map((s) => (
            <Radar key={s.name} name={s.name} dataKey={s.name} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} />
          ))}
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </RC>
      </ResponsiveContainer>
    </div>
  );
}
