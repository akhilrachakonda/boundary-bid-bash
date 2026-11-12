// Disposable embedded PostgreSQL verification. No network or production credentials.
// Pass the locally installed @electric-sql/pglite module path as argv[2].
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS,generateBalancedPool } from '../src/lib/auction-rules.ts';
const {PGlite}=await import(process.argv[2]);
const {pgcrypto}=await import(process.argv[2].replace('/index.js','/contrib/pgcrypto.js'));
const db=new PGlite({extensions:{pgcrypto}});
const text=p=>readFileSync(p,'utf8');
async function user(uid,sql,params=[]) {
 return db.transaction(async tx=>{
  await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);
  await tx.exec('SET LOCAL ROLE authenticated');
  return (await tx.query(sql,params)).rows[0]?.value;
 });
}
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE PUBLICATION supabase_realtime; CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid,bucket_id text);`);
 for(const file of readdirSync('drizzle/migrations').filter(f=>f.endsWith('.sql')&&Number(f.slice(0,4))<27).sort()) {
  console.log('MIGRATE',file);
  await db.exec(text('drizzle/migrations/'+file));
  if(file.startsWith('0000')) await db.exec('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated');
 }
 const host=randomUUID(),guest=randomUUID(),stranger=randomUUID();
 const settings={...DEFAULT_SETTINGS,max_teams:2,review_seconds:1};
 const make=async (fn,fmt='IPL',s=settings)=>user(host,`SELECT public.${fn}($1,$2,$3::jsonb,$4,$5,$6) AS value`,['Local check',fmt,JSON.stringify(s),'Host','CSK','#ffca00']);
 const old=await make('create_room');
 const before=(await db.query('SELECT to_jsonb(r) AS room FROM public.rooms r WHERE id=$1',[old.room_id])).rows[0].room;
 await db.exec(text('drizzle/migrations/0027_versioned_ipl_catalogue_and_action_sync.sql'));
 await db.exec(text('scripts/crickauction-import.sql'));
 await db.exec(text('scripts/crickauction-import.sql'));
 const after=(await db.query('SELECT to_jsonb(r)-\'catalogue_version\' AS room FROM public.rooms r WHERE id=$1',[old.room_id])).rows[0].room;
 assert.deepEqual(after,before);
 for(const format of ['IPL','T20','ODI']) {
  const made=await make('create_catalogue_room',format);
  const cat=await user(host,'SELECT public.room_catalogue($1) AS value',[made.room_id]);
  assert.equal(cat.length,format==='IPL'?273:150);
  const first=generateBalancedPool(cat,settings,123),second=generateBalancedPool(cat,settings,456);
  assert.equal(first.feasible,true); assert.equal(second.feasible,true);
  assert.notDeepEqual(first.players.map(p=>p.id),second.players.map(p=>p.id));
  assert.equal(await user(host,'SELECT public.set_pool($1,$2::uuid[]) AS value',[made.room_id,second.players.map(p=>p.id)]),second.players.length);
  await assert.rejects(()=>user(stranger,'SELECT public.room_catalogue($1) AS value',[made.room_id]));
  if(format!=='IPL') continue;
  await user(guest,'SELECT public.join_room($1,$2,$3,$4) AS value',[made.code,'Guest','MI','#123456']);
  await user(host,'SELECT public.start_review($1) AS value',[made.room_id]);
  await db.query("UPDATE public.rooms SET review_ends_at=clock_timestamp()-interval '1 second' WHERE id=$1",[made.room_id]);
  await user(host,'SELECT public.tick($1) AS value',[made.room_id]);
  const projection=await user(host,'SELECT public.room_projection($1) AS value',[made.room_id]);
  const room=projection.room,lot=projection.pool.find(p=>p.id===room.current_rp);
  assert.ok(lot.player.source_stats); assert.equal(room.evaluation_version,'v2.1');
  assert.ok(!('first_round_order' in room)); assert.ok(projection.pool.every(p=>p.lot_order===0));
  const args=[room.id,lot.player.base_price,lot.id,room.lot_version,randomUUID()];
  const bid=await user(host,'SELECT public.place_bid_and_sync($1,$2,$3,$4,$5) AS value',args);
  assert.equal(Number(bid.amount),Number(lot.player.base_price)); assert.equal(bid.live.bids.length,1);
  const duplicate=await user(host,'SELECT public.place_bid_and_sync($1,$2,$3,$4,$5) AS value',args);
  assert.equal(duplicate.live.bids.length,1);
  await assert.rejects(()=>user(stranger,'SELECT public.room_sync($1) AS value',[room.id]));
  const r=bid.live.room;
  const command=[r.id,'pause',r.current_rp,r.lot_version,r.status,r.control_revision,randomUUID(),JSON.stringify({observed_bid_revision:r.bid_revision})];
  const paused=await user(host,'SELECT public.auction_command_and_sync($1,$2,$3,$4,$5,$6,$7,$8::jsonb) AS value',command);
  assert.equal(paused.live.room.status,'paused');assert.equal(paused.live.participants.length,2);
  await assert.rejects(()=>user(guest,'SELECT public.auction_command_and_sync($1,$2,$3,$4,$5,$6,$7,$8::jsonb) AS value',[...command.slice(0,6),randomUUID(),command[7]]));
  console.log('PASS frozen source stats, catalogue price, retry deduplication, host guard, one-response bid and pause');
 }
 const allRoom=await make('create_catalogue_room','IPL',{...settings,pool_size:273});
 const all=await user(host,'SELECT public.room_catalogue($1) AS value',[allRoom.room_id]);
 assert.equal(await user(host,'SELECT public.set_pool($1,$2::uuid[]) AS value',[allRoom.room_id,all.map(p=>p.id)]),273);
 console.log('PASS 273-player pool, all formats, idempotent import, historical room preservation');
} finally {await db.close();}
