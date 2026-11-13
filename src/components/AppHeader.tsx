import {useState} from "react";
import {Sheet,SheetContent,SheetTitle,SheetDescription} from "@/components/ui/sheet";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Shield, CircleHelp, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { user, isAdmin, isGuest } = useAuth();
  const navigate = useNavigate();
  const [menu,setMenu]=useState(false);
  const signOut=async()=>{if(isGuest&&!confirm("Guest accounts can't be recovered after signing out. Sign out anyway?"))return;await supabase.auth.signOut();navigate({to:'/auth',replace:true});};
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-xl font-bold uppercase" aria-label="Cricket Auction home">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <span className={children?"hidden leading-[0.9] sm:block":"leading-[0.9]"}>Cricket<br/><span className="text-primary">Auction</span></span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        <Button asChild className="hidden sm:inline-flex" variant="ghost" size="icon" aria-label="Team ratings and game rules"><Link to="/scoring"><CircleHelp className="h-4 w-4" /></Link></Button>
        {user ? (
          <div className="hidden items-center gap-1 sm:flex">
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
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="shrink-0 sm:hidden" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu className="h-5 w-5"/></Button>
        <Sheet open={menu} onOpenChange={setMenu}><SheetContent className="w-full max-w-sm overflow-y-auto"><SheetTitle>Cricket Auction</SheetTitle><SheetDescription>Rooms, rules and your account</SheetDescription><nav className="mt-6 grid gap-2" onClick={()=>setMenu(false)}>
          <Button asChild variant="outline" className="justify-start"><Link to="/">Home</Link></Button>
          <Button asChild variant="outline" className="justify-start"><Link to="/scoring">Game rules & ratings</Link></Button>
          {user&&<Button asChild variant="outline" className="justify-start"><Link to="/history">My rooms</Link></Button>}
          {isAdmin&&<Button asChild variant="outline" className="justify-start"><Link to="/admin">Admin</Link></Button>}
          {isGuest&&<Button asChild variant="outline" className="justify-start"><Link to="/auth" search={{mode:'link'}}>Save account</Link></Button>}
          {user&&<Button variant="ghost" className="justify-start" onClick={signOut}><LogOut className="h-4 w-4"/>Sign out</Button>}
        </nav></SheetContent></Sheet>
      </div>
    </header>
  );
}
