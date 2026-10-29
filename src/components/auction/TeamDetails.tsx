import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {PlayerPortrait} from './PlayerPortrait';
import {PlayerProfile} from './PlayerProfile';
import {formatMoney,type Player,type Settings} from '@/lib/auction-rules';
export function TeamDetails({name,players,price,currency}:{name:string;players:Player[];price:number|null;currency:Settings['currency']}){const [open,setOpen]=useState(false);return <><Button variant="ghost" className="ml-auto h-auto flex-col items-end" onClick={()=>setOpen(true)} aria-label={`View ${name} team details`}><span>{name}</span><strong className="font-display text-xl">{formatMoney(price,currency)}</strong></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogTitle>{name}</DialogTitle><DialogDescription>Current public squad · {players.length} players</DialogDescription>{players.map(p=><PlayerProfile key={p.id} player={p} currency={currency}><div className="flex items-center gap-3"><PlayerPortrait player={p} className="h-12 w-10 rounded"/>{p.name}</div></PlayerProfile>)}</DialogContent></Dialog></>;}
