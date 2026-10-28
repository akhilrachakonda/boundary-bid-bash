import { createFileRoute, Link } from "@tanstack/react-router";
import { Gavel, Radio, Repeat, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gavel — Live Multiplayer Cricket Player Auction" },
      { name: "description", content: "Create a room, invite friends, and bid live for IPL, T20 and ODI players. Trade, build your XI and crown a champion." },
      { property: "og:title", content: "Gavel — Live Multiplayer Cricket Player Auction" },
      { property: "og:description", content: "Bid live for cricketers with friends, IPL-auction style." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:pt-20">
        <section className="text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Radio className="h-3 w-3 animate-pulse" /> Live auction rooms
          </p>
          <h1 className="font-display text-6xl font-extrabold uppercase leading-[0.9] sm:text-8xl">
            Going once.<br />
            <span className="text-gold">Going twice.</span>
            <br />
            Sold.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Run your own IPL-style auction with friends anywhere. 450+ players across IPL, T20 and ODI, live bidding, trades and a final team showdown.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-14 bg-gold px-8 text-lg font-bold text-primary-foreground shadow-glow">
              <Link to="/create"><Gavel className="h-5 w-5" /> Create room</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg">
              <Link to="/join" search={{ code: "" }}><Users className="h-5 w-5" /> Join with code</Link>
            </Button>
          </div>
        </section>
        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Radio, t: "Live bidding", d: "Server-checked bids and a shared countdown, so everyone sees the same thing at the same moment." },
            { icon: Repeat, t: "Trade window", d: "Swap players and cash after the hammer falls. Every trade is checked against squad rules." },
            { icon: Trophy, t: "Crown a champion", d: "Team ratings for XI strength, balance, bench depth, combinations and budget." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="panel p-6">
              <I className="h-6 w-6 text-electric" />
              <h3 className="mt-3 text-2xl font-bold uppercase">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
