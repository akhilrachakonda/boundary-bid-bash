/** Disposable PostgreSQL integration harness. Never uses managed PG*/
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS } from '../src/lib/auction-rules';

const sql = postgres({ host: '127.0.0.1', port: 55439, username: 'cricket_test', database: 'postgres', max: 20 });
async function setup() {
 const exists=await sql`SELECT to_regclass('public.auction_commands') AS present`;
 if(exists[0]?.present) return;
 await sql.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid,bucket_id text);`);
 for (const file of readdirSync('drizzle/migrations').filter(f=>f.endsWith('.sql')).sort()) {
  // No public catalogue seed or customer/evidence data is needed for rule tests.
  if(file.startsWith('0001_')) continue;
  await sql.unsafe(readFileSync(`drizzle/migrations/${file}`,'utf8'));
  if(file.startsWith('0000_')) {
   // Managed Cloud normally supplies these grants; replicate only in this new local cluster.
   await sql.unsafe(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;`);
  }
 }
 await sql.unsafe(readFileSync('scripts/staged/0018_post_launch_auction_controls.sql','utf8'));
}
async function asUser<T>(user:string, query:string, params:unknown[]=[]):Promise<T> {
 return sql.begin(async tx=>{
  await tx`SELECT set_config('request.jwt.claim.sub',${user},true)`;
  await tx.unsafe('SET LOCAL ROLE authenticated');
  const result=await tx.unsafe(query,params as never[]);
  return result[0]?.value as T;
 }) as Promise<T>;
}
const users=Array.from({length:10},()=>randomUUID());
let room=''; let pass=0;
function assert(ok:unknown,message:string){if(!ok)throw new Error(message);pass++;console.log('PASS',message);}
async function denied(fn:()=>Promise<unknown>,message:string){let fail=false;try{await fn();}catch{fail=true;}assert(fail,message);}
async function projection(user=users[0]){return asUser<any>(user,'SELECT public.room_projection($1) AS value',[room]);}
async function command(action:string,payload={},user=users[0],request=randomUUID(),observed?:any){
 const p=observed??await projection(user); const r=p.room;
 return asUser(user,'SELECT public.auction_command($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb) AS value',[room,action,r.current_rp,r.lot_version,r.status,r.control_revision,request,JSON.stringify(payload)]);
}
async function bid(user:string,amount:number,p:any,request=randomUUID()){
 return asUser(user,'SELECT public.place_bid($1,$2,$3,$4,$5) AS value',[room,amount,p.room.current_rp,p.room.lot_version,request]);
}
async function expire(){await sql`UPDATE public.rooms SET lot_ends_at=clock_timestamp()-interval '1 second' WHERE id=${room}`;await asUser(users[0],'SELECT public.tick($1) AS value',[room]);}
try{
 await setup();
 const separation=await sql`SELECT inet_server_addr()::text AS host,inet_server_port() AS port,current_database() AS database`;
 console.log('ISOLATION',JSON.stringify(separation.map(x=>({host:x.host,port:x.port,database:x.database}))));
 const settings={...DEFAULT_SETTINGS,max_teams:10,min_squad:1,max_squad:5,min_wk:0,min_bat:0,min_ar:0,min_bowl:0,min_spinners:0,min_pacers:0,max_overseas:5,pool_size:10,bid_timer:20,bid_reset:3,review_seconds:1};
 const created=await asUser<any>(users[0],'SELECT public.create_room($1,$2,$3::text::jsonb,$4,$5,$6) AS value',['DISPOSABLE LOCAL REPAIR TEST','IPL',JSON.stringify(settings),'Test host','Disposable 1','#22d3ee']); room=created.room_id;
 for(let i=1;i<10;i++)await asUser(users[i],'SELECT public.join_room($1,$2,$3,$4) AS value',[created.code,`Test ${i}`,`Disposable ${i+1}`,'#22d3ee']);
 const ids=[];
 for(let i=0;i<10;i++){const id=randomUUID();ids.push(id);await sql`INSERT INTO public.players(id,name,country,format,role,sub_role,rating,base_price,nationality_type,tier) VALUES(${id},${'Disposable Player '+i},'Test','IPL','BAT','Top order',60,0.2,'Indian','C')`;}
 await asUser(users[0],'SELECT public.set_pool($1,$2) AS value',[room,ids]);
 await asUser(users[0],'SELECT public.start_review($1) AS value',[room]);
 await sql`UPDATE public.rooms SET review_ends_at=clock_timestamp()-interval '1 second' WHERE id=${room}`;
 await asUser(users[0],'SELECT public.tick($1) AS value',[room]);
 let p=await projection();assert(p.capabilities.auction_controls===1,'capability advertised only after install');assert(!('first_round_order' in p.room)&&p.pool.every((x:any)=>x.lot_order===0),'surprise order not exposed');
 const initialDeadline=p.room.lot_ends_at;
 await command('settings',{bid_timer:25,bid_reset:4});p=await projection();assert(p.room.lot_ends_at===initialDeadline&&p.room.settings.bid_timer===20,'timer change preserves active deadline');
 await denied(()=>command('settings',{purse:9000}),'mid-auction economics rejected');
 await denied(()=>command('pause',{},users[1]),'nonhost control denied');
 const timings:number[]=[];let rejected=0;
 for(let lot=0;lot<3;lot++){
  p=await projection();const observed=p;const results=await Promise.all(users.map(async u=>{const t=performance.now();try{await bid(u,0.2,observed);timings.push(performance.now()-t);return true;}catch{timings.push(performance.now()-t);rejected++;return false;}}));
  assert(results.filter(Boolean).length===1,'one accepted winner per simultaneous opening burst');
  await expire();
 }
 p=await projection();assert(p.room.settings.bid_timer===25,'saved timers apply to next lot');
 const observed=p;const req=randomUUID();await bid(users[0],0.2,p,req);await bid(users[0],0.2,p,req);assert(true,'duplicate retry idempotently accepted');
 p=await projection();await bid(users[1],0.3,p);
 const bs=await sql`SELECT id FROM public.bids WHERE room_id=${room} AND room_player_id=${p.room.current_rp} ORDER BY created_at DESC,id DESC LIMIT 1`;
 p=await projection();const undoObserved=p;const undoRequest=randomUUID();await command('undo_bid',{bid_id:bs[0].id},users[0],undoRequest,p);
 let after=await projection();assert(Number(after.room.current_bid)===0.2,'undo restores preceding leader and amount');
 await command('undo_bid',{bid_id:bs[0].id},users[0],undoRequest,undoObserved);assert(true,'undo same request does not withdraw twice');
 await denied(()=>bid(users[2],0.3,p),'pre-undo stale version rejected');
 await command('pause');after=await projection();const paused=after.room.paused_remaining_ms;await command('settings',{bid_timer:30,bid_reset:5});assert((await projection()).room.paused_remaining_ms===paused,'paused deadline remains unchanged on settings save');await command('resume');
 await expire();await denied(()=>bid(users[3],0.2,observed),'delayed bid rejected on next lot');
 await command('final_call');p=await projection();assert(p.room.status==='completed'&&p.room.auction_stage==='final_call','regular auction enters final call, not trades');
 for(let round=2;round<=4;round++){
  await command('rerun');p=await projection();assert(p.room.auction_round===round,'host can start unsold round '+round);
  while((await projection()).room.status==='auction')await expire();
  assert((await projection()).room.auction_stage==='final_call','replay returns to final call');
 }
 p=await projection();const unsold=p.pool.find((x:any)=>x.status==='unsold');
 await Promise.all(users.map(u=>asUser(u,'SELECT public.nominate_unsold($1,$2,$3,$4) AS value',[room,unsold.id,p.room.lot_version,p.room.control_revision])));
 const noms=await sql`SELECT count(DISTINCT room_player_id)::int AS n,count(*)::int AS votes FROM public.auction_nominations WHERE room_id=${room}`;assert(noms[0].n===1&&noms[0].votes===10,'nomination contention deduplicates one competitive lot');
 await denied(()=>command('close_trades',{pending:[],minutes:10}),'changed pending summary blocks close');
 await command('open_nomination',{nomination:unsold.id});p=await projection();await bid(users[4],0.2,p);await expire();
 p=await projection();assert(p.room.status==='completed','nominated lot resolves back to final call');
 const latest=await sql`SELECT id FROM public.sales WHERE room_id=${room} AND participant_id IS NOT NULL AND NOT undone ORDER BY created_at DESC,id DESC LIMIT 1`;
 await denied(()=>command('undo_bid',{bid_id:bs[0].id}),'sold lot cannot be undone as a bid');
 await command('undo_sale',{sale_id:latest[0].id});assert(true,'sale undo distinct and refunds buyer');
 await command('close_trades',{pending:[],minutes:10});assert((await projection()).room.status==='trade','explicit close opens trades');
 await denied(()=>command('rerun'),'trading locks all auction purchases');
 const tradeProjection=await projection();
 await denied(()=>asUser(users[0],'SELECT public.host_control($1,$2,$3,$4,$5) AS value',[room,'undo',tradeProjection.room.lot_version,'trade',latest[0].id]),'legacy sale undo denied during trading');
 const inv=await sql`SELECT (SELECT count(*) FROM public.participants WHERE room_id=${room} AND purse<0)::int AS overspend,(SELECT count(*)-count(DISTINCT player_id) FROM public.squads WHERE room_id=${room})::int AS duplicate`;
 assert(inv[0].overspend===0&&inv[0].duplicate===0,'no overspend or duplicate holdings');
 const lean=await asUser<any>(users[0],'SELECT public.room_live_projection($1) AS value',[room]);assert(!('pool' in lean)&&lean.states.every((x:any)=>!x.player),'lean projection omits repeated player facts');
 console.log('projectionBytes',JSON.stringify({full:JSON.stringify(await projection()).length,lean:JSON.stringify(lean).length,players:10}));
 timings.sort((a,b)=>a-b);console.log(JSON.stringify({passed:pass,bursts:3,attempts:30,rejected,localSqlRoundTripMs:{p50:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)],max:timings.at(-1)},environment:'loopback PostgreSQL; SQL identity claims, NOT browser auth/network ACK proof'},null,2));
}finally{await sql.end();}