import asyncio,json,uuid
from pathlib import Path
from playwright.async_api import async_playwright
U='http://localhost:8080'
async def raw(p,fn,args):
 return await p.evaluate('''async ([fn,args])=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const r=await supabase.rpc(fn,args);return {data:r.data,error:r.error?.message};}''',[fn,args])
async def rpc(p,fn,args):
 if fn in ['host_control','place_bid']:
  proj=await rpc(p,'room_projection',{'p_room':args['p_room']});r=proj['room']
  if fn=='host_control':
   sale=None
   if args['p_action']=='undo':
    sale=await p.evaluate('''async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('sales').select('id').eq('room_id',id).eq('undone',false).not('participant_id','is',null).order('created_at',{ascending:false}).limit(1)).data[0]?.id;}''',r['id'])
   args={**args,'p_version':r['lot_version'],'p_status':r['status'],'p_sale':sale}
  else:args={**args,'p_lot':r['current_rp'],'p_version':r['lot_version'],'p_request':str(uuid.uuid4())}
 out=await raw(p,fn,args);assert not out.get('error'),(fn,out);return out['data']
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True);contexts=[];pages=[];errs=[]
  for i in range(3):
   c=await b.new_context(viewport={'width':1280,'height':1800});p=await c.new_page();p.on('pageerror',lambda e:errs.append(str(e)));await p.goto(U+'/auth');await p.wait_for_timeout(1800);await p.get_by_label('Nickname',exact=True).fill('Release guest '+str(i));await p.get_by_role('button',name='Continue as guest').click();await p.wait_for_timeout(2500);print('AUTH',i,p.url,await p.locator('main').inner_text());await p.screenshot(path='/tmp/browser/release/auth.png');await p.wait_for_url('**/create',timeout=30000);contexts.append(c);pages.append(p)
  a,g,x=pages
  await a.locator('main input').first.fill('RELEASE TEST guest gameplay');await a.get_by_role('button',name='Create room & open lobby').click();await a.wait_for_url('**/room/*',timeout=30000);rid=a.url.split('/')[-1];proj=await rpc(a,'room_projection',{'p_room':rid});code=proj['room']['code'];await a.screenshot(path='/tmp/browser/release/lobby.png')
  await g.goto(U+'/join?code='+code);await g.get_by_role('button',name='Join auction').click();await g.wait_for_url('**/room/*');assert (await raw(x,'room_projection',{'p_room':rid}))['error'];print('PASS two independent guest signups, UI create/join, other-room projection denial')
  for fn,args in [('start_review',{'p_room':rid}),('set_pool',{'p_room':rid,'p_player_ids':[]}),('update_room_settings',{'p_room':rid,'p_settings':proj['room']['settings']}),('open_trades',{'p_room':rid,'p_minutes':1})]:
   assert (await raw(g,fn,args))['error'],fn
  checks=await a.evaluate('''async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return Promise.all(['rooms','room_players'].map(async t=>{const r=await supabase.from(t).select('*').eq('id',id);return !!r.error;}));}''',rid);assert checks==[True,True]
  s={**proj['room']['settings'],'min_squad':1,'min_wk':0,'min_bat':0,'min_ar':0,'min_bowl':0,'min_spinners':0,'min_pacers':0,'bid_timer':3,'bid_reset':1}
  await rpc(a,'update_room_settings',{'p_room':rid,'p_settings':s})
  players=await a.evaluate('''async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('players').select('*').eq('format','IPL').eq('base_price',2).limit(4)).data;}''');assert len(players)==4
  await rpc(a,'set_pool',{'p_room':rid,'p_player_ids':[p['id'] for p in players]});await rpc(a,'start_review',{'p_room':rid});await rpc(a,'host_control',{'p_room':rid,'p_action':'skip_review'});await asyncio.gather(rpc(a,'tick',{'p_room':rid}),rpc(g,'tick',{'p_room':rid}));await rpc(a,'host_control',{'p_room':rid,'p_action':'pause'});proj=await rpc(a,'room_projection',{'p_room':rid});r=proj['room'];assert all(p['lot_order']==0 for p in proj['pool']);assert 'first_round_order' not in r;assert r['scoring_patch']=='legal-reserve-1';print('PASS host denial, raw queue denial, concurrent starts, frozen surprise projection')
  await a.reload();await g.reload();await g.locator('.auction-broadcast').wait_for();assert await g.get_by_role('button',name='Turn on sounds').is_visible()
  for width in [360,390,430,1280]:
   await g.set_viewport_size({'width':width,'height':1800 if width==1280 else 900});await g.get_by_text('Remaining purse',exact=True).wait_for();assert not await g.evaluate('document.documentElement.scrollWidth>innerWidth');await g.screenshot(path=f'/tmp/browser/release/auction-{width}.png')
  await rpc(a,'host_control',{'p_room':rid,'p_action':'resume'});r=(await rpc(a,'room_projection',{'p_room':rid}))['room'];args={'p_room':rid,'p_amount':2,'p_lot':r['current_rp'],'p_version':r['lot_version'],'p_request':str(uuid.uuid4())}
  out=await asyncio.gather(raw(a,'place_bid',args),raw(g,'place_bid',{**args,'p_request':str(uuid.uuid4())}));assert sum(not v['error'] for v in out)==1;winner=a if not out[0]['error'] else g;winning=args if winner==a else None
  if winner==a: assert (await raw(a,'place_bid',args))['data']==2
  await a.get_by_role('region',name='Last sold').wait_for(timeout=15000);await rpc(a,'host_control',{'p_room':rid,'p_action':'pause'});r2=(await rpc(a,'room_projection',{'p_room':rid}))['room'];assert r2['current_rp']!=r['current_rp'];stale=await raw(g,'place_bid',{**args,'p_request':str(uuid.uuid4())});assert 'Player changed' in stale['error'];assert (await raw(a,'host_control',{'p_room':rid,'p_action':'skip','p_version':r['lot_version'],'p_status':'paused','p_sale':None}))['error'];print('PASS simultaneous bid winner, duplicate request, stale equal-price bid and host skip rejection')
  await a.wait_for_timeout(3500);await a.reload();await a.get_by_role('region',name='Last sold').wait_for();assert await a.locator('.sale-reveal').count()==0;await a.screenshot(path='/tmp/browser/release/last-sold-reconnect.png');await rpc(a,'host_control',{'p_room':rid,'p_action':'undo'});await a.wait_for_timeout(1200);assert await a.get_by_role('region',name='Last sold').count()==0
  await rpc(a,'host_control',{'p_room':rid,'p_action':'resume'});await rpc(a,'place_bid',{'p_room':rid,'p_amount':2});await a.get_by_role('region',name='Last sold').wait_for(timeout=15000);await rpc(a,'host_control',{'p_room':rid,'p_action':'pause'});await rpc(a,'host_control',{'p_room':rid,'p_action':'resume'});await rpc(a,'place_bid',{'p_room':rid,'p_amount':2});await a.wait_for_timeout(4500);await rpc(a,'host_control',{'p_room':rid,'p_action':'pause'});await rpc(a,'host_control',{'p_room':rid,'p_action':'end'});await rpc(a,'open_trades',{'p_room':rid,'p_minutes':1});await a.get_by_text('Trade window',exact=True).wait_for();parts=await a.evaluate('''async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('participants').select('id,user_id').eq('room_id',id)).data;}''',rid);squad=await a.evaluate('''async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('squads').select('*').eq('room_id',id)).data;}''',rid);owner=next(p for p in parts if p['id']==squad[0]['participant_id']);uid=await a.evaluate('''async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.auth.getUser()).data.user.id;}''');sender=a if owner['user_id']==uid else g;receiver=g if sender==a else a;target=next(p['id'] for p in parts if p['id']!=owner['id']);t=await rpc(sender,'propose_trade',{'p_room':rid,'p_to':target,'p_offer':[squad[0]['player_id']],'p_request':[],'p_cash':0});res=await asyncio.gather(raw(receiver,'respond_trade',{'p_trade':t,'p_action':'accept'}),raw(receiver,'respond_trade',{'p_trade':t,'p_action':'accept'}));assert sum(not v['error'] for v in res)==1;print('PASS persistent last sold, undo, real sale, trade acceptance exactly once')
  for fn,args in [('review_leadership',{'p_player':players[0]['id'],'p_captain':100,'p_vice':100,'p_sources':[],'p_rationale':'Release denial test','p_cutoff':'2026-10-29','p_confidence':1,'p_status':'reviewed'}),('import_evidence_bundle',{'p_bundle':{}}),('commit_room_evaluation',{'p_room':rid,'p_snapshot':None,'p_hash':'x','p_result':{}})]: assert (await raw(a,fn,args))['error'],fn
  await rpc(a,'host_control',{'p_room':rid,'p_action':'results'});await a.get_by_text('No valid-XI champion',exact=True).wait_for(timeout=45000);await g.get_by_text('No valid-XI champion',exact=True).wait_for(timeout=45000);await a.screenshot(path='/tmp/browser/release/results.png');print('PASS owner denial, canonical shared results, no page errors',len(errs));assert not errs,errs
  Path('/tmp/browser/release/room.json').write_text(json.dumps({'room':rid,'code':code}))
  await b.close()
if __name__=='__main__': asyncio.run(main())
