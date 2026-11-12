import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import type {Player} from '@/lib/auction-rules';
import {qualityBand} from '@/lib/quality-pool';
export function PoolEditor({catalogue,selected,onChange}:{catalogue:Player[];selected:Player[];onChange:(players:Player[])=>void}){
 const [query,setQuery]=useState(''),[onlySelected,setOnlySelected]=useState(false),[limit,setLimit]=useState(40);
 const ids=new Set(selected.map(p=>p.id));
 const rows=catalogue.filter(p=>(!onlySelected||ids.has(p.id))&&`${p.name} ${p.role} ${p.tier}`.toLowerCase().includes(query.toLowerCase()));
 return <section className="space-y-3" aria-label="Edit player pool"><p className="text-sm">Full catalogue: {catalogue.length} players. Add or remove anyone before confirming; manual edits can change the generated tier mix.</p><div className="flex flex-wrap gap-2"><Input aria-label="Search catalogue" placeholder="Search name, role or tier" value={query} onChange={e=>{setQuery(e.target.value);setLimit(40);}} className="min-w-0 flex-1"/><Button variant="outline" aria-pressed={onlySelected} onClick={()=>setOnlySelected(!onlySelected)}>{onlySelected?'Show full catalogue':'Show selected'}</Button></div><div className="grid max-h-[32rem] gap-2 overflow-y-auto sm:grid-cols-2">{rows.slice(0,limit).map(p=><label key={p.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3"><input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--primary)]" checked={ids.has(p.id)} onChange={()=>onChange(ids.has(p.id)?selected.filter(x=>x.id!==p.id):[...selected,p])}/><span className="min-w-0"><strong className="block text-sm">{p.name}</strong><span className="text-xs text-muted-foreground">{p.role} · {qualityBand(p)} · {p.tier}</span></span></label>)}</div>{rows.length>limit&&<Button variant="outline" onClick={()=>setLimit(limit+40)}>Show more players</Button>}<p className="text-sm">{selected.length} selected · changes are saved only when you confirm.</p></section>;
}
