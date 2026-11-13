import { cn } from "@/lib/utils";

// Team colours are user data (stored per participant), so they are listed here as values.
export const TEAM_COLORS = ["#f5b301", "#22d3ee", "#ef4444", "#22c55e", "#a855f7", "#f97316", "#ec4899", "#3b82f6", "#eab308", "#14b8a6"];

export function ColorPicker({ value, onChange, taken = [] }: { value: string; onChange: (c: string) => void; taken?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TEAM_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          onClick={() => onChange(c)}
          disabled={taken.includes(c) && c !== value}
          className={cn("h-11 w-11 sm:h-8 sm:w-8 rounded-full border-2 border-transparent transition disabled:opacity-20", value === c && "scale-110 border-foreground")}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
