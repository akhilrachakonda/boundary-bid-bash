import {useEffect} from 'react';
import {Check,LockKeyhole,Volume2} from 'lucide-react';
import {IPL_TEAMS} from '@/lib/ipl-teams';
import {playCelebration,stopCelebration} from '@/lib/sound';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';

export function IplTeamPicker({value,onChange,taken=[],disabled=false}:{value:string;onChange:(code:string)=>void;taken?:string[];disabled?:boolean}) {
 useEffect(()=>()=>stopCelebration(),[]);
 const selected=IPL_TEAMS.find(t=>t.code===value);
 return <fieldset className="min-w-0 space-y-3" disabled={disabled}>
  <legend className="mb-1 font-semibold">Choose your IPL team</legend>
  <p className="text-xs text-muted-foreground">First come, first served. Your team is reserved when you create or join the room. In the lobby, a team change is reserved immediately.</p>
  <div className="grid grid-cols-2 gap-2" role="group" aria-label="IPL teams">
   {IPL_TEAMS.map(t=>{const unavailable=taken.includes(t.code)&&value!==t.code;return <button type="button" key={t.code} aria-pressed={value===t.code} disabled={disabled||unavailable} onClick={()=>onChange(t.code)} className={cn('flex min-h-20 min-w-0 items-center gap-2 rounded-xl border p-3 text-left transition touch-manipulation disabled:opacity-45',value===t.code?'border-primary bg-primary/10 ring-1 ring-primary':'bg-background/30 hover:bg-secondary')}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-extrabold" style={{color:t.color,borderColor:t.color}}>{t.code}</span>
    <span className="min-w-0 flex-1"><span className="block break-words text-xs font-semibold leading-snug">{t.name}</span><span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">{unavailable?<><LockKeyhole className="h-3 w-3"/>Taken</>:value===t.code?<><Check className="h-3 w-3"/>Selected</>:'Available'}</span></span>
   </button>;})}
  </div>
  {selected&&<div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={()=>playCelebration('sold',selected.code)}><Volume2 className="h-4 w-4"/>Hear {selected.code} sound</Button><span className="text-xs text-muted-foreground">Enable room sounds to hear it when you win a player.</span></div>}
 </fieldset>;
}
