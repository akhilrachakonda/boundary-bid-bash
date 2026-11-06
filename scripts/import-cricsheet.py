"""Reproducible Cricsheet JSON importer; outputs CSV for immutable database snapshots.
python3 scripts/import-cricsheet.py --data /tmp/cricket-data --out /tmp/cricket-import
Requires reviewed-crosswalk.json; no fuzzy matching or synthetic statistics.
"""
import argparse,calendar,csv,hashlib,json,uuid,zipfile
from collections import defaultdict
from datetime import date,datetime,timezone
from pathlib import Path
CREDIT='Cricsheet (https://cricsheet.org/), Open Data Commons Attribution License (ODC-By 1.0). Available covered matches, not full career totals. Afghanistan-involving matches withheld by source.'
BOWLER_WICKETS={'bowled','caught','caught and bowled','lbw','stumped','hit wicket'}
NON_DISMISSALS={'retired hurt','retired not out'}
def month_before(d,months):
 m=d.year*12+d.month-1-months;y,m=divmod(m,12);m+=1;return date(y,m,min(d.day,calendar.monthrange(y,m)[1]))
def empty():return dict(runs=0,balls=0,dismissals=0,innings=0,boundaries=0,dots=0,legal_balls=0,conceded=0,wickets=0,bowl_dots=0,bowl_boundaries=0,catches=0,stumpings=0,positions={},phases={})
def add(a,b):
 for k in a:
  if k in ('positions','phases'):continue
  a[k]+=b.get(k,0)
 for k,v in b.get('positions',{}).items():a['positions'][k]=a['positions'].get(k,0)+v
 for k,v in b.get('phases',{}).items():
  if k not in a['phases']:a['phases'][k]=empty()
  add(a['phases'][k],v)
def rates(a):
 return dict(sr=100*a['runs']/a['balls'] if a['balls'] else None,average=a['runs']/a['dismissals'] if a['dismissals'] else None,economy=6*a['conceded']/a['legal_balls'] if a['legal_balls'] else None,bowling_sr=a['legal_balls']/a['wickets'] if a['wickets'] else None,boundary_pct=100*a['boundaries']/a['balls'] if a['balls'] else None,dot_pct=100*a['dots']/a['balls'] if a['balls'] else None,bowling_dot_pct=100*a['bowl_dots']/a['legal_balls'] if a['legal_balls'] else None,bowling_boundary_pct=100*a['bowl_boundaries']/a['legal_balls'] if a['legal_balls'] else None)
def innings_aggregates(innings,info):
 """Normal innings only; balls faced include no-balls but exclude wides.
 Fielding count only, never efficiency. Bowler runs exclude byes/legbyes/penalty.
 ODI phase uses recorded mandatory powerplays where available, death final 10
 scheduled overs; T20 death final 4 scheduled overs. Unknown PP is unknown.
 """
 if innings.get('super_over') or innings.get('forfeited'):return {}
 stats=defaultdict(empty);batting_order=[];seen_bat=set();legal_seen=0
 scheduled=info.get('overs',50 if info['match_type']=='ODI' else 20)
 for over in innings.get('overs',[]):
  for delivery in over['deliveries']:
   ex=delivery.get('extras',{});runs=delivery['runs'];batter=delivery['batter'];bowler=delivery['bowler']
   assert runs['total']==runs['batter']+runs.get('extras',0),'Run total mismatch'
   legal=not ex.get('wides') and not ex.get('noballs');faced=not ex.get('wides')
   for name in (batter,delivery['non_striker']):
    if name not in seen_bat:seen_bat.add(name);batting_order.append(name)
   ball_label=float(delivery.get('actual_delivery',str(over['over']+0.1)))
   pp=any(p.get('type')=='mandatory' and float(p['from'])<=ball_label<=float(p['to']) for p in innings.get('powerplays',[]))
   phase='powerplay' if pp else 'death' if over['over']>=max(0,scheduled-(10 if info['match_type']=='ODI' else 4)) else 'middle' if innings.get('powerplays') else 'unknown'
   for name in (batter,bowler):
    if phase not in stats[name]['phases']:stats[name]['phases'][phase]=empty()
   for a in (stats[batter],stats[batter]['phases'][phase]):
    a['runs']+=runs['batter'];a['balls']+=int(bool(faced));a['boundaries']+=int(runs['batter'] in (4,6) and not runs.get('non_boundary',False));a['dots']+=int(bool(faced) and runs['batter']==0)
   for a in (stats[bowler],stats[bowler]['phases'][phase]):
    a['legal_balls']+=int(bool(legal));a['conceded']+=runs['total']-ex.get('byes',0)-ex.get('legbyes',0)-ex.get('penalty',0);a['bowl_dots']+=int(bool(legal) and runs['total']==0);a['bowl_boundaries']+=int(bool(legal) and runs['batter'] in (4,6) and not runs.get('non_boundary',False))
   for w in delivery.get('wickets',[]):
    dismissed=w['player_out'];kind=w['kind']
    if kind not in NON_DISMISSALS:stats[dismissed]['dismissals']+=1
    if kind in BOWLER_WICKETS:
     stats[bowler]['wickets']+=1;stats[bowler]['phases'][phase]['wickets']+=1
    if kind=='caught and bowled':stats[bowler]['catches']+=1
    for f in w.get('fielders',[]):
     if f.get('substitute'):continue
     if kind=='caught':stats[f['name']]['catches']+=1
     if kind=='stumped':stats[f['name']]['stumpings']+=1
   legal_seen+=int(bool(legal))
 for i,name in enumerate(batting_order):stats[name]['innings']=1;stats[name]['positions'][str(i+1)]=1
 return dict(stats)
