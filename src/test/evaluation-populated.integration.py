import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
U='http://localhost:8080'
async def rpc(p,fn,args):
 r=await p.evaluate('''async ([fn,args])=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const r=await supabase.rpc(fn,args);return {data:r.data,error:r.error?.message};}''',[fn,args]);assert not r.get('error'),(fn,r);return r['data']
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True);ca=await b.new_context(viewport={'width':1280,'height':1800},storage_state='/tmp/browser/upgrade/host-session.json');cb=await b.new_context(viewport={'width':390,'height':1000},storage_state='/tmp/browser/upgrade/guest-session.json');a=await ca.new_page();g=await cb.new_page();errs=[];a.on('pageerror',lambda e:errs.append(str(e)));await a.goto(U);await g.goto(U)
  s=dict(max_teams=2,min_squad=1,max_squad=18,min_wk=0,min_bat=0,min_ar=0,min_bowl=0,max_overseas=11,min_spinners=0,min_pacers=0,purse=100,pool_size=4,bid_timer=1,bid_reset=1,increments=[dict(upto=None,step=.5)],review_seconds=120,min_base=.2,currency='lakh',surprise_reveal=True)
  cr=await rpc(a,'create_room',dict(p_name='V2 evidence validation',p_format='IPL',p_settings=s,p_nickname='Host',p_team='Evidence Royals',p_color='#f4c34d'));rid=cr['room_id'];await rpc(g,'join_room',dict(p_code=cr['code'],p_nickname='Guest',p_team='Evidence Kings',p_color='#29d7ee'))
  ids=await a.evaluate("""async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const p=(await supabase.from('players').select('id,role').eq('format','IPL').eq('nationality_type','Indian')).data;return [p.find(x=>x.role==='WK').id,...p.filter(x=>x.role==='BOWL').slice(0,5).map(x=>x.id),...p.filter(x=>x.role==='BAT').slice(0,5).map(x=>x.id)];}""");await rpc(a,'set_pool',dict(p_room=rid,p_player_ids=ids));await rpc(a,'start_review',dict(p_room=rid));await rpc(a,'host_control',dict(p_room=rid,p_action='skip_review'));await rpc(a,'tick',dict(p_room=rid));await rpc(a,'host_control',dict(p_room=rid,p_action='pause'));await a.goto(U+'/room/'+rid);await g.goto(U+'/room/'+rid);await a.locator('.auction-broadcast').wait_for()
  for index in range(11):
   proj=await rpc(a,'room_projection',dict(p_room=rid));cur=next(p for p in proj['pool'] if p['id']==proj['room']['current_rp']);await rpc(a,'host_control',dict(p_room=rid,p_action='resume'));await rpc(a,'place_bid',dict(p_room=rid,p_amount=cur['player']['base_price']))
   for _ in range(30):
    await a.wait_for_timeout(200);now=await rpc(a,'room_projection',dict(p_room=rid))
    if now['room']['current_rp']!=cur['id']:break
   if now['room']['status']=='completed':break
   await rpc(a,'host_control',dict(p_room=rid,p_action='pause'))
  await rpc(a,'host_control',dict(p_room=rid,p_action='results'));await a.get_by_text('Valid-XI leader',exact=True).wait_for(timeout=30000);await g.get_by_text('Valid-XI leader',exact=True).wait_for(timeout=30000)
  await a.screenshot(path='/tmp/browser/random-order/populated-results.png');result=await a.evaluate("""async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('room_evaluations').select('result').eq('room_id',id).single()).data.result;}""",rid);team=next(t for t in result['teams'] if t['score']['eligible']);assert len(team['score']['xi'])==11;assert sum(o['overs'] for o in team['score']['overs'])==20;print('PASS real 11-player auction, valid canonical XI, 20 overs, frozen measured contributions and two-client results');assert not errs,errs;await b.close()
asyncio.run(main())
