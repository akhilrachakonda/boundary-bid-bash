import { isBowlingOption, isPacer, isSpinner, type Player, type Settings } from './auction-rules';
export const VERSION='v2.0';
export const WEIGHTS={combination:40,established:30,recent:20,bench:10} as const;
export interface Aggregate { runs:number; balls:number; dismissals:number; innings:number; catches:number; stumpings:number; legal_balls:number; conceded:number; wickets:number; positions:Record<string,number>; phases:Record<string,Aggregate>; metrics:Record<string,number|null> }
export interface Evidence { latest:string|null; earliest:string|null; windows:Record<string,Aggregate> }
export interface MeasuredPlayer extends Player { evidence?:Evidence; identity_key?:string }
export interface MetricPoint { metric:string; raw:number|null; normalized:number; weight:number; points:number; sample:number; confidence:number; cohort:number|null; fallback:boolean }
export interface Contribution { id:string; established:number; recent:number; confidence:number; metrics:Record<string,MetricPoint[]>; latest:string|null }
export interface Evaluation { total:number; eligible:boolean; provisional:boolean; combination:number; established:number; recent:number; bench:number; xi:string[]; lineup:string[]; overs:{id:string;overs:number;phases:Record<string,number>}[]; checks:{label:string;met:boolean;points:number;maximum:number}[]; contributions:Contribution[]; reasons:string[]; benched:{id:string;reason:string}[]; confidence:number; solver:string }
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
/** Same format/role pooled-rate prior, deterministic empirical shrinkage. */
export function metric(raw:number|null,sample:number,cohort:number|null,prior:number,invert:boolean,weight:number,name:string):MetricPoint {
 const confidence=sample/(sample+prior);const fallback=raw==null||cohort==null||cohort<=0;
 const normalized=fallback?50:clamp(50+50*((invert?cohort/Math.max(raw,0.000001):raw/cohort)-1)*confidence);
 return {metric:name,raw,normalized,weight,points:normalized*weight,sample,confidence,fallback,cohort};
}
export function performance(p:MeasuredPlayer,window:string,cohorts:Record<string,Aggregate>):{score:number;metrics:MetricPoint[];confidence:number} {
 const a=p.evidence?.windows[window];const c=cohorts[`${p.format}|${window}|${p.role}`];
 const batting=[metric(a?.metrics["sr"]??null,a?.balls??0,c?.metrics["sr"]??null,120,false,.5,'Batting strike rate'),metric(a?.metrics["average"]??null,a?.dismissals??0,c?.metrics["average"]??null,12,false,.5,'Batting average')];
 const bowling=[metric(a?.metrics["economy"]??null,a?.legal_balls??0,c?.metrics["economy"]??null,180,true,.5,'Bowling economy'),metric(a?.metrics["bowling_sr"]??null,a?.wickets??0,c?.metrics["bowling_sr"]??null,12,true,.5,'Bowling strike rate')];
 const metrics=p.role==='BOWL'?bowling:p.role==='AR'?[...batting,...bowling].map(m=>({...m,weight:m.weight/2,points:m.points/2})):batting;
 return {score:metrics.reduce((sum,m)=>sum+m.points,0),metrics,confidence:metrics.reduce((sum,m)=>sum+m.confidence*m.weight,0)};
}
export function evaluateXI(xi:MeasuredPlayer[],squad:MeasuredPlayer[],settings:Settings,format:string,cohorts:Record<string,Aggregate>):Evaluation {
 const maxOverseas=Math.min(settings.max_overseas,format==='IPL'?4:11);const bowlers=xi.filter(isBowlingOption);const cap=format==='ODI'?10:4;const totalOvers=format==='ODI'?50:20;
 const unique=new Set(xi.map(p=>p.id)).size===xi.length;
 const keeper=xi.some(p=>p.role==='WK');const workload=bowlers.length*cap>=totalOvers;
 const overseas=xi.filter(p=>p.nationality_type==='Overseas').length<=maxOverseas;
 const valid=xi.length===11&&unique&&keeper&&workload&&overseas;
 const history=(p:MeasuredPlayer)=>p.evidence?.windows["history"];
 const positional=(lo:number,hi:number)=>xi.filter(p=>Object.entries(history(p)?.positions??{}).some(([slot,count])=>Number(slot)>=lo&&Number(slot)<=hi&&count>=5)).length;
 const phaseEvidence=(phase:string)=>bowlers.some(p=>(history(p)?.phases[phase]?.legal_balls??0)>=180&&(history(p)?.phases[phase]?.wickets??0)>=5);
 const checks=[{label:'11 unique players, keeper, overseas limit and feasible workload',met:valid,maximum:40},{label:'At least two observed opening/top-order options (positions 1–3, ≥5 innings)',met:positional(1,3)>=2,maximum:15},{label:'Two middle-order options (positions 4–6, ≥5 innings)',met:positional(4,6)>=2,maximum:10},{label:'A lower-order option (positions 6–8, ≥5 innings)',met:positional(6,8)>=1,maximum:5},{label:'Pace and spin variety',met:xi.some(isPacer)&&xi.some(isSpinner),maximum:10},...['powerplay','middle','death'].map(phase=>({label:`Observed ${phase} bowling workload (≥180 legal balls, ≥5 wickets; not a specialist claim)`,met:phaseEvidence(phase),maximum:20/3}))].map(c=>({...c,points:c.met?c.maximum:0}));
 const combination=checks.reduce((sum,c)=>sum+c.points,0);
 const contributions=xi.map(p=>{const established=performance(p,'established',cohorts),recent=performance(p,'recent',cohorts);return {id:p.id,established:established.score,recent:recent.score,confidence:(established.confidence+recent.confidence)/2,metrics:{established:established.metrics,recent:recent.metrics},latest:p.evidence?.latest??null};});
 const established=contributions.reduce((sum,p)=>sum+p.established,0)/11;
 const recent=contributions.reduce((sum,p)=>sum+p.recent,0)/11;
 const benchPlayers=squad.filter(p=>!xi.some(x=>x.id===p.id));
 const replacements=['WK','BAT','AR','BOWL'].map(role=>{const options=benchPlayers.filter(p=>p.role===role);return options.length?Math.max(...options.map(p=>(performance(p,'established',cohorts).score+performance(p,'recent',cohorts).score)/2)):0;});
 const bench=replacements.reduce((a,b)=>a+b,0)/4;
 const overs:Evaluation['overs']=[];let left=totalOvers;
 const phaseRemaining:Record<string,number>={powerplay:format==='ODI'?10:6,middle:format==='ODI'?30:10,death:format==='ODI'?10:4};
 for(const p of [...bowlers].sort((a,b)=>performance(b,'recent',cohorts).score-performance(a,'recent',cohorts).score||a.id.localeCompare(b.id))){const allocation=Math.min(cap,left);left-=allocation;const phases:Record<string,number>={};let remaining=allocation;for(const phase of ['powerplay','middle','death']){const n=Math.min(phaseRemaining[phase]??0,remaining);phases[phase]=n;phaseRemaining[phase]=(phaseRemaining[phase]??0)-n;remaining-=n;}if(allocation)overs.push({id:p.id,overs:allocation,phases});}
 const lineup=[...xi].sort((a,b)=>{const avg=(p:MeasuredPlayer)=>{const pos=Object.entries(history(p)?.positions??{});const n=pos.reduce((s,[,c])=>s+c,0);return n?pos.reduce((s,[k,c])=>s+Number(k)*c,0)/n:9;};return avg(a)-avg(b)||a.id.localeCompare(b.id);}).map(p=>p.id);
 const reasons=[];if(xi.length!==11)reasons.push(`${11-xi.length} missing XI slots`);if(!keeper)reasons.push('No wicketkeeper');if(!workload)reasons.push(`Insufficient bowling options to allocate ${totalOvers} overs`);if(!overseas)reasons.push('XI overseas limit exceeded');
 const confidence=contributions.reduce((s,p)=>s+p.confidence,0)/11;const provisional=confidence<.7||contributions.some(p=>!p.latest)||!valid;
 return {total:clamp(combination*.4+established*.3+recent*.2+bench*.1),eligible:valid,provisional,combination,established,recent,bench,xi:xi.map(p=>p.id),lineup,overs,checks,contributions,reasons,benched:benchPlayers.map(p=>({id:p.id,reason:'Not selected by the same deterministic score-maximizing XI search; available replacement cover'})),confidence,solver:'Exhaustive subsets through 16; bounded deterministic candidate search above 16 (approximate)'};
}
export function optimizeTeam(squad:MeasuredPlayer[],settings:Settings,format:string,cohorts:Record<string,Aggregate>):Evaluation {
 const unique=[...new Map(squad.map(p=>[p.id,p])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 if(unique.length<=11)return evaluateXI(unique,unique,settings,format,cohorts);
 let candidates=unique;
 if(unique.length>16){candidates=[...unique].sort((a,b)=>(performance(b,'established',cohorts).score+performance(b,'recent',cohorts).score)-(performance(a,'established',cohorts).score+performance(a,'recent',cohorts).score)||a.id.localeCompare(b.id)).slice(0,16);}
 let best:Evaluation|null=null;
 const choose=(start:number,selected:MeasuredPlayer[])=>{if(selected.length===11){const r=evaluateXI(selected,unique,settings,format,cohorts);if(!best||(r.eligible&&!best.eligible)||(r.eligible===best.eligible&&r.total>best.total))best=r;return;}for(let i=start;i<=candidates.length-(11-selected.length);i++){const p=candidates[i];if(p)choose(i+1,[...selected,p]);}};
 choose(0,[]);return best??evaluateXI(unique.slice(0,11),unique,settings,format,cohorts);
}
export function rankEvaluations(teams:{id:string;score:Evaluation}[]){return [...teams].sort((a,b)=>Number(b.score.eligible)-Number(a.score.eligible)||b.score.total-a.score.total||a.id.localeCompare(b.id)).map((t,i,all)=>({...t,rank:1+all.filter(x=>x.score.eligible===t.score.eligible&&x.score.total>t.score.total).length}));}