def roster():
 """Canonical identities: original 150 portrait roster plus reviewed register-ID additions."""
 base=json.load(open('src/data/player-photos.json'));add=json.load(open('src/data/roster-additions-2026-11.json'))['players']
 names={x['name'] for x in base};assert not names&{x['name'] for x in add},'duplicate identity'
 return base+[dict(name=x['name'],country=x['country'],source=None) for x in add]
def crosswalk():
 base=json.load(open('src/data/cricsheet-crosswalk.json'));add=json.load(open('src/data/roster-additions-2026-11.json'))['players']
 ids={x.get('identifier') for x in base if x.get('identifier')};assert not ids&{x['identifier'] for x in add},'duplicate register id'
 return base+[dict(name=x['name'],identifier=x['identifier'],method='register-id-reviewed',evidence='Cricsheet register '+x['register_name']+(' / ESPNcricinfo key '+x['cricinfo_id'] if x['cricinfo_id'] else ''),aliases=x['aliases']) for x in add]
def write_csv(path,fields,rows):
 with open(path,'w') as f:
  w=csv.writer(f);w.writerow(fields)
  for row in rows:w.writerow([json.dumps(row[k],separators=(',',':')) if isinstance(row[k],(dict,list)) else row[k] for k in fields])
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--data',default='/tmp/cricket-data');ap.add_argument('--out',default='/tmp/cricket-import');ap.add_argument('--cutoff',default=date.today().isoformat());args=ap.parse_args();root=Path(args.data);out=Path(args.out);out.mkdir(parents=True,exist_ok=True);cutoff=date.fromisoformat(args.cutoff)
 photos=roster();cross=json.load(open(root/'reviewed-crosswalk.json')) if (root/'reviewed-crosswalk.json').exists() else crosswalk()
 by_name={x['name']:x for x in cross};ids={x['identifier'] for x in cross if x.get('identifier')};recent_start=month_before(cutoff,12);est_start=month_before(cutoff,36)
 sid=str(uuid.uuid5(uuid.NAMESPACE_URL,'cricket-auction-import-v2.1-arrival-group-1-roster200:'+args.cutoff+':'+':'.join(hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['ipl_male_json.zip','t20s_male_json.zip','odis_male_json.zip'])))
 aggregated=defaultdict(empty);dates=defaultdict(list);matches=[];innings_rows=[];counts=defaultdict(int);latest={};earliest={};revisions={};dedup={};rejected=[]
 for filename,competition,formats,mt in [('ipl_male_json.zip','IPL',['IPL','T20'],'T20'),('t20s_male_json.zip','T20I',['T20'],'T20'),('odis_male_json.zip','ODI',['ODI'],'ODI')]:
  z=zipfile.ZipFile(root/filename)
  (out/(competition+'-LICENSE.txt')).write_bytes(z.read('LICENSE.txt'))
  for fname in z.namelist():
   if not fname.endswith('.json'):continue
   raw=z.read(fname);d=json.loads(raw);info=d['info'];source_id=Path(fname).stem;revision=d['meta']['revision'];played=date.fromisoformat(info['dates'][0])
   assert info['gender']=='male' and info['match_type']==mt
   assert d['meta']['data_version'] in ('1.2.0','1.3.0')
   if played>cutoff:continue
   if source_id in dedup:
    assert dedup[source_id]==hashlib.sha256(raw).hexdigest(),'Conflicting duplicate source match';continue
   dedup[source_id]=hashlib.sha256(raw).hexdigest();counts[competition]+=1;latest[competition]=max(latest.get(competition,played),played);earliest[competition]=min(earliest.get(competition,played),played)
   matches.append(dict(snapshot_id=sid,source_id=source_id,competition=competition,played_on=played.isoformat(),revision=revision,content_hash=dedup[source_id],info=info));revisions[source_id]=revision
   registry=info['registry']['people']
   for ii,innings in enumerate(d.get('innings',[])):
    stats=innings_aggregates(innings,info)
    for name,s in stats.items():
     player_id=registry.get(name)
     if player_id not in ids:continue
     for fmt in formats:
      innings_rows.append(dict(snapshot_id=sid,source_id=source_id,innings=ii,source_player_id=player_id,format=fmt,played_on=played.isoformat(),aggregates=s))
      add(aggregated[(player_id,fmt,'history')],s);dates[(player_id,fmt)].append(played)
      if played>=recent_start:add(aggregated[(player_id,fmt,'recent')],s)
      elif played>=est_start:add(aggregated[(player_id,fmt,'established')],s)
 stats_rows=[]
 for p in photos:
  mapping=by_name.get(p['name'],dict(name=p['name'],identifier=None,method='unmatched',evidence=p['source']));identity=p['name']+'|'+p['country'];pid=mapping.get('identifier');stats={}
  for fmt in ('IPL','T20','ODI'):
   ds=dates.get((pid,fmt),[]);stats[fmt]=dict(latest=max(ds).isoformat() if ds else None,earliest=min(ds).isoformat() if ds else None,windows={})
   for window in ('history','recent','established'):
    a=aggregated[(pid,fmt,window)];stats[fmt]['windows'][window]=dict(**a,metrics=rates(a))
  stats_rows.append(dict(snapshot_id=sid,identity_key=identity,source_player_id=pid,name=p['name'],country=p['country'],mapping=mapping,stats=stats))
 cohorts={}
 for fmt in ('IPL','T20','ODI'):
  for window in ('recent','established'):
   for role in ('WK','BAT','AR','BOWL'):
    # Canonical format/role cohort, pooled delivery totals, no price/name factors.
    a=empty()
    for p in stats_rows:
     photo=next(x for x in photos if x['name']==p['name']);role_meta=photo.get('role')
     # Roles supplied by catalogue in separate map, required by refresh workflow.
     roles=json.load(open(root/'catalogue.json')) if (root/'catalogue.json').exists() else {}
     if roles.get(p['identity_key'],{}).get('role')==role:add(a,p['stats'][fmt]['windows'][window])
    cohorts[fmt+'|'+window+'|'+role]=dict(**a,metrics=rates(a))
 coverage={fmt:dict(competitions=['IPL'] if fmt=='IPL' else ['T20I','IPL'] if fmt=='T20' else ['ODI'],matched=sum(bool(p['source_player_id']) for p in stats_rows),with_data=sum(p['stats'][fmt]['latest'] is not None for p in stats_rows),missing=[p['name'] for p in stats_rows if not p['stats'][fmt]['latest']],latest=max((p['stats'][fmt]['latest'] for p in stats_rows if p['stats'][fmt]['latest']),default=None),archive_latest=str(latest['IPL' if fmt=='IPL' else 'T20I' if fmt=='T20' else 'ODI']),matches=counts['IPL'] if fmt=='IPL' else counts['T20I']+counts['IPL'] if fmt=='T20' else counts['ODI']) for fmt in ('IPL','T20','ODI')}
 snapshot=dict(id=sid,version='v2.0',cutoff=args.cutoff,status='validated',provenance=dict(attribution=CREDIT,urls=['https://cricsheet.org/downloads/'+n for n in ['ipl_male_json.zip','t20s_male_json.zip','odis_male_json.zip']],register='https://cricsheet.org/register/',license='https://cricsheet.org/licensing/',method='cricsheet-import-v2.0',recent_start=str(recent_start),established_start=str(est_start),competition_adjustment='None; T20 explicitly pools IPL and T20I. Not strength-adjusted.'),coverage=coverage,cohorts=cohorts)
 write_csv(out/'snapshots.csv',['id','version','cutoff','status','provenance','coverage','cohorts'],[snapshot]);write_csv(out/'matches.csv',['snapshot_id','source_id','competition','played_on','revision','content_hash','info'],matches);write_csv(out/'players.csv',['snapshot_id','identity_key','source_player_id','name','country','mapping','stats'],stats_rows);write_csv(out/'innings.csv',['snapshot_id','source_id','innings','source_player_id','format','played_on','aggregates'],innings_rows)
 # The position supplement derives grouped, validated arrival order independently of legacy V2 positions.
 import subprocess,sys
 subprocess.run([sys.executable,str(Path(__file__).with_name('import-positions.py')),'--snapshot',sid,'--cutoff',args.cutoff,'--data',str(root),'--out',str(out/'positions.csv')],check=True)
 with open(out/'positions.csv') as f:
  position_rows=[dict(identity_key=r['identity_key'],format=r['format'],groups=json.loads(r['groups']),method=r['method'],cutoff=r['cutoff']) for r in csv.DictReader(f)]
 (out/'bundle.json').write_text(json.dumps(dict(snapshot=snapshot,players=stats_rows,matches=matches,positions=position_rows),separators=(',',':')))
 (out/'coverage.json').write_text(json.dumps(coverage,indent=2));(out/'snapshot.json').write_text(json.dumps(snapshot,indent=2));print(json.dumps(dict(snapshot=sid,coverage=coverage,innings=len(innings_rows)),indent=2))
if __name__=='__main__':main()
