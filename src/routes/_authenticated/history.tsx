import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "My rooms — Cricket Auction" },
      { name: "description", content: "Rejoin live auctions and revisit past results." },
      { property: "og:title", content: "My rooms — Cricket Auction" },
      { property: "og:description", content: "Your cricket auction room history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

interface Row { id: string; code: string; name: string; format: string; status: string; created_at: string }

const statusLabel: Record<string, string> = {
  lobby: "In lobby", review: "Reviewing pool", auction: "Live", paused: "Paused", completed: "Auction done", trade: "Trading", results: "Finished",
};

function HistoryPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    supabase.rpc("my_rooms").then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, []);
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <h1 className="text-5xl font-extrabold uppercase">My rooms</h1>
        {rows === null ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="text-muted-foreground">No rooms yet.</p>
            <Button asChild className="mt-4"><Link to="/create">Create your first room</Link></Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to="/room/$roomId" params={{ roomId: r.id }} className="panel flex items-center gap-3 p-4 hover:border-primary">
                  <span className="font-display text-xl font-bold text-primary">{r.format}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name}</div>
                    <div className="text-xs text-muted-foreground">Code {r.code} · {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className="text-xs uppercase text-muted-foreground">{statusLabel[r.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
