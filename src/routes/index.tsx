import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { AuctionDemo } from "@/components/auction/AuctionDemo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cricket Auction — Live player auctions with friends" },
      { name: "description", content: "Create a room, invite friends, and bid live for IPL, T20 and ODI players. Trade, build your XI and crown a champion." },
      { property: "og:title", content: "Cricket Auction — Live player auctions with friends" },
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
      <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <section className="landing-masthead"><div><p className="mb-3 text-xs font-semibold uppercase text-electric">Your friends. Your franchise. Your auction.</p><h1>Cricket <span className="text-gold">Auction</span></h1><p className="mt-4 max-w-xl text-base text-muted-foreground">Build the squad. Win the bidding war. Take the trophy.</p></div><div className="landing-actions flex shrink-0 gap-3"><Button asChild size="lg" className="h-12 bg-gold text-primary-foreground"><Link to="/create">Create room<ArrowRight className="h-4 w-4"/></Link></Button><Button asChild size="lg" variant="outline" className="h-12"><Link to="/join" search={{code:""}}><Users className="h-4 w-4"/>Join room</Link></Button></div></section>
        <AuctionDemo/>
        <div className="landing-footer-strip"><p className="font-display text-2xl font-bold uppercase">150 players. <span className="text-electric">Three formats.</span> One champion.</p><div className="flex items-center gap-6 text-sm text-muted-foreground"><span>IPL · T20 · ODI</span><span>2–10 teams</span><Trophy className="h-5 w-5 text-primary"/></div></div>
      </main>
    </div>
  );
}
