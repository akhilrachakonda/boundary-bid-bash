import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Search {
  redirect?: string | undefined;
  mode?: "link" | undefined;
}

const safePath = (p?: string) => {
  if (!p) return "/create";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/create";
  } catch {
    return "/create";
  }
};

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
    mode: s["mode"] === "link" ? "link" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Gavel Cricket Auction" },
      { name: "description", content: "Jump in as a guest with a nickname, or use your email to keep your rooms across devices." },
      { property: "og:title", content: "Sign in — Gavel Cricket Auction" },
      { property: "og:description", content: "Play as a guest or sign in with email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isGuest, loading } = useAuth();
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    setNick(localStorage.getItem("auction-nick") ?? "");
  }, []);

  useEffect(() => {
    if (!loading && user && mode !== "link") navigate({ to: safePath(redirect) as "/" });
  }, [user, loading, mode, redirect, navigate]);

  const guest = async () => {
    if (!nick.trim()) { toast.error("Pick a nickname"); return; }
    setBusy(true);
    localStorage.setItem("auction-nick", nick.trim());
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { nickname: nick.trim() } } });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const emailLink = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    const target = window.location.origin + safePath(redirect);
    const { error } =
      mode === "link" && isGuest
        ? await supabase.auth.updateUser({ email }, { emailRedirectTo: target })
        : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: target } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(email);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-md gap-4 px-4 py-12">
        <h1 className="text-center text-5xl font-extrabold uppercase">
          {mode === "link" ? "Save your account" : <>Take your <span className="text-gold">seat</span></>}
        </h1>
        {mode !== "link" && (
          <div className="panel space-y-3 p-5">
            <div className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4 text-primary" /> Play as guest</div>
            <Label htmlFor="nick">Nickname</Label>
            <Input id="nick" value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Captain Cool" onKeyDown={(e) => e.key === "Enter" && guest()} />
            <Button className="h-12 w-full bg-gold text-base font-bold text-primary-foreground" onClick={guest} disabled={busy}>
              Continue as guest
            </Button>
            <p className="text-xs text-muted-foreground">Your guest account stays on this device. Add an email later to keep it.</p>
          </div>
        )}
        <div className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Mail className="h-4 w-4 text-electric" /> {mode === "link" ? "Attach an email to this guest account" : "Use email (works on any device)"}
          </div>
          {sent ? (
            <p className="text-sm">Check <b>{sent}</b> for a sign-in link. Open it on this device to continue.</p>
          ) : (
            <>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={(e) => e.key === "Enter" && emailLink()} />
              <Button variant="outline" className="h-12 w-full" onClick={emailLink} disabled={busy}>
                {mode === "link" ? "Send confirmation link" : "Email me a sign-in link"}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
