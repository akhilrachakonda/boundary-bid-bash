import {describe,it,expect} from 'vitest';
import {metric,optimizeTeam,rankEvaluations,WEIGHTS,type MeasuredPlayer} from '@/lib/evaluation-v2';
import {DEFAULT_SETTINGS,maxAffordableBid,squadCounts} from '@/lib/auction-rules';
const player=(id:string,role:string):MeasuredPlayer=>({id,name:id,country:'India',format:'IPL',role,sub_role:role==='BOWL'?(id==='10'?'Spin':'Pace'):role==='AR'?'Bowling AR (pace)':'Top order',rating:99,base_price:2,nationality_type:'Indian',tier:'Marquee',batting_hand:'Right',bowling_style:'Fast'});
const squad=Array.from({length:11},(_,i)=>player(String(i),i===0?'WK':i>=6?'BOWL':'BAT'));
describe('evidence scoring invariants',()=>{
 it('weights total 100',()=>expect(Object.values(WEIGHTS).reduce((a,b)=>a+b,0)).toBe(100));
 it('no data is neutral unknown rather than zero ability',()=>{const m=metric(null,0,null,120,false,1,'SR');expect(m.normalized).toBe(50);expect(m.fallback).toBe(true);expect(m.confidence).toBe(0);});
 it('lower economy is rewarded with sufficient sample',()=>expect(metric(6,1000,8,180,true,1,'economy').points).toBeGreaterThan(metric(10,1000,8,180,true,1,'economy').points));
 it('small samples shrink closer to cohort',()=>expect(metric(200,1,100,120,false,1,'SR').points).toBeLessThan(metric(200,1000,100,120,false,1,'SR').points));
 it('static ratings and purchase/input order have no effect',()=>{const a=optimizeTeam(squad,DEFAULT_SETTINGS,'IPL',{});const b=optimizeTeam([...squad].reverse().map(p=>({...p,rating:1,base_price:100})),DEFAULT_SETTINGS,'IPL',{});expect(a.total).toBe(b.total);expect(a.xi).toEqual(b.xi);});
 it('valid XI has exactly 20 capped overs and each player once',()=>{const a=optimizeTeam(squad,DEFAULT_SETTINGS,'IPL',{});expect(a.eligible).toBe(true);expect(new Set(a.lineup).size).toBe(11);expect(a.overs.reduce((n,p)=>n+p.overs,0)).toBe(20);expect(a.overs.every(p=>p.overs<=4)).toBe(true);});
 it('ODI plan uses 50 overs and cap 10, not decimal overs',()=>{const a=optimizeTeam(squad.map(p=>({...p,format:'ODI'})),DEFAULT_SETTINGS,'ODI',{});expect(a.overs.reduce((n,p)=>n+p.overs,0)).toBe(50);expect(a.overs.every(p=>p.overs<=10)).toBe(true);});
 it('incomplete or keeper-less XIs cannot win valid-XI champion',()=>{expect(optimizeTeam(squad.slice(0,10),DEFAULT_SETTINGS,'IPL',{}).eligible).toBe(false);expect(optimizeTeam(squad.map(p=>({...p,role:'BAT'})),DEFAULT_SETTINGS,'IPL',{}).eligible).toBe(false);});
 it('balanced low legacy rating beats unbalanced high legacy rating',()=>expect(optimizeTeam(squad.map(p=>({...p,rating:1})),DEFAULT_SETTINGS,'IPL',{}).total).toBeGreaterThan(optimizeTeam(squad.map(p=>({...p,role:'BAT',rating:100})),DEFAULT_SETTINGS,'IPL',{}).total));
 it('tied exact scores share rank',()=>{const score=optimizeTeam(squad,DEFAULT_SETTINGS,'IPL',{});expect(rankEvaluations([{id:'z',score},{id:'a',score}]).map(t=>t.rank)).toEqual([1,1]);});
 it('reserve matches concrete server conservative rule',()=>{const s={...DEFAULT_SETTINGS,min_squad:11,min_wk:1,min_bat:3,min_ar:2,min_bowl:4,min_base:.2};expect(maxAffordableBid(s,100,squadCounts([]),'WK')).toBe(98);});
});
