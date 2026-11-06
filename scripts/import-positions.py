"""Position supplement for a NEW immutable snapshot, never mutates V2 source facts.
python3 scripts/import-positions.py --snapshot UUID --data /tmp/cricket-data --out /tmp/positions.csv
Arrival group proxy, not official scorecard order; excludes missing opening deliveries.
"""
import argparse,csv,json,zipfile
from pathlib import Path
from collections import defaultdict
import importlib.util
spec=importlib.util.spec_from_file_location('cricket_import',Path(__file__).with_name('import-cricsheet.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def positions(innings):
 if innings.get('super_over') or innings.get('forfeited'):return {}
 overs=innings.get('overs',[])
 if not overs or overs[0]['over']!=0 or not overs[0]['deliveries']:return {}
 if [o['over'] for o in overs]!=list(range(len(overs))):return {}
 first=overs[0]['deliveries'][0];seen={first['batter'],first['non_striker']}
 slots={name:'opening' for name in seen};order=2
 for over in overs:
  for d in over['deliveries']:
   arrivals={d['batter'],d['non_striker']}-seen
   if len(arrivals)>1:return {} # insufficient delivery continuity to infer ordinal
   for name in arrivals:
    order+=1
    if order>11:return {}
    slots[name]='top' if order==3 else 'middle' if order<=5 else 'lower' if order<=7 else 'tail'
    seen.add(name)
 return slots
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--snapshot',required=True);ap.add_argument('--cutoff',default='2026-10-29');ap.add_argument('--data',default='/tmp/cricket-data');ap.add_argument('--out',default='/tmp/positions.csv');a=ap.parse_args();root=Path(a.data)
 cross=module.crosswalk();identity={p['identifier']:p['name']+'|'+p['country'] for p in cross if p.get('identifier') and p.get('country')}
 # Crosswalk country may be absent; canonical photo identity is preserved.
 photos=module.roster();byname={p['name']:p['country'] for p in photos}
 identity={p['identifier']:p['name']+'|'+byname[p['name']] for p in cross if p.get('identifier') and p['name'] in byname}
 groups=defaultdict(dict);seen=set();accepted=0;excluded=0
 for archive,formats in [('ipl_male_json.zip',['IPL','T20']),('t20s_male_json.zip',['T20']),('odis_male_json.zip',['ODI'])]:
  with zipfile.ZipFile(root/archive) as z:
   for filename in z.namelist():
    if not filename.endswith('.json'):continue
    source=Path(filename).stem
    if source in seen:continue
    seen.add(source);match=json.loads(z.read(filename));info=match['info'];day=info['dates'][0]
    if day>a.cutoff:continue
    for innings in match.get('innings',[]):
     slots=positions(innings)
     if not slots:excluded+=1;continue
     accepted+=1;stats=module.innings_aggregates(innings,info)
     for name,group in slots.items():
      pid=info['registry']['people'].get(name);key=identity.get(pid)
      if not key:continue
      stat=stats.get(name,{})
      for fmt in formats:
       record=groups[(key,fmt)].setdefault(group,dict(innings=0,balls=0,runs=0,dismissals=0,earliest=day,latest=day))
       for k in ['balls','runs','dismissals']:record[k]+=stat.get(k,0)
       record['innings']+=1;record['earliest']=min(record['earliest'],day);record['latest']=max(record['latest'],day)
 with open(a.out,'w') as f:
  writer=csv.writer(f);writer.writerow(['snapshot_id','identity_key','format','groups','method','cutoff'])
  for (key,fmt),g in sorted(groups.items()):writer.writerow([a.snapshot,key,fmt,json.dumps(g,separators=(',',':')),'arrival-group-1',a.cutoff])
 coverage={fmt:sum(f==fmt for _,f in groups) for fmt in ['IPL','T20','ODI']};Path(a.out+'.report.json').write_text(json.dumps(dict(coverage=coverage,accepted_innings=accepted,excluded_innings=excluded,method='Grouped simultaneous openers; unique subsequent arrival; missing opening/discontinuous overs excluded; observed usage not finishing ability'),indent=2));print(json.dumps(coverage))
if __name__=='__main__':main()