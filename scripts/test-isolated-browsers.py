"""Ten real native-Auth browser teams. Only localhost:8081 and 127.0.0.1:54321.
Run after prepare-isolated-stack.ts and start-isolated-app.py. Evidence stays in /tmp/browser.
No injected production sessions, hosted endpoints, SQL identity substitutes, or emails.
"""
import asyncio, json, time, uuid
from pathlib import Path
from playwright.async_api import async_playwright

APP = 'http://127.0.0.1:8081'
OUT = Path('/tmp/browser/cricket-native/ten-team')
OUT.mkdir(parents=True, exist_ok=True)
metrics = {'bid_ack_ms': [], 'host_ms': [], 'pending_visual_ms': [], 'requests': 0,
           'accepted': 0, 'rejected': 0, 'errors': [], 'checks': [], 'bursts': 0}

def check(ok, label):
    if not ok: raise AssertionError(label)
    metrics['checks'].append(label)
    print('PASS', label, flush=True)

async def raw(page, fn, args):
    return await page.evaluate('''async ([fn,args])=>{
      const {supabase}=await import('/src/integrations/supabase/client.ts');
      if(supabase.supabaseUrl!=='http://127.0.0.1:54321')throw Error('Not isolated');
      const r=await supabase.rpc(fn,args);return {data:r.data,error:r.error?.message,code:r.error?.code};
    }''', [fn,args])

async def rpc(page, fn, args):
    result=await raw(page,fn,args)
    check(not result.get('error'), fn+' accepted')
    return result['data']

async def project(page, room):
    r=await raw(page,'room_projection',{'p_room':room})
    if r.get('error'): raise AssertionError(r)
    return r['data']

async def command(page, room, action, payload=None, observed=None, request=None, deny=False):
    r=(observed or await project(page,room))['room']
    args={'p_room':room,'p_action':action,'p_lot':r['current_rp'],'p_version':r['lot_version'],
          'p_status':r['status'],'p_revision':r['control_revision'],'p_request':request or str(uuid.uuid4()),
          'p_payload':{**(payload or {}),'observed_bid_revision':r['bid_revision']}}
    start=time.perf_counter();out=await raw(page,'auction_command',args)
    metrics['host_ms'].append((time.perf_counter()-start)*1000)
    check(bool(out.get('error')) if deny else not out.get('error'),action+(' denied' if deny else ' accepted'))
    return out,args

async def query(page, table, room):
    return await page.evaluate('''async ([t,id])=>{const {supabase}=await import('/src/integrations/supabase/client.ts');
      const r=await supabase.from(t).select('*').eq('room_id',id);if(r.error)throw Error(r.error.message);return r.data;}''',[table,room])

async def wait_state(page,room,status,timeout=15):
    start=time.monotonic()
    while time.monotonic()-start<timeout:
        p=await project(page,room)
        if p['room']['status']==status:return p
        await asyncio.sleep(.15)
    raise AssertionError('Timeout '+status)

async def converge(pages,room):
    expected=(await project(pages[0],room))['room']
    start=time.monotonic()
    while time.monotonic()-start<8:
        states=await asyncio.gather(*[p.evaluate('''()=>{
          const h=document.querySelector('.auction-price');return {text:h?.textContent,connecting:document.body.textContent.includes('Reconnecting…')};
        }''') for p in pages])
        projections=await asyncio.gather(*[project(p,room) for p in pages])
        if all((p['room']['current_rp'],p['room']['current_bid'],p['room']['current_bidder'],p['room']['status'])==
               (expected['current_rp'],expected['current_bid'],expected['current_bidder'],expected['status']) for p in projections):
            check(True,'all ten authenticated projections agree');return
        await asyncio.sleep(.15)
    raise AssertionError('Client convergence')

async def burst(pages,room,count=4):
    for _ in range(count):
        # Requests are actual BID presses, not unbounded RPC generators.
        await asyncio.sleep(.35)
        before=metrics['requests']
        async def click(page):
            return await page.evaluate('''async()=>{
              const button=[...document.querySelectorAll('button')].find(b=>/^Bid ₹/.test(b.textContent));
              if(!button||button.disabled)return null;
              const t=performance.now();button.click();
              for(let i=0;i<19;i++)button.click();
              for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,0));
                if(document.body.textContent.includes('Confirming bid…'))return performance.now()-t;}
              return null;
            }''')
        visual=await asyncio.gather(*[click(p) for p in pages])
        metrics['pending_visual_ms'].extend(x for x in visual if x is not None)
        await asyncio.sleep(.55)
        metrics['bursts']+=1
        check(metrics['requests']-before<=len(pages),'20 rapid presses/team have no request backlog')
    await converge(pages,room)

