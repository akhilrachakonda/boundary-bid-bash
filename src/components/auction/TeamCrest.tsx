import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
export function TeamCrest({ name, color, className }: { name: string; color: string; className?: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0,2).map(n => n[0]).join("");
  return <span className={cn("team-crest relative inline-grid h-10 w-10 shrink-0 place-items-center",className)} style={{color}} aria-hidden="true"><Shield className="absolute h-full w-full fill-current opacity-20"/><Shield className="absolute h-full w-full" strokeWidth={1.3}/><span className="font-display text-sm font-bold">{initials}</span></span>;
}