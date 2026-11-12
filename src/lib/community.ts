export interface MatchPlan {batting_order:string[];bowling_overs:Record<string,number>;batting_phases:Record<string,{from:number;to:number}>;confirmed?:boolean;participant_id?:string}
export interface TeamVote {target:string;top_order:number;middle_finishing:number;bowling:number}
export interface PeerResult {participant_id:string;voters:number;top_order:number|null;middle_finishing:number|null;bowling:number|null;overall:number|null}
export interface CommunityState {phase:'lineup'|'rating'|'done';deadline:string|null;lineups:MatchPlan[];confirmed:string[];my_votes:TeamVote[];votes_received:number;results:PeerResult[]}
export const inningsOvers=(format:string)=>format==='ODI'?50:20;
export function battingPhase(position:number,format:string){const odi=format==='ODI';return position<3?{from:1,to:odi?10:6}:position<6?{from:odi?11:7,to:odi?40:15}:{from:odi?41:16,to:odi?50:20};}
export function planErrors(plan:MatchPlan,owned:string[],format:string){
 const total=inningsOvers(format),cap=total/5,errors:string[]=[];
 if(plan.batting_order.length!==Math.min(11,owned.length))errors.push(`Select ${Math.min(11,owned.length)} players from your squad.`);
 if(new Set(plan.batting_order).size!==plan.batting_order.length||plan.batting_order.some(id=>!owned.includes(id)))errors.push('Choose distinct players you own.');
 if(plan.batting_order.some(id=>!Number.isInteger(plan.bowling_overs[id]??0)||(plan.bowling_overs[id]??0)<0||(plan.bowling_overs[id]??0)>cap))errors.push(`Assign 0–${cap} whole bowling overs to each player.`);
 const sum=plan.batting_order.reduce((n,id)=>n+(plan.bowling_overs[id]??0),0),expected=Math.min(total,cap*plan.batting_order.length);
 if(sum!==expected)errors.push(`Allocate ${expected} bowling overs (${sum} assigned).`);
 if(plan.batting_order.some(id=>{const v=plan.batting_phases[id];return !v||!Number.isInteger(v.from)||!Number.isInteger(v.to)||v.from<1||v.to<v.from||v.to>total;}))errors.push('Set valid batting-over ranges for every selected player.');
 return errors;
}
export function minutesValid(value:string){return /^\d{1,3}$/.test(value)&&Number(value)>=1&&Number(value)<=120;}
