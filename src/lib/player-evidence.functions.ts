import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {performance,type Evidence,type Aggregate} from './evaluation-v2';
import {type Player21,type Leadership,positionFit} from './evaluation-v21';
import type {Player} from './auction-rules';
export const getPlayerMeasures=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({playerId:z.string().uuid(),roomId:z.string().uuid().optional()})).handler(async({data,context})=>{
 let player:Player21|undefined;let sid:string|null=null;let isFrozen=false;
 if(data.roomId){const r=await context.supabase.rpc('room_projection',{p_room:data.roomId});if(r.error)throw new Error('Room membership required');const projection=r.data as unknown as {pool:{player:Player21}[];room:{evaluation_snapshot:string|null;status:string}};player=projection.pool.find(x=>x.player.id===data.playerId)?.player;sid=projection.room.evaluation_snapshot;isFrozen=projection.room.status!=='lobby';if(!isFrozen)sid=(await context.supabase.from('evaluation_snapshots').select('id').eq('status','validated').order('imported_at',{ascending:false}).limit(1).maybeSingle()).data?.id??null;}
 else{player=(await context.supabase.from('players').select('*').eq('id',data.playerId).maybeSingle()).data as Player|undefined;sid=(await context.supabase.from('evaluation_snapshots').select('id').eq('status','validated').order('imported_at',{ascending:false}).limit(1).maybeSingle()).data?.id??null;}
 if(!player)return null;
 const snapshot=sid?(await context.supabase.from('evaluation_snapshots').select('*').eq('id',sid).single()).data:null;
 const row=sid?(await context.supabase.from('evidence_players').select('stats').eq('snapshot_id',sid).eq('identity_key',player.name+'|'+player.country).maybeSingle()).data:null;
 const positions=sid?(await context.supabase.from('evidence_positions').select('groups').eq('snapshot_id',sid).eq('identity_key',player.name+'|'+player.country).eq('format',player.format).maybeSingle()).data:null;
 const evidence=(row?.stats as unknown as Record<string,Evidence>|undefined)?.[player.format];
 if(evidence)player={...player,evidence:{...evidence,windows:{...evidence.windows,history:{...evidence.windows['history'],position_groups:positions?.groups??{}} as Aggregate}}};
 let leadership=player.leadership;
 if(!isFrozen)leadership=(await context.supabase.from('leadership_reviews').select('*').eq('player_id',player.id).order('created_at',{ascending:false}).limit(1).maybeSingle()).data as unknown as Leadership|undefined;
 leadership??={captain_rating:50,vice_captain_rating:50,status:'unrated',rubric_version:'leadership-1',confidence:0,cutoff:snapshot?.cutoff??'',rationale:'Unrated / neutral prior — no owner-reviewed leadership game rating',sources:[]};
 const cohorts=(snapshot?.cohorts??{}) as unknown as Record<string,Aggregate>;
 const batting={...player,role:'BAT'},bowling={...player,role:'BOWL'};
 const roleCohorts={...cohorts,[`${player.format}|established|BAT`]:cohorts[`${player.format}|established|${player.role}`],[`${player.format}|recent|BAT`]:cohorts[`${player.format}|recent|${player.role}`],[`${player.format}|established|BOWL`]:cohorts[`${player.format}|established|${player.role}`],[`${player.format}|recent|BOWL`]:cohorts[`${player.format}|recent|${player.role}`]} as Record<string,Aggregate>;
 return {cutoff:snapshot?.cutoff??null,evidence:player.evidence??null,leadership,positions:[1,3,4,6,8].map(slot=>positionFit(player,slot)),positionGroups:positions?.groups??{},batting:performance(batting,'established',roleCohorts),bowling:performance(bowling,'established',roleCohorts),recent:performance(player,'recent',cohorts),frozen:isFrozen};
});