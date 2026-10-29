import asyncio
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True);c=await b.new_context(viewport={'width':1280,'height':1800},storage_state='/tmp/browser/upgrade/host-session.json');p=await c.new_page();await p.goto('http://localhost:8080');r=await p.evaluate("""async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('room_evaluations').select('room_id,result').eq('version','v2.0')).data;}""");assert r
  for old in r:
   await p.goto('http://localhost:8080/room/'+old['room_id']);await p.get_by_text('v2.0 · cutoff',exact=False).wait_for();after=await p.evaluate("""async id=>{const {supabase}=await import('/src/integrations/supabase/client.ts');return (await supabase.from('room_evaluations').select('result').eq('room_id',id).single()).data.result;}""",old['room_id']);assert after==old['result'];assert not await p.get_by_text('Leadership game points',exact=False).count()
  print('PASS three persisted historical V2.0 rooms unchanged after new snapshot/scorer');await b.close()
asyncio.run(main())
