"""Pool-composition groups from an imported snapshot (pool-groups-2).
python3 scripts/classify-pool-groups.py --players players.csv --catalogue catalogue.json --out pool_groups.json

Composition only, never official rankings. Inputs: Cricsheet aggregates for the SAME format only.
No legacy rating, tier, price, name, import date or reputation input.

Evidence = all covered same-format history plus the last 36 months counted a second time
(recency weighting). Rates are shrunk toward the format cohort with fixed prior samples so small
samples cannot rank as stars. A player is evidence-qualified for a discipline above a minimum
sample. Within each format+role cohort of qualified players, the top round(0.8*q) by role score
form the 'performance' group; the rest of the cohort and every non-qualified or unknown player
form 'emerging' (emerging / developing / insufficient data). Ties: higher score, then larger
sample, then identity key (deterministic).
"""
import argparse,csv,json
RULES='pool-groups-2'
QUALIFY={'IPL':dict(bat=60,bowl=120),'T20':dict(bat=60,bowl=120),'ODI':dict(bat=120,bowl=180)}
PRIOR=dict(balls=120,dismissals=5,legal_balls=120,wickets=5)
KEYS=('runs','balls','dismissals','legal_balls','conceded','wickets','innings')
def merged(st):
 return {k:st['history'][k]+st['recent'][k]+st['established'][k] for k in KEYS}
def cohort_rates(rows):
 t={k:sum(r[k] for r in rows) for k in KEYS}
 return dict(rpb=t['runs']/max(t['balls'],1),rpd=t['runs']/max(t['dismissals'],1),cpb=t['conceded']/max(t['legal_balls'],1),bpw=t['legal_balls']/max(t['wickets'],1))
def bat_score(a,c):
 rpb=(a['runs']+c['rpb']*PRIOR['balls'])/(a['balls']+PRIOR['balls'])
 rpd=(a['runs']+c['rpd']*PRIOR['dismissals'])/(a['dismissals']+PRIOR['dismissals'])
 return rpd*rpb  # shrunk average x shrunk strike rate/100
def bowl_score(a,c):
 cpb=(a['conceded']+c['cpb']*PRIOR['legal_balls'])/(a['legal_balls']+PRIOR['legal_balls'])
 bpw=(a['legal_balls']+c['bpw']*PRIOR['wickets'])/(a['wickets']+PRIOR['wickets'])
 return -(cpb*6)*(cpb*bpw)  # -(economy x bowling average); higher is better
def pct(vals,v):
 return round(100*(sum(x<v for x in vals)+0.5*(sum(x==v for x in vals)-1))/max(len(vals)-1,1),1)
def disciplines(role):return ['bat'] if role in ('BAT','WK') else ['bowl'] if role=='BOWL' else ['bat','bowl']
def classify(players,roles):
 res={}
 for fmt in ('IPL','T20','ODI'):
  ev={p['identity_key']:merged(p['stats'][fmt]['windows']) for p in players}
  c=cohort_rates(list(ev.values()))
  q=QUALIFY[fmt]
  qual={d:{k for k,a in ev.items() if (a['balls'] if d=='bat' else a['legal_balls'])>=q[d]} for d in ('bat','bowl')}
  raw={d:{k:(bat_score if d=='bat' else bowl_score)(ev[k],c) for k in qual[d]} for d in ('bat','bowl')}
  pcts={d:{k:pct(list(raw[d].values()),v) for k,v in raw[d].items()} for d in ('bat','bowl')}
  # Recent form (last 12 months only), same shrinkage; qualification at half the sample.
  rec={p['identity_key']:{k:p['stats'][fmt]['windows']['recent'][k] for k in KEYS} for p in players}
  rq={d:{k for k,a in rec.items() if (a['balls'] if d=='bat' else a['legal_balls'])>=q[d]//2} for d in ('bat','bowl')}
  rraw={d:{k:(bat_score if d=='bat' else bowl_score)(rec[k],c) for k in rq[d]} for d in ('bat','bowl')}
  rp={d:{k:pct(list(rraw[d].values()),v) for k,v in rraw[d].items()} for d in ('bat','bowl')}
  latest={p['identity_key']:p['stats'][fmt]['latest'] for p in players}
  for role in ('WK','BAT','AR','BOWL'):
   members=[k for k in ev if roles[k]==role]
   scored=[]
   for k in members:
    ds=disciplines(role);have=[pcts[d][k] for d in ds if k in pcts[d]]
    # All-rounders: mean of qualified disciplines; one qualified discipline counts once.
    if have:scored.append((sum(have)/len(have),ev[k]['balls']+ev[k]['legal_balls'],k))
   scored.sort(key=lambda x:(-x[0],-x[1],x[2]))
   top=round(0.8*len(scored));perf={k for _,_,k in scored[:top]}
   for k in members:
    a=ev[k];sc={d:pcts[d][k] for d in ('bat','bowl') if k in pcts[d]}
    h=next(p for p in players if p['identity_key']==k)['stats'][fmt]['windows']['history']
    basis=dict(window='all covered same-format history + last 36 months weighted twice',balls=a['balls'],legal_balls=a['legal_balls'],innings=a['innings'],percentiles=sc,cohort_size=len(scored),
     recent={d:rp[d][k] for d in ds if k in rp[d]},latest=latest[k],
     raw=dict(innings=h['innings'],runs=h['runs'],balls=h['balls'],dismissals=h['dismissals'],wickets=h['wickets'],legal_balls=h['legal_balls'],conceded=h['conceded']))
    if k in perf:g='performance';why='Upper 80% of evidence-qualified '+role+' in '+fmt
    elif any(k==x[2] for x in scored):g='emerging';why='Lower 20% of evidence-qualified '+role+' in '+fmt;basis['status']='measured'
    elif a['innings']:g='emerging';why='Developing: below the evidence sample in '+fmt;basis['status']='insufficient data'
    else:g='emerging';why='No covered '+fmt+' matches';basis['status']='unknown'
    basis['reason']=why;res[(k,fmt)]=dict(group=g,basis=basis)
 return res
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--players',required=True);ap.add_argument('--catalogue',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
 csv.field_size_limit(10**9)
 players=[dict(r,stats=json.loads(r['stats'])) for r in csv.DictReader(open(a.players))]
 roles={k:v['role'] for k,v in json.load(open(a.catalogue)).items()}
 res=classify(players,roles)
 json.dump([dict(identity_key=k[0],format=k[1],rules_version=RULES,**v) for k,v in sorted(res.items())],open(a.out,'w'),indent=0)
 from collections import Counter
 for fmt in ('IPL','T20','ODI'):
  c=Counter((roles[k[0]],v['group'],v['basis'].get('status','measured')) for k,v in res.items() if k[1]==fmt)
  print(fmt,dict(sorted(c.items())))
if __name__=='__main__':main()
