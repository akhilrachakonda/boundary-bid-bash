import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { optimizeTeam, rankEvaluations, type Aggregate, type Evidence, type MeasuredPlayer } from './evaluation-v2';
import type { Settings } from './auction-rules';
import type { Json } from '@/integrations/supabase/types';

export const getRoomEvaluation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{roomId:string})=>input).handler(async({data,context})=>{
 const projection=await context.supabase.rpc('room_projection',{p_room:data.roomId});
 if(projection.error)throw new Error('You must be a room member');
 const room=(projection.data as unknown as {room:{status:string;evaluation_version:string;format:string;settings:Settings}}).room;
 if(room.evaluation_version!=='v2.0')return null;
 const stored=await context.supabase.from('room_evaluations').select('result').eq('room_id',data.roomId).maybeSingle();
 if(stored.data)return stored.data.result;
 const input=await context.supabase.from('room_evaluation_inputs').select('*').eq('room_id',data.roomId).single();
 if(input.error)throw new Error('Scoring inputs are not frozen yet');
 const sid=input.data.snapshot_id;
 const snapshot=sid?(await context.supabase.from('evaluation_snapshots').select('*').eq('id',sid).single()).data:null;
 const evidence=sid?(await context.supabase.from('evidence_players').select('*').eq('snapshot_id',sid)).data??[]:[];
 const holdings=await context.supabase.from('squads').select('participant_id,player_id').eq('room_id',data.roomId);
 const teams=await context.supabase.from('participants').select('id').eq('room_id',data.roomId);
 const hash=await context.supabase.rpc('evaluation_holdings_hash',{p_room:data.roomId});if(hash.error)throw new Error('Could not verify final holdings');
 const facts=input.data.player_facts as unknown as MeasuredPlayer[];
 const measured=facts.map(p=>{const e=evidence.find(e=>e.identity_key===p.name+'|'+p.country);const stats=e?.stats as unknown as Record<string,Evidence>|undefined;return {...p,...(stats?.[room.format]?{evidence:stats[room.format]}:{})};});
 const cohorts=(snapshot?.cohorts??{}) as unknown as Record<string,Aggregate>;
 const settings=(input.data.rules as unknown as {settings:Settings}).settings;
 const result={version:'v2.0',cutoff:snapshot?.cutoff??null,coverage:snapshot?.coverage??null,attribution:'Available Cricsheet matches • ODC-By 1.0 • coverage incomplete',teams:rankEvaluations((teams.data??[]).map(t=>({id:t.id,score:optimizeTeam(measured.filter(p=>(holdings.data??[]).some(s=>s.participant_id===t.id&&s.player_id===p.id)),settings,room.format,cohorts)})))};
 if(room.status!=='results')return result as unknown as Json;
 // Membership verified above; service access is used only to commit trusted calculated output.
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const committed=await supabaseAdmin.rpc('commit_room_evaluation',{p_room:data.roomId,p_snapshot:sid as string,p_hash:hash.data,p_result:result as unknown as Json});
 if(committed.error)throw new Error('Final holdings changed or results could not be saved; retry');
 return committed.data;
});
