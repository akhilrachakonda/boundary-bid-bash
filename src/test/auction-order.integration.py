"""Real two-guest regression check. Run: python3 src/test/auction-order.integration.py."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
U = 'http://localhost:8080'
OUT = Path('/tmp/browser/random-order')
OUT.mkdir(parents=True, exist_ok=True)

async def rpc(page, fn, args):
    result = await page.evaluate('''async ([fn,args]) => {const {supabase}=await import('/src/integrations/supabase/client.ts');const r=await supabase.rpc(fn,args);return {data:r.data,error:r.error?.message};}''', [fn,args])
    assert not result.get('error'), (fn,result.get('error'))
    return result['data']
async def snapshot(page, room):
    return await page.evaluate('''async room=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const r=await supabase.from('rooms').select('*').eq('id',room).single();const p=await supabase.from('room_players').select('*').eq('room_id',room).order('round').order('lot_order');const s=await supabase.from('sales').select('*').eq('room_id',room);const q=await supabase.from('squads').select('*').eq('room_id',room);const t=await supabase.from('participants').select('id,purse').eq('room_id',room);if(r.error||p.error)throw Error('Snapshot failed');return {room:r.data,pool:p.data,sales:s.data,squads:q.data,teams:t.data};}''', room)
async def main():
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        ca=await browser.new_context(viewport={'width':1280,'height':1800},storage_state='/tmp/browser/upgrade/host-session.json')
        cb=await browser.new_context(viewport={'width':390,'height':1000},storage_state='/tmp/browser/upgrade/guest-session.json')
        a=await ca.new_page(); b=await cb.new_page(); errors=[]
        a.on('pageerror',lambda e:errors.append(str(e)))
        for page,nick in [(a,'Order host'),(b,'Order guest')]:
            await page.goto(U);await page.wait_for_timeout(1000)
        # Read an existing legacy room without advancing or altering its gameplay.
        legacy=await a.evaluate('''async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('rooms').select('id').is('first_round_order',null).in('status',['paused','completed','results']).limit(1)).data?.[0]?.id;}''')
        legacy_before=await snapshot(a,legacy) if legacy else None
        settings=dict(max_teams=2,min_squad=2,max_squad=8,min_wk=0,min_bat=0,min_ar=0,min_bowl=0,max_overseas=8,min_spinners=0,min_pacers=0,purse=100,pool_size=8,bid_timer=3,bid_reset=1,increments=[dict(upto=None,step=.5)],review_seconds=120,min_base=.2,currency='cr')
        cr=await rpc(a,'create_room',dict(p_name='Random order regression',p_format='IPL',p_settings=settings,p_nickname='Host',p_team='Order Royals',p_color='#f4c34d'));rid=cr['room_id']
        await rpc(b,'join_room',dict(p_code=cr['code'],p_nickname='Guest',p_team='Order Kings',p_color='#29d7ee'))
        players=await a.evaluate('''async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('players').select('id,role,rating').eq('format','IPL').order('rating',{ascending:false})).data;}''')
        ids=[]
        for role in ['WK','BAT','AR','BOWL']:ids.extend([p['id'] for p in players if p['role']==role][:2])
        await rpc(a,'set_pool',dict(p_room=rid,p_player_ids=ids));confirmed=await snapshot(a,rid)
        await rpc(a,'start_review',dict(p_room=rid));await a.goto(U+'/room/'+rid);await b.goto(U+'/room/'+rid)
        await a.get_by_text('Auction order is randomized when bidding starts',exact=True).wait_for();await a.screenshot(path=str(OUT/'review-desktop.png'));await b.screenshot(path=str(OUT/'review-mobile.png'))
        assert await a.get_by_role('option',name='Auction order',exact=True).count()==0
        await rpc(a,'host_control',dict(p_room=rid,p_action='skip_review'))
        starts=await asyncio.gather(rpc(a,'tick',dict(p_room=rid)),rpc(b,'tick',dict(p_room=rid)))
        assert sorted(starts)==['noop','started'],starts
        await rpc(a,'host_control',dict(p_room=rid,p_action='pause'))
        state=await snapshot(a,rid);order=state['room']['first_round_order']
        assert sorted(order)==sorted(ids) and len(set(order))==8
        assert {p['id'] for p in state['pool']}=={p['id'] for p in confirmed['pool']}
        assert [p['player_id'] for p in state['pool']]==order
        assert (await snapshot(b,rid))['pool']==state['pool']
        for _ in range(3):await rpc(a,'tick',dict(p_room=rid))
        assert (await snapshot(a,rid))['room']['first_round_order']==order
        await a.reload();await b.reload();await a.locator('.auction-broadcast').wait_for();await b.locator('.auction-broadcast').wait_for()
        assert (await snapshot(a,rid))['pool']==(await snapshot(b,rid))['pool']==state['pool']
        pending=[p for p in state['pool'] if p['status']=='pending']
        names=await a.locator('.upcoming-player').all_inner_texts()
        assert len(names)==min(6,len(pending))
        await a.screenshot(path=str(OUT/'auction-desktop.png'));await b.screenshot(path=str(OUT/'auction-mobile.png'))
        assert not await b.evaluate('document.documentElement.scrollWidth>innerWidth')
        print('PASS confirmed IDs, preserved room-player IDs, shared queue, concurrent/repeated starts, reload, mobile')
        await rpc(a,'host_control',dict(p_room=rid,p_action='resume'))
        first=next(p for p in state['pool'] if p['id']==state['room']['current_rp'])
        base=await a.evaluate('''async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('players').select('base_price').eq('id',id).single()).data.base_price;}''',first['player_id'])
        await rpc(a,'place_bid',dict(p_room=rid,p_amount=base))
        for _ in range(30):
            state=await snapshot(a,rid)
            if state['sales']:break
            await a.wait_for_timeout(300)
        assert len(state['sales'])==1 and len(state['squads'])==1
        await rpc(a,'host_control',dict(p_room=rid,p_action='pause'))
        live_before=(await snapshot(a,rid))['room']['current_rp']
        await rpc(a,'host_control',dict(p_room=rid,p_action='undo'));undo=await snapshot(a,rid)
        assert undo['room']['current_rp']==live_before and undo['room']['first_round_order']==order
        assert not undo['squads'] and all(t['purse']==100 for t in undo['teams']) and undo['sales'][0]['undone']
        await rpc(a,'host_control',dict(p_room=rid,p_action='skip'));await rpc(a,'host_control',dict(p_room=rid,p_action='pause'))
        assert (await snapshot(a,rid))['room']['current_rp']==first['id']
        # Sell the returned lot; only the other confirmed players may accelerate.
        await rpc(a,'host_control',dict(p_room=rid,p_action='resume'))
        await rpc(a,'place_bid',dict(p_room=rid,p_amount=base))
        for _ in range(30):
            state=await snapshot(a,rid)
            if state['squads']:break
            await a.wait_for_timeout(300)
        assert len(state['squads'])==1
        await rpc(a,'host_control',dict(p_room=rid,p_action='pause'))
        expected_unsold=[id for id in ids if id!=first['player_id']]
        # Consume the entire first pass through existing host skip semantics.
        for _ in range(10):
            state=await snapshot(a,rid)
            if state['room']['accel_done']:break
            await rpc(a,'host_control',dict(p_room=rid,p_action='skip'));await rpc(a,'host_control',dict(p_room=rid,p_action='pause'))
        accel=await snapshot(a,rid);accel_order=accel['room']['accelerated_order']
        assert accel['room']['accel_done'] and sorted(accel_order)==sorted(expected_unsold) and len(set(accel_order))==7
        assert [p['player_id'] for p in accel['pool'] if p['round']==2]==accel_order
        assert accel['room']['first_round_order']==order
        await a.reload();await rpc(a,'tick',dict(p_room=rid));assert (await snapshot(a,rid))['room']['accelerated_order']==accel_order
        # Sell then undo in accelerated round; original shuffled snapshot remains frozen.
        await rpc(a,'host_control',dict(p_room=rid,p_action='resume'))
        current=next(p for p in accel['pool'] if p['id']==accel['room']['current_rp'])
        base=await a.evaluate('''async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('players').select('base_price').eq('id',id).single()).data.base_price;}''',current['player_id'])
        await rpc(a,'place_bid',dict(p_room=rid,p_amount=base))
        for _ in range(30):
            state=await snapshot(a,rid)
            if len(state['squads'])==2:break
            await a.wait_for_timeout(300)
        assert len(state['squads'])==2
        await rpc(a,'host_control',dict(p_room=rid,p_action='pause'));await rpc(a,'host_control',dict(p_room=rid,p_action='undo'))
        state=await snapshot(a,rid);assert len(state['squads'])==1 and state['room']['accelerated_order']==accel_order
        for _ in range(10):
            state=await snapshot(a,rid)
            if state['room']['status']=='completed':break
            await rpc(a,'host_control',dict(p_room=rid,p_action='skip'))
            if (await snapshot(a,rid))['room']['status']!='completed':await rpc(a,'host_control',dict(p_room=rid,p_action='pause'))
        final=await snapshot(a,rid);assert final['room']['status']=='completed' and len(final['squads'])==1
        assert sum(p['status']=='unsold' for p in final['pool'])==7 and len(final['pool'])==8
        active_sales=[s for s in final['sales'] if s['participant_id'] and not s['undone']];assert len(active_sales)==1
        assert final['room']['accelerated_order']==accel_order and final['room']['first_round_order']==order
        print('PASS first/accelerated undo refunds, skip, single unsold shuffle, completion without lost players/duplicate sales')
        assert final['squads'][0]['player_id']==first['player_id']
        assert not errors,errors
        print('PASS browser runtime errors: 0')
        if legacy:
            legacy_after=await snapshot(a,legacy)
            assert legacy_after['pool']==legacy_before['pool']
            assert legacy_after['room']==legacy_before['room']
            print('PASS existing legacy room state and queue unaffected')
        else:
            print('UNVERIFIED no accessible existing legacy room')
        await browser.close()
asyncio.run(main())
