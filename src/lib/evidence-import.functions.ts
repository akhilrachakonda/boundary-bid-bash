import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import type {Json} from '@/integrations/supabase/types';
const bundleSchema=z.object({snapshot:z.object({id:z.uuid(),version:z.literal('v2.0'),cutoff:z.iso.date(),provenance:z.record(z.string(),z.unknown()),coverage:z.record(z.string(),z.unknown()),cohorts:z.record(z.string(),z.unknown())}),players:z.array(z.object({identity_key:z.string(),source_player_id:z.string().nullable(),name:z.string(),country:z.string(),mapping:z.record(z.string(),z.unknown()),stats:z.record(z.string(),z.unknown())})).min(1).max(500),matches:z.array(z.object({source_id:z.string(),competition:z.enum(['IPL','T20I','ODI']),played_on:z.iso.date(),revision:z.number().int().nonnegative(),content_hash:z.string().regex(/^[0-9a-f]{64}$/),info:z.record(z.string(),z.unknown())})).min(1).max(30000)});
export const importEvidence=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>bundleSchema.parse(data)).handler(async({data,context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!role.data)throw new Error('Only the owner can import evidence');
 if(new Set(data.matches.map(m=>m.source_id)).size!==data.matches.length)throw new Error('Duplicate match IDs');
 if(new Set(data.players.map(p=>p.identity_key)).size!==data.players.length)throw new Error('Duplicate player identities');
 for(const match of data.matches){if(match.played_on>data.snapshot.cutoff)throw new Error('Match date exceeds cutoff');}
 // Importer-computed aggregates must be numeric nonnegative and consistent, not rating fields.
 for(const p of data.players){for(const [format,value] of Object.entries(p.stats)){if(!['IPL','T20','ODI'].includes(format))throw new Error('Unexpected format');const e=value as {windows?:Record<string,Record<string,unknown>>};for(const a of Object.values(e.windows??{})){for(const key of ['runs','balls','dismissals','innings','legal_balls','conceded','wickets']){const n=a[key];if(typeof n!=='number'||!Number.isFinite(n)||n<0)throw new Error('Invalid aggregate '+key);}if('rating' in a)throw new Error('Ratings cannot be evidence');}}}
 const r=await context.supabase.rpc('import_evidence_bundle',{p_bundle:data as unknown as Json});if(r.error)throw new Error(r.error.message);return r.data;
});
