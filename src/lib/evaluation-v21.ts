import { evaluateXI, performance, type Evaluation, type MeasuredPlayer, type Aggregate } from './evaluation-v2';
import { isBowlingOption, isPacer, isSpinner, type Settings } from './auction-rules';

export const V21_WEIGHTS={combination:35,established:30,recent:20,bench:10,leadership:5};
export const POSITION_WEIGHTS={fit:12,legality:10,keeping:4,variety:3,phases:6};
export type PositionGroup='opening'|'top'|'middle'|'lower'|'tail';
export interface PositionEvidence { innings:number; balls:number; runs:number; dismissals:number; earliest:string|null; latest:string|null }
export interface Leadership { captain_rating:number; vice_captain_rating:number; status:string; rubric_version:string; confidence:number; cutoff:string; reviewer?:string; rationale:string; sources:{url:string;fact:string}[] }
export interface Player21 extends MeasuredPlayer { leadership?:Leadership }
export interface SubmittedLineup {lineup:string[];captain:string;vice_captain:string}
export interface Fit {id:string;slot:number;group:PositionGroup;fit:number;confidence:number;sample:number;status:string;points:number}
export interface Evaluation21 extends Evaluation { leadership:number; captain:string|null; viceCaptain:string|null; captainRating:number; viceCaptainRating:number; captainPoints:number; viceCaptainPoints:number; positions:Fit[]; lineupSource:string }
export const groupForSlot=(slot:number):PositionGroup=>slot<=2?'opening':slot===3?'top':slot<=5?'middle':slot<=7?'lower':'tail';
export function leadershipRating(p:Player21,kind:'captain'|'vice'):number {
 const l=p.leadership;if(l?.status!=='reviewed')return 50;
 return Math.max(0,Math.min(100,kind==='captain'?l.captain_rating:l.vice_captain_rating));
}
export function positionFit(p:Player21,slot:number):Omit<Fit,'points'> {
 const group=groupForSlot(slot);
 const a=p.evidence?.windows['history'] as (Aggregate&{position_groups?:Record<string,PositionEvidence>})|undefined;
 const groups=a?.position_groups;const sample=Object.values(groups??{}).reduce((s,g)=>s+g.innings,0);
 const count=groups?.[group]?.innings??0;const peak=Math.max(0,...Object.values(groups??{}).map(g=>g.innings));
 const confidence=sample/(sample+12);
 // Position usage, not batting ability: no runs/SR reused here. Tail bowling slots are structurally appropriate.
 if(group==='tail'&&p.role==='BOWL')return {id:p.id,slot,group,fit:80,confidence:0,sample,status:'Bowler tail slot appropriate; structural check, not batting performance'};
 const fit=peak?50+30*(2*count/peak-1)*confidence:50;
 return {id:p.id,slot,group,fit,confidence,sample,status:!peak?'Unproven / neutral position prior':count===0?'Not observed here; bounded usage fit, not inability':`${count} observed innings in this group`};
}
export function orderAutomatically(players:Player21[]):Player21[] {
 // Same deterministic greedy assignment followed by improving swaps, not a globally optimal lineup.
 const pool=[...players].sort((a,b)=>a.id.localeCompare(b.id));const ordered:Player21[]=[];
 for(let slot=1;pool.length;slot++){pool.sort((a,b)=>positionFit(b,slot).fit-positionFit(a,slot).fit||a.id.localeCompare(b.id));const p=pool.shift();if(p)ordered.push(p);}
 const value=(ps:Player21[])=>ps.reduce((s,p,i)=>s+positionFit(p,i+1).fit*(i<7?1:.25),0);
 let improved=true;let passes=0;
 while(improved&&passes++<11){improved=false;for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){const a=ordered[i],b=ordered[j];if(!a||!b)continue;const next=[...ordered];next[i]=b;next[j]=a;if(value(next)>value(ordered)+1e-9){ordered.splice(0,ordered.length,...next);improved=true;}}}
 return ordered;
}
export function validateLineup(line:SubmittedLineup,squad:Player21[],settings:Settings,format:string):string[] {
 const ids=new Set(squad.map(p=>p.id));const errors:string[]=[];
 if(line.lineup.length!==11||new Set(line.lineup).size!==11||line.lineup.some(id=>!ids.has(id)))errors.push('XI must contain 11 distinct current squad players');
 if(line.captain===line.vice_captain||!line.lineup.includes(line.captain)||!line.lineup.includes(line.vice_captain))errors.push('Captain and vice-captain must be two distinct XI players');
 const xi=line.lineup.map(id=>squad.find(p=>p.id===id)).filter((p):p is Player21=>!!p);
 if(!xi.some(p=>p.role==='WK'))errors.push('A wicketkeeper is required');
 if(xi.filter(isBowlingOption).length<5)errors.push('Five bowling options are required');
 if(xi.filter(p=>p.nationality_type==='Overseas').length>Math.min(settings.max_overseas,format==='IPL'?4:11))errors.push('Overseas XI limit exceeded');
 return errors;
}
export function evaluateAssigned(xi:Player21[],squad:Player21[],settings:Settings,format:string,cohorts:Record<string,Aggregate>,captain:string|null,vice:string|null,source='Automatic'):Evaluation21 {
 const base=evaluateXI(xi,squad,settings,format,cohorts);
 const captainPlayer=xi.find(p=>p.id===captain),vicePlayer=xi.find(p=>p.id===vice);
 const leadershipValid=!!captainPlayer&&!!vicePlayer&&captain!==vice;
 const c=leadershipValid&&captainPlayer?leadershipRating(captainPlayer,'captain'):0;
 const v=leadershipValid&&vicePlayer?leadershipRating(vicePlayer,'vice'):0;
 const captainPoints=3*c/100,viceCaptainPoints=2*v/100,leadership=captainPoints+viceCaptainPoints;
 const positions=xi.map((p,i)=>({...positionFit(p,i+1),points:positionFit(p,i+1).fit/100*12*(i<7?1:.25)/8}));
 const phaseChecks=base.checks.filter(c=>c.label.startsWith('Observed '));
 const checks=[{label:'Legal 11 unique players, overseas cap and feasible capped 20/50-over workload',met:base.eligible,points:base.eligible?10:0,maximum:10},{label:'Wicketkeeping covered',met:xi.some(p=>p.role==='WK'),points:xi.some(p=>p.role==='WK')?4:0,maximum:4},{label:'Assigned batting-position usage fit (bounded, shrunk; no ability double-count)',met:xi.length===11,points:positions.reduce((s,p)=>s+p.points,0),maximum:12},{label:'Pace/spin complementarity',met:xi.some(isPacer)&&xi.some(isSpinner),points:xi.some(isPacer)&&xi.some(isSpinner)?3:0,maximum:3},...phaseChecks.map(c=>({...c,points:c.met?2:0,maximum:2}))];
 const combinationPoints=checks.reduce((s,c)=>s+c.points,0);
 return {...base,total:Math.max(0,Math.min(100,combinationPoints+base.established*.3+base.recent*.2+base.bench*.1+leadership)),combination:combinationPoints/35*100,eligible:base.eligible&&leadershipValid,provisional:base.provisional||xi.some(p=>p.leadership?.status!=='reviewed')||positions.some(p=>p.sample<12),lineup:xi.map(p=>p.id),xi:xi.map(p=>p.id),checks,leadership,captain,viceCaptain:vice,captainRating:c,viceCaptainRating:v,captainPoints,viceCaptainPoints,positions,lineupSource:source,reasons:[...base.reasons,...(!leadershipValid?['Captain/vice-captain are not two eligible distinct XI players']:[])],solver:'Deterministic subset search through 14; measured 14-candidate shortlist above 14, keeper/bowling reservations; greedy position assignment + improving swaps (approximate, not globally best)'};
}
function autoEvaluate(xi:Player21[],squad:Player21[],s:Settings,f:string,c:Record<string,Aggregate>):Evaluation21 {
 const ordered=orderAutomatically(xi);
 let pair:{c:Player21;v:Player21;points:number}|null=null;
 for(const captain of ordered)for(const vice of ordered){if(captain.id===vice.id)continue;const points=3*leadershipRating(captain,'captain')/100+2*leadershipRating(vice,'vice')/100;if(!pair||points>pair.points)pair={c:captain,v:vice,points};}
 return evaluateAssigned(ordered,squad,s,f,c,pair?.c.id??null,pair?.v.id??null);
}
export function optimizeTeam21(squad:Player21[],settings:Settings,format:string,cohorts:Record<string,Aggregate>,submitted?:SubmittedLineup|null):Evaluation21 {
 const unique=[...new Map(squad.map(p=>[p.id,p])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 if(submitted&&validateLineup(submitted,unique,settings,format).length===0){const lineup=submitted.lineup.map(id=>unique.find(p=>p.id===id)).filter((p):p is Player21=>!!p);return evaluateAssigned(lineup,unique,settings,format,cohorts,submitted.captain,submitted.vice_captain,'Public submitted lineup');}
 const fallback=submitted?'Submitted lineup invalid after squad change; automatic recomputation':'Automatic';
 if(unique.length<=11){const result=autoEvaluate(unique,unique,settings,format,cohorts);return {...result,lineupSource:fallback};}
 let candidates=unique;
 if(unique.length>14){candidates=[...unique].sort((a,b)=>(performance(b,'established',cohorts).score+performance(b,'recent',cohorts).score)-(performance(a,'established',cohorts).score+performance(a,'recent',cohorts).score)||a.id.localeCompare(b.id)).slice(0,14);const required=[unique.find(p=>p.role==='WK'),...unique.filter(isBowlingOption).slice(0,5)].filter((p):p is Player21=>!!p);for(const p of required)if(!candidates.some(c=>c.id===p.id)){const index=candidates.map((c,i)=>({c,i})).reverse().find(x=>!required.some(r=>r.id===x.c.id))?.i;if(index!==undefined)candidates[index]=p;}candidates.sort((a,b)=>a.id.localeCompare(b.id));}
 let best:Evaluation21|null=null;
 function choose(start:number,selected:Player21[]){if(selected.length===11){const r=autoEvaluate(selected,unique,settings,format,cohorts);if(!best||(r.eligible&&!best.eligible)||(r.eligible===best.eligible&&r.total>best.total))best=r;return;}for(let i=start;i<=candidates.length-(11-selected.length);i++){const p=candidates[i];if(p)choose(i+1,[...selected,p]);}}
 choose(0,[]);const result:Evaluation21=best??autoEvaluate(unique.slice(0,11),unique,settings,format,cohorts);return {...result,lineupSource:fallback};
}