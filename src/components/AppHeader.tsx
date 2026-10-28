import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { user, isAdmin, isGuest } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-xl font-bold uppercase" aria-label="Cricket Auction home">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <span className="leading-[0.9]">Cricket<br/><span className="text-primary">Auction</span></span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        {user ? (
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/history">My rooms</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="icon" aria-label="Admin">
                <Link to="/admin"><Shield className="h-4 w-4" /></Link>
              </Button>
            )}
            {isGuest && (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth" search={{ mode: "link" }}>Save account</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                if (isGuest && !confirm("Guest accounts can't be recovered after signing out. Sign out anyway?")) return;
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
