import {poolRequirements, squadCounts, rng, type Player, type Settings, type PoolResult} from './auction-rules.ts';
export const qualityBand = (p: Player) => ['Marquee','A'].includes(p.tier) ? 'top' : p.tier === 'B' ? 'middle' : 'low';
export function inspectPool(players:Player[], s:Settings):PoolResult {
 const req=poolRequirements(s),c=squadCounts(players);
 const missing=(Object.keys(req) as (keyof typeof req)[]).filter(k=>c[k]<req[k]);
 return {players,requested:s.pool_size==='all'?players.length:s.pool_size,size:players.length,feasible:!missing.length,notes:missing.map(k=>`${k}: ${c[k]} selected; ${req[k]} needed for your squad rules.`)};
}
/** Every Marquee/A identity is mandatory; remaining slots target 80% B / 20% C or Uncapped. */
export function generateQualityPool(all:Player[],s:Settings,seed=1):PoolResult {
 const random=rng(seed), req=poolRequirements(s), mandatory=all.filter(p=>qualityBand(p)==='top');
 const requested=s.pool_size==='all'?all.length:s.pool_size;
 const size=Math.min(all.length,Math.max(requested,req.total,mandatory.length));
 const remaining=size-mandatory.length;
 const middle=all.filter(p=>qualityBand(p)==='middle'),low=all.filter(p=>qualityBand(p)==='low');
 let m=Math.min(middle.length,Math.round(remaining*.8)),l=Math.min(low.length,remaining-m);
 m=Math.min(middle.length,remaining-l);
 const quota={middle:m,low:l};
 const ranked=[...middle,...low].map(p=>({p,key:-Math.log(Math.max(.000001,random()))/(1+Math.max(0,p.rating)/50)})).sort((a,b)=>a.key-b.key).map(x=>x.p);
 const chosen=[...mandatory];const ids=new Set(chosen.map(p=>p.id));
 const gain=(p:Player)=>{const c=squadCounts(chosen),one=squadCounts([p]);return (Object.keys(req) as (keyof typeof req)[]).filter(k=>k!=='total'&&c[k]<req[k]&&one[k]>0).reduce((n,k)=>n+1+(req[k]-c[k])/Math.max(1,req[k]),0);};
 // Satisfy scarce roles first within the requested quality quotas.
 while(chosen.length<size){
  const candidates=ranked.filter(p=>!ids.has(p.id)&&quota[qualityBand(p) as 'middle'|'low']>0);
  if(!candidates.length)break;
  const p=candidates.reduce((best,p)=>gain(p)>gain(best)?p:best,candidates[0]!);
  chosen.push(p);ids.add(p.id);quota[qualityBand(p) as 'middle'|'low']--;
 }
 // If unusual host rules cannot fit those quotas, add the missing role rather than remove a required star.
 while(!inspectPool(chosen,s).feasible){
  const candidates=ranked.filter(p=>!ids.has(p.id)&&gain(p)>0);
  if(!candidates.length)break;
  const p=candidates.reduce((best,p)=>gain(p)>gain(best)?p:best,candidates[0]!);chosen.push(p);ids.add(p.id);
 }
 const result=inspectPool(chosen,s);
 const notes=[...result.notes];
 if(size>requested)notes.unshift(`Pool raised to ${size} to include every top-tier player and meet squad requirements.`);
 const actualM=chosen.filter(p=>qualityBand(p)==='middle').length,actualL=chosen.filter(p=>qualityBand(p)==='low').length;
 notes.unshift(`All ${mandatory.length} top-tier players included · ${actualM} middle · ${actualL} low. Remaining places target 80% middle / 20% low.`);
 if(chosen.length!==size||actualM!==Math.round(remaining*.8))notes.push('Catalogue availability or squad rules adjusted the target mix. Review the actual counts before confirming.');
 return {...result,requested,notes};
}
