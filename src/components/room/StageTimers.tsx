import {useState} from 'react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {minutesValid} from '@/lib/community';
import type {RoomData} from '@/components/auction/derive';
import {rpc} from './rpc';
import {toast} from 'sonner';
export function StageTimers({data}:{data:RoomData}){
 const room=data.room!;const [trade,setTrade]=useState(String(room.settings.trade_minutes??10)),[lineup,setLineup]=useState(String(room.settings.lineup_minutes??5)),[busy,setBusy]=useState(false);
 return <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3"><label className="space-y-1 text-sm">Trade minutes<Input aria-label="Trade minutes" inputMode="numeric" value={trade} onChange={e=>setTrade(e.target.value)} className="w-24"/></label><label className="space-y-1 text-sm">Playing XI minutes<Input aria-label="Playing XI minutes" inputMode="numeric" value={lineup} onChange={e=>setLineup(e.target.value)} className="w-24"/></label><Button variant="outline" disabled={busy||!minutesValid(trade)||!minutesValid(lineup)} onClick={async()=>{setBusy(true);try{if(await rpc('community_control',{p_room:room.id,p_action:'timers',p_status:room.status,p_phase:room.post_phase??null,p_payload:{trade_minutes:Number(trade),lineup_minutes:Number(lineup)}})){toast.success('Timers saved');await data.reload('rooms');}}finally{setBusy(false);}}}>Save timers</Button><p className="w-full text-xs text-muted-foreground">1–120 minutes. During an open timed stage, saving resets its remaining time to the entered duration.</p></div>;
}