async def main():
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        pages=[];contexts=[];starts={};room=None
        async def response(resp):
            if '/rest/v1/rpc/place_bid' not in resp.url:return
            t=starts.pop(id(resp.request),None)
            # Request objects can be rewrapped; browser timing supplies the durable fallback.
            timing=resp.request.timing
            elapsed=(timing['responseEnd'] if timing['responseEnd']>0 else timing['responseStart'])
            if t is not None:elapsed=(time.perf_counter()-t)*1000
            if elapsed>=0:metrics['bid_ack_ms'].append(elapsed)
            metrics['accepted' if resp.status<400 else 'rejected']+=1
        try:
            for i in range(10):
                c=await browser.new_context(viewport={'width':1280,'height':1800},reduced_motion='reduce' if i==9 else 'no-preference')
                p=await c.new_page();p.on('pageerror',lambda e:metrics['errors'].append(str(e)))
                # Fail closed: never send game traffic to the customer backend.
                await c.route('**/*',lambda route: route.abort() if '.supabase.' in route.request.url or 'boundary-bid-bash.lovable.app' in route.request.url else route.continue_())
                def request(req):
                    if '/rest/v1/rpc/place_bid' in req.url:
                        metrics['requests']+=1;starts[id(req)]=time.perf_counter()
                p.on('request',request);p.on('response',response)
                await p.goto(APP+'/auth');await p.wait_for_timeout(1700)
                await p.get_by_label('Nickname',exact=True).fill('LOCAL team '+str(i+1))
                await p.get_by_role('button',name='Continue as guest').click();await p.wait_for_url('**/create')
                auth=await p.evaluate("async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');const u=await supabase.auth.getUser();return {id:u.data.user?.id,guest:u.data.user?.is_anonymous};}")
                check(auth['guest'],'real Auth guest '+str(i+1));pages.append(p);contexts.append(c)
            host=pages[0]
            await host.locator('main input').first.fill('DISPOSABLE LOCAL ten-browser repairs')
            await host.get_by_role('button',name='Create room & open lobby').click();await host.wait_for_url('**/room/*')
            room=host.url.split('/')[-1];p=await project(host,room)
            s={**p['room']['settings'],'max_teams':10,'min_squad':1,'max_squad':5,'min_wk':0,'min_bat':0,'min_ar':0,'min_bowl':0,'min_spinners':0,'min_pacers':0,'max_overseas':5,'pool_size':16,'bid_timer':15,'bid_reset':1,'review_seconds':1}
            await rpc(host,'update_room_settings',{'p_room':room,'p_settings':s})
            for page in pages[1:]:
                await page.goto(APP+'/join?code='+p['room']['code']);await page.get_by_role('button',name='Join auction').click();await page.wait_for_url('**/room/*')
            catalogue=await host.evaluate("async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('players').select('id').like('name','DISPOSABLE LOCAL Player%')).data;}")
            await rpc(host,'set_pool',{'p_room':room,'p_player_ids':[x['id'] for x in catalogue]})
            await rpc(host,'start_review',{'p_room':room});await wait_state(host,room,'auction')
            await asyncio.gather(*[p.locator('.auction-broadcast').wait_for() for p in pages])
            await asyncio.sleep(1)
            p=await project(host,room)
            check(p['capabilities']['auction_controls']==1 and p['room']['repair_flow'],'repair controls actually activated')
            check('first_round_order' not in p['room'] and all(x['lot_order']==0 for x in p['pool']),'surprise queue network redaction')
            await command(pages[1],room,'pause',deny=True)
            stale=p
            await burst(pages,room,5)
            await command(host,room,'skip',observed=stale,deny=True)
            bids=await query(host,'bids',room);bids.sort(key=lambda x:x['accepted_order'] or 0,reverse=True)
            current=[b for b in bids if not b['undone'] and b['room_player_id']==p['room']['current_rp']]
            check(len(current)>=2,'sustained burst accepted multiple competitive bids')
            observed=await project(host,room);key=str(uuid.uuid4())
            out,args=await command(host,room,'undo_bid',{'bid_id':current[0]['id']},observed=observed,request=key)
            check(not (await raw(host,'auction_command',args)).get('error'),'same command ID replay idempotent')
            after=await project(host,room);check(float(after['room']['current_bid'])==float(current[1]['amount']),'undo restores accepted predecessor')
            original=[b for b in current if b['request_id']][0]
            owner=next(p for p in pages if await p.evaluate("async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.auth.getUser()).data.user.id;}")==next(t['user_id'] for t in await query(host,'participants',room) if t['id']==original['participant_id']))
            retry={'p_room':room,'p_lot':original['room_player_id'],'p_amount':original['amount'],'p_version':observed['room']['lot_version'],'p_request':original['request_id']}
            check(not (await raw(owner,'place_bid',retry)).get('error'),'duplicate accepted request does not add bid')
            await command(host,room,'pause');paused=await project(host,room)
            await host.get_by_role('button',name='Lot settings',exact=True).click()
            await host.get_by_label('Timer · seconds',exact=True).fill('4');await host.get_by_label('Bid extension · seconds',exact=True).fill('1')
            await host.get_by_role('button',name='Save for next lot').click();await host.get_by_role('dialog').wait_for(state='hidden')
            after=await project(host,room);check(after['room']['paused_remaining_ms']==paused['room']['paused_remaining_ms'],'settings preserve paused deadline')
            await command(host,room,'resume')
            # Resolve fair winner and preserve overlay on final-call transition.
            await command(host,room,'final_call');await wait_state(host,room,'completed')
            await pages[1].locator('.sale-reveal').wait_for(timeout=8000)
            for width in [360,390,430,1280]:
                await pages[1].set_viewport_size({'width':width,'height':900 if width<1000 else 1800})
                check(not await pages[1].evaluate('document.documentElement.scrollWidth>innerWidth'),'no sale overflow '+str(width))
                await pages[1].screenshot(path=str(OUT/('sold-'+str(width)+'.png')))
            await asyncio.sleep(3)
            check(await pages[1].locator('.sale-reveal').count()==0,'celebration expires without blocking final call')
            await pages[1].reload();await pages[1].get_by_role('heading',name='Final call',exact=False).wait_for()
            check(await pages[1].locator('.sale-reveal').count()==0,'reconnect does not replay sales')
            old=await project(host,room)
            for round_number in [2,3]:
                await command(host,room,'rerun');await wait_state(host,room,'auction')
                check((await project(host,room))['room']['auction_round']==round_number,'repeat shuffled round '+str(round_number))
                await asyncio.sleep(.7);await burst(pages,room,3)
                await command(host,room,'skip')
                await command(host,room,'final_call');await wait_state(host,room,'completed')
            unsold=next(x for x in (await project(host,room))['pool'] if x['status']=='unsold')
            p=await project(host,room)
            results=await asyncio.gather(*[raw(page,'nominate_unsold',{'p_room':room,'p_lot':unsold['id'],'p_version':p['room']['lot_version'],'p_revision':p['room']['control_revision']}) for page in pages])
            check(all(not x.get('error') for x in results),'ten real nominations contend successfully')
            check(len(set(x['room_player_id'] for x in await query(host,'auction_nominations',room)))==1,'nominations deduplicate one competitive lot')
            await command(host,room,'close_trades',{'pending':[],'minutes':10},deny=True)
            await command(host,room,'open_nomination',{'nomination':unsold['id']});await asyncio.sleep(.8)
            await burst(pages,room,3);await wait_state(host,room,'completed',timeout=15)
            sales=await query(host,'sales',room);sales.sort(key=lambda x:x['created_at'],reverse=True)
            last=next(x for x in sales if x['participant_id'] and not x['undone'])
            await command(host,room,'undo_sale',{'sale_id':last['id']})
            check(next(x for x in await query(host,'sales',room) if x['id']==last['id'])['undone'],'sale undo recorded separately')
            await command(host,room,'close_trades',{'pending':[],'minutes':10});await wait_state(host,room,'trade')
            await command(host,room,'rerun',deny=True)
            check((await raw(pages[2],'place_bid',{'p_room':room,'p_lot':old['room']['current_rp'],'p_version':old['room']['lot_version'],'p_amount':.2,'p_request':str(uuid.uuid4())})).get('error'),'stale bid after trade denied')
            participants=await query(host,'participants',room);squads=await query(host,'squads',room)
            check(all(float(p['purse'])>=0 for p in participants) and len(squads)==len(set(x['player_id'] for x in squads)),'zero overspend and duplicate ownership')
            check(not metrics['errors'],'zero browser page errors')
        finally:
            def stats(values):
                if not values:return None
                values=sorted(values);return {'n':len(values),'p50':values[int(len(values)*.5)],'p95':values[min(len(values)-1,int(len(values)*.95))],'max':max(values)}
            metrics['summary']={k:stats(metrics[k]) for k in ['bid_ack_ms','host_ms','pending_visual_ms']}
            metrics['room']=room
            (OUT/'results.json').write_text(json.dumps(metrics,indent=2))
            print('METRICS',json.dumps(metrics['summary']),flush=True)
            await browser.close()

if __name__=='__main__':asyncio.run(main())