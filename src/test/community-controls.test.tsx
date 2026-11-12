import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {useState} from 'react';
import {SettingsForm} from '@/components/SettingsForm';
import {DEFAULT_SETTINGS,type Player} from '@/lib/auction-rules';
import {generateQualityPool,qualityBand,inspectPool} from '@/lib/quality-pool';
import {battingPhase,planErrors,minutesValid} from '@/lib/community';
import {PoolEditor} from '@/components/auction/PoolEditor';
import source from '@/data/crickauction/import.json';
afterEach(cleanup);
const players=source.map(x=>({...x.player,id:x.source.id})) as Player[];
describe('mobile and desktop room controls',()=>{
 it('selects every team count without edit-time clamping',()=>{
  function Form(){const [s,setS]=useState(DEFAULT_SETTINGS);return <SettingsForm s={s} onChange={setS}/>;}
  render(<Form/>);const input=screen.getByLabelText('Teams (2–10)');
  for(const value of [3,7,9,4,10,2,8,6,5]){fireEvent.change(input,{target:{value:String(value)}});expect(input).toHaveValue(String(value));}
 });
 it('adds and removes catalogue players before confirmation',()=>{
  function Editor(){const [selected,set]=useState(players.slice(0,1));return <PoolEditor catalogue={players.slice(0,3)} selected={selected} onChange={set}/>;}
  render(<Editor/>);fireEvent.click(screen.getAllByRole('checkbox')[1]!);expect(screen.getByText(/2 selected/)).toBeInTheDocument();fireEvent.click(screen.getAllByRole('checkbox')[0]!);expect(screen.getByText(/1 selected/)).toBeInTheDocument();
 });
});
describe('star-first pool',()=>{
 it('always includes all 52 stars and uses 80/20 for the remaining 48 places',()=>{
  const stars=players.filter(p=>qualityBand(p)==='top').map(p=>p.id).sort();expect(stars).toHaveLength(52);
  const picks=[];
  for(const seed of [1,2,3,66,999]){
   const r=generateQualityPool(players,{...DEFAULT_SETTINGS,pool_size:100},seed);expect(r.feasible).toBe(true);expect(r.players).toHaveLength(100);expect(new Set(r.players.map(p=>p.id)).size).toBe(100);
   expect(r.players.filter(p=>qualityBand(p)==='top').map(p=>p.id).sort()).toEqual(stars);expect(r.players.filter(p=>qualityBand(p)==='middle')).toHaveLength(38);expect(r.players.filter(p=>qualityBand(p)==='low')).toHaveLength(10);picks.push(r.players.map(p=>p.id).join(','));
  }expect(new Set(picks).size).toBe(5);
 });
 it('raises undersized pools and explains supply or role adjustments',()=>{const r=generateQualityPool(players,{...DEFAULT_SETTINGS,pool_size:40},42);expect(r.players.length).toBeGreaterThanOrEqual(52);expect(r.notes.some(n=>n.includes('raised'))).toBe(true);expect(generateQualityPool(players,{...DEFAULT_SETTINGS,pool_size:'all'}).players).toHaveLength(273);expect(inspectPool([],DEFAULT_SETTINGS).feasible).toBe(false);});
});
describe('match plans',()=>{
 it('validates ownership, duplicate selections, overs and batting ranges',()=>{
  const ids=Array.from({length:11},(_,i)=>String(i));const p={batting_order:ids,bowling_overs:Object.fromEntries(ids.map((id,i)=>[id,i<5?4:0])),batting_phases:Object.fromEntries(ids.map((id,i)=>[id,battingPhase(i,'IPL')]))};expect(planErrors(p,ids,'IPL')).toEqual([]);expect(planErrors({...p,bowling_overs:{...p.bowling_overs,'0':5}},ids,'IPL').length).toBeGreaterThan(0);expect(planErrors({...p,batting_order:[...ids.slice(0,10),'0']},ids,'IPL').length).toBeGreaterThan(0);expect(planErrors({...p,batting_phases:{...p.batting_phases,'0':{from:15,to:8}}},ids,'IPL').length).toBeGreaterThan(0);expect(planErrors(p,ids.slice(0,10),'IPL').length).toBeGreaterThan(0);
 });
 it('accepts short squads visibly and validates editable stage durations',()=>{expect(planErrors({batting_order:['a'],bowling_overs:{a:4},batting_phases:{a:{from:1,to:20}}},['a'],'IPL')).toEqual([]);expect(minutesValid('')).toBe(false);expect(minutesValid('0')).toBe(false);expect(minutesValid('7')).toBe(true);expect(minutesValid('120')).toBe(true);expect(minutesValid('121')).toBe(false);});
});
