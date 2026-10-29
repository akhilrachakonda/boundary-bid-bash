import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
const schema=z.object({roomId:z.string().uuid(),lineup:z.array(z.string().uuid()).length(11),captain:z.string().uuid(),vice:z.string().uuid()});
export const saveEvaluationLineup=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(schema).handler(async({data,context})=>{
 const r=await context.supabase.rpc('submit_evaluation_lineup',{p_room:data.roomId,p_lineup:data.lineup,p_captain:data.captain,p_vice:data.vice,p_auto:false});if(r.error)throw new Error(r.error.message);return {saved:true};
});
export const resetEvaluationLineup=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({roomId:z.string().uuid()})).handler(async({data,context})=>{
 const r=await context.supabase.rpc('submit_evaluation_lineup',{p_room:data.roomId,p_lineup:[],p_captain:'00000000-0000-0000-0000-000000000000',p_vice:'00000000-0000-0000-0000-000000000000',p_auto:true});if(r.error)throw new Error(r.error.message);return {saved:true};
});