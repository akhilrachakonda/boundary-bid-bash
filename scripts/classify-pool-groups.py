"""Pool-composition groups from an imported snapshot (pool-groups-1).
python3 scripts/classify-pool-groups.py --players /tmp/cricket-import/players.csv --out /tmp/cricket-import/pool_groups.json
Groups are for random 80/20 pool composition only, never official rankings.
Inputs: Cricsheet aggregates over the snapshot's last 36 months (recent+established windows)
and all covered history. No legacy rating, tier, price, name or reputation input.
"""
import argparse,csv,json,math
RULES='pool-groups-1'
# Minimum covered sample to count as experienced in a discipline.
EXP={'IPL':dict(bat=300,bowl=360),'T20':dict(bat=300,bowl=360),'ODI':dict(bat=600,bowl=600)}
def bat_value(a):
 if not a['balls'] or not a['dismissals']:return None
 return (a['runs']/a['dismissals'])*(a['runs']/a['balls'])  # average x strike rate/100
def bowl_value(a):
 if not a['legal_balls'] or not a['wickets']:return None
 return -(a['conceded']/a['wickets'])*(6*a['conceded']/a['legal_balls'])  # lower average x economy is better
def merge(*ws):
 out={k:sum(w[k] for w in ws) for k in ('runs','balls','dismissals','legal_balls','conceded','wickets','innings')};return out
def disciplines(role):return ['bat'] if role in ('BAT','WK') else ['bowl'] if role=='BOWL' else ['bat','bowl']
def pct(values,v):
 below=sum(x<v for x in values);eq=sum(x==v for x in values);return 100*(below+0.5*eq)/len(values)
def classify(players,roles):
 res={};
 for fmt in ('IPL','T20','ODI'):
  rows=[]
  for p in players:
   st=p['stats'][fmt]['windows'];cur=merge(st['recent'],st['established']);hist=st['history']
   rows.append((p,cur,hist))
  pools={'bat':[],'bowl':[]}
  for p,cur,hist in rows:
   if cur['balls']>=EXP[fmt]['bat'] and bat_value(cur) is not None:pools['bat'].append(bat_value(cur))
   if cur['legal_balls']>=EXP[fmt]['bowl'] and bowl_value(cur) is not None:pools['bowl'].append(bowl_value(cur))
  for p,cur,hist in rows:
   role=roles[p['identity_key']];ds=disciplines(role);basis=dict(window='last 36 months',balls=cur['balls'],legal_balls=cur['legal_balls'],innings=cur['innings'],history_balls=hist['balls'],history_legal_balls=hist['legal_balls'])
   exp={d:(cur['balls'] if d=='bat' else cur['legal_balls'])>=EXP[fmt][d] for d in ds}
   any_history_exp=any(p['stats'][f]['windows']['history'][k]>=EXP[f][d] for f in ('IPL','T20','ODI') for d,k in (('bat','balls'),('bowl','legal_balls')))
   scores={}
   for d in ds:
    v=bat_value(cur) if d=='bat' else bowl_value(cur)
    if exp[d] and v is not None and pools[d]:scores[d]=round(pct(pools[d],v),1)
   basis['percentiles']=scores
   if cur['innings']==0 and hist['innings']==0:g='unknown';why='No covered matches in this format'
   elif scores and max(scores.values())>=50:g='established';why='Experienced sample and top-half Cricket Auction performance score in '+'/'.join(k.upper() for k,v in scores.items() if v>=50)
   elif not any(exp.values()) and not any_history_exp:g='emerging';why='Covered sample below the experienced threshold in every format'
   else:g='other';why='Experienced player outside the top half for this format (not used in 80/20 pools)'
   basis['reason']=why
   res[(p['identity_key'],fmt)]=dict(group=g,basis=basis)
 return res
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--players',required=True);ap.add_argument('--catalogue',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
 players=[dict(r,stats=json.loads(r['stats'])) for r in csv.DictReader(open(a.players))]
 roles={k:v['role'] for k,v in json.load(open(a.catalogue)).items()}
 res=classify(players,roles)
 json.dump([dict(identity_key=k[0],format=k[1],rules_version=RULES,**v) for k,v in sorted(res.items())],open(a.out,'w'),indent=0)
 from collections import Counter
 for fmt in ('IPL','T20','ODI'):
  c=Counter((roles[k[0]],v['group']) for k,v in res.items() if k[1]==fmt);t=Counter(v['group'] for k,v in res.items() if k[1]==fmt)
  print(fmt,dict(t),{r:{g:c[(r,g)] for g in ('established','emerging')} for r in ('WK','BAT','AR','BOWL')})
if __name__=='__main__':main()
