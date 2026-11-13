// Embedded PostgreSQL integration tests; no hosted rooms or production identities.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {DEFAULT_SETTINGS} from '../src/lib/auction-rules.ts';
import {generateQualityPool} from '../src/lib/quality-pool.ts';
const {PGlite}=await import(process.argv[2]);
const {pgcrypto}=await import(process.argv[2].replace('/index.js','/contrib/pgcrypto.js'));
const db=new PGlite({extensions:{pgcrypto}}),file=p=>readFileSync(p,'utf8');
async function user(uid,sql,args=[]){return db.transaction(async tx=>{await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);await tx.exec('SET LOCAL ROLE authenticated');return (await tx.query(sql,args)).rows[0]?.value;});}
const ids=[randomUUID(),randomUUID(),randomUUID()],host=ids[0],stranger=randomUUID();
const call=(uid,fn,args,casts)=>user(uid,`SELECT public.${fn}(${args.map((_,i)=>'$'+(i+1)+(casts?.[i]?'::'+casts[i]:'')).join(',')}) AS value`,args);
const projection=(uid,r)=>call(uid,'room_projection',[r]);
try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE PUBLICATION supabase_realtime;CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid,bucket_id text);`);
 for(const f of readdirSync('drizzle/migrations').filter(f=>f.endsWith('.sql')&&Number(f.slice(0,4))<29).sort()){
  await db.exec(file('drizzle/migrations/'+f));if(f.startsWith('0000'))await db.exec('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated');
 }
 await db.exec(file('scripts/crickauction-import.sql'));
 const settings={...DEFAULT_SETTINGS,max_teams:3,pool_size:100,purse:100000,review_seconds:1};
 const create=fn=>call(host,fn,['Local test','IPL',JSON.stringify(settings),'Host','CSK','#123456'],[null,null,'jsonb']);
 const old=await create('create_catalogue_room');
 await call(ids[1],'join_room',[old.code,'Old guest','MI','#111111']);
 const oldCat=await call(host,'room_catalogue',[old.room_id]);await call(host,'set_pool',[old.room_id,generateQualityPool(oldCat,settings,22).players.map(p=>p.id)]);
 await call(host,'start_review',[old.room_id]);const oldBefore=await projection(host,old.room_id);
 await db.exec(file('drizzle/migrations/0029_community_lineups_and_resilient_reads.sql'));
 await db.exec(file('drizzle/migrations/0030_ipl_teams_and_rating_comments.sql'));
 const oldAfter=await projection(host,old.room_id);assert.equal(oldAfter.room.community_mode,false);assert.deepEqual(oldAfter.pool,oldBefore.pool);
 const made=await create('create_social_room'),rid=made.room_id;
 for(let i=1;i<3;i++)await call(ids[i],'join_room',[made.code,'Guest'+i,'Team'+i,'#234567']);
 const catalogue=await call(host,'room_catalogue',[rid]);const selected=generateQualityPool(catalogue,settings,123);
 assert.equal(selected.players.length,100);assert.equal(selected.feasible,true);
 await call(host,'set_pool',[rid,selected.players.map(p=>p.id)]);
 await call(host,'start_review',[rid]);await db.query("UPDATE public.rooms SET review_ends_at=clock_timestamp()-interval '1 second' WHERE id=$1",[rid]);await call(host,'tick',[rid]);
 let p=await projection(host,rid),r=p.room;assert.equal(r.community_mode,true);assert.ok(p.pool[0].player.source_stats);
 const parts=(await db.query('SELECT * FROM public.participants WHERE room_id=$1 ORDER BY nickname',[rid])).rows;
 const partOf=uid=>parts.find(p=>p.user_id===uid).id;
 const lot=p.pool.find(x=>x.id===r.current_rp);let amount=Number(lot.player.base_price),accepted=0;
 // A burst of simultaneous stale-price requests: one winner, rejected peers, no duplicate acceptance.
 for(let i=0;i<30;i++){
  const requests=ids.map(uid=>({uid,args:[rid,amount,r.current_rp,r.lot_version,randomUUID()]}));
  const replies=await Promise.allSettled(requests.map(x=>call(x.uid,'place_bid_and_sync',x.args)));
  const winners=replies.map((reply,j)=>({reply,j})).filter(x=>x.reply.status==='fulfilled');assert.equal(winners.length,1);accepted++;
  const w=winners[0],value=w.reply.value;r=value.live.room;
  const retry=await call(requests[w.j].uid,'place_bid_and_sync',requests[w.j].args);assert.equal(Number(retry.amount),amount);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.bids WHERE room_id=$1',[rid])).rows[0].n,accepted);
  amount=Number(r.current_bid)+(Number(r.current_bid)<2?.1:Number(r.current_bid)<5?.25:.5);amount=Math.round(amount*100)/100;
 }
 await assert.rejects(()=>call(stranger,'place_bid_and_sync',[rid,amount,r.current_rp,r.lot_version,randomUUID()]));
 const command=async(action,payload={})=>{r=(await projection(host,rid)).room;return call(host,'auction_command_and_sync',[rid,action,r.current_rp,r.lot_version,r.status,r.control_revision,randomUUID(),JSON.stringify({...payload,observed_bid_revision:r.bid_revision})],[null,null,null,null,null,null,null,'jsonb']);};
 await command('final_call');await command('close_trades',{pending:[],minutes:7});r=(await projection(host,rid)).room;assert.equal(r.status,'trade');assert.ok(new Date(r.trade_ends_at).getTime()-Date.now()>410000);
 await assert.rejects(()=>call(ids[1],'community_control',[rid,'timers','trade',null,'{"trade_minutes":2,"lineup_minutes":3}'],[null,null,null,null,'jsonb']));
 await assert.rejects(()=>call(host,'community_control',[rid,'timers','trade',null,'{"trade_minutes":0,"lineup_minutes":3}'],[null,null,null,null,'jsonb']));
 await call(host,'community_control',[rid,'timers','trade',null,JSON.stringify({trade_minutes:2,lineup_minutes:3})],[null,null,null,null,'jsonb']);
 r=(await projection(host,rid)).room;assert.ok(new Date(r.trade_ends_at).getTime()-Date.now()<121000);
 // Fixture holdings exercise unrestricted, unbalanced transfers after a real auction close.
 await db.query('DELETE FROM public.squads WHERE room_id=$1',[rid]);
 const pool=(await projection(host,rid)).pool;
 for(let i=0;i<3;i++)for(const rp of pool.slice(i*12,i*12+12))await db.query("INSERT INTO public.squads(room_id,participant_id,player_id,room_player_id,price,acquired_via) VALUES($1,$2,$3,$4,1,'auction')",[rid,partOf(ids[i]),rp.player_id,rp.id]);
 const own=async uid=>(await db.query('SELECT player_id FROM public.squads WHERE room_id=$1 AND participant_id=$2 ORDER BY player_id',[rid,partOf(uid)])).rows.map(x=>x.player_id);
 const offered=await own(host),requested=(await own(ids[1])).slice(0,1);
 const trade=await call(host,'propose_trade',[rid,partOf(ids[1]),offered,requested,0,null]);await call(ids[1],'respond_trade',[trade,'accept']);assert.equal((await own(host)).length,1);assert.equal((await own(ids[1])).length,23);
 r=(await projection(host,rid)).room;await call(host,'host_control',[rid,'results',r.lot_version,'trade',null]);r=(await projection(host,rid)).room;assert.equal(r.post_phase,'lineup');assert.ok(new Date(r.phase_ends_at).getTime()-Date.now()>170000);
 const save=async(uid,confirm)=>{const order=(await own(uid)).slice(0,11);const overs=Object.fromEntries(order.map((id,i)=>[id,i<5?4:0]));const batting=Object.fromEntries(order.map(id=>[id,{from:1,to:20}]));return call(uid,'save_community_lineup',[rid,order,JSON.stringify(overs),JSON.stringify(batting),confirm],[null,null,'jsonb','jsonb']);};
 await save(host,false);
 assert.equal((await call(ids[1],'community_state',[rid])).lineups.length,0);
 await assert.rejects(()=>call(stranger,'community_state',[rid]));
 await assert.rejects(()=>user(ids[1],'SELECT * FROM public.community_lineups'));
 await assert.rejects(async()=>call(ids[1],'save_community_lineup',[rid,await own(host),'{}','{}',false],[null,null,'jsonb','jsonb']));
 await save(host,true);await save(ids[1],true);await save(ids[2],true);assert.equal((await projection(host,rid)).room.post_phase,'rating');
 assert.equal((await call(host,'community_state',[rid])).lineups.length,3);
 const rate=(uid,target,a,b,c,comment='')=>call(uid,'rate_community_team',[rid,partOf(target),a,b,c,comment]);
 await assert.rejects(()=>rate(host,host,10,10,10));await assert.rejects(()=>rate(host,ids[1],11,1,1));
 await assert.rejects(()=>rate(ids[1],host,8,6,10,'x'.repeat(501)));
 await rate(ids[1],host,8,6,10,' Strong bowling depth ');await rate(ids[1],host,8,6,10,'Strong bowling depth');
 const received=await call(host,'community_state',[rid]);assert.equal(received.visible_votes.length,1);assert.equal(received.visible_votes[0].comment,'Strong bowling depth');assert.equal(received.visible_votes[0].rater,partOf(ids[1]));
 assert.equal((await call(ids[2],'community_state',[rid])).visible_votes.length,0);
 await assert.rejects(()=>user(host,'SELECT * FROM public.community_votes'));
 assert.equal((await call(host,'community_state',[rid])).votes_received,1);
 await rate(ids[2],host,6,8,4);await rate(host,ids[1],10,9,8);await rate(ids[2],ids[1],4,5,6);await rate(host,ids[2],2,2,2);
 assert.equal((await call(host,'community_state',[rid])).results.length,0);
 await rate(ids[1],ids[2],8,8,8);const final=await call(host,'community_state',[rid]);assert.equal(final.phase,'done');assert.equal(final.visible_votes.length,6);assert.equal(final.results.find(x=>x.participant_id===partOf(host)).overall,7);assert.equal(final.results.find(x=>x.participant_id===partOf(ids[2])).overall,5);
 await assert.rejects(()=>rate(host,ids[1],1,1,1));await assert.rejects(()=>save(host,false));
 const live=await call(host,'room_sync',[rid]);assert.equal(await call(host,'room_poll',[rid,live.revision]),null);
 // Deadline transition and explicit partial-results close.
 const second=await create('create_social_room');await call(ids[1],'join_room',[second.code,'Guest','MI','#111111']);
 await db.query("UPDATE public.rooms SET status='results' WHERE id=$1",[second.room_id]);await db.query("UPDATE public.rooms SET phase_ends_at=clock_timestamp()-interval '1 second' WHERE id=$1",[second.room_id]);await call(ids[1],'tick',[second.room_id]);
 assert.equal((await projection(host,second.room_id)).room.post_phase,'rating');
 await assert.rejects(()=>call(host,'community_control',[second.room_id,'finish','results','rating','{}'],[null,null,null,null,'jsonb']));
 await call(host,'community_control',[second.room_id,'finish','results','rating','{"allow_incomplete":true}'],[null,null,null,null,'jsonb']);
 assert.ok((await call(host,'community_state',[second.room_id])).results.every(x=>x.overall===null&&x.voters===0));
 // IPL claims are transactionally unique; failed joins do not consume a room slot.
 const franchise=await call(host,'create_franchise_room',['IPL reservations',JSON.stringify(settings),'Host','CSK'],[null,'jsonb']);
 const fr=franchise.room_id;
 let entry=await call(ids[1],'room_entry',[franchise.code]);assert.equal(entry.ipl_franchises,true);assert.deepEqual(entry.taken,['CSK']);
 const claims=await Promise.allSettled(ids.slice(1).map(uid=>call(uid,'join_franchise_room',[franchise.code,'Guest','MI'])));
 assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);
 const winner=ids[claims.findIndex(x=>x.status==='fulfilled')+1],loser=ids[claims.findIndex(x=>x.status==='rejected')+1];
 assert.equal((await db.query('SELECT count(*)::int n FROM public.participants WHERE room_id=$1',[fr])).rows[0].n,2);
 await assert.rejects(()=>call(host,'claim_ipl_team',[fr,'MI']));
 assert.equal((await call(host,'room_entry',[franchise.code])).my_team,'CSK');
 await assert.rejects(()=>call(stranger,'claim_ipl_team',[fr,'RR']));
 await assert.rejects(()=>call(winner,'enable_ipl_teams',[fr]));
 await call(host,'update_my_team',[fr,'Fake team','#ffffff',true]);
 assert.equal((await db.query('SELECT team_name FROM public.participants WHERE room_id=$1 AND user_id=$2',[fr,host])).rows[0].team_name,'Chennai Super Kings');
 await call(host,'claim_ipl_team',[fr,'RR']);
 assert.equal((await db.query('SELECT is_ready FROM public.participants WHERE room_id=$1 AND user_id=$2',[fr,host])).rows[0].is_ready,false);
 assert.ok(!(await call(loser,'room_entry',[franchise.code])).taken.includes('CSK'));
 // Legacy join cannot bypass the requirement to choose a team before starting.
 await call(loser,'join_room',[franchise.code,'Third','Custom','#123456']);
 const cat=await call(host,'room_catalogue',[fr]);await call(host,'set_pool',[fr,generateQualityPool(cat,settings,12).players.map(p=>p.id)]);
 await assert.rejects(()=>call(host,'start_review',[fr]),/choose an available IPL team/);
 await call(loser,'claim_ipl_team',[fr,'CSK']);await call(host,'start_review',[fr]);
 await assert.rejects(()=>call(host,'claim_ipl_team',[fr,'GT']));
 assert.equal(await call(winner,'join_franchise_room',[franchise.code,'Ignore','GT']),fr);
 assert.equal((await call(winner,'room_entry',[franchise.code])).my_team,'MI');
 assert.equal((await projection(host,old.room_id)).room.ipl_franchises,false);
 await assert.rejects(()=>call(host,'claim_ipl_team',[old.room_id,'CSK']));
 await assert.rejects(()=>user(host,"SELECT public._ipl_team('CSK')"));
 assert.equal((await db.query("SELECT has_function_privilege('anon','public.claim_ipl_team(uuid,text)','EXECUTE') AS allowed")).rows[0].allowed,false);
 console.log('PASS: IPL duplicate claims, rollback, release/reclaim, locked identities, received rating comments and visibility');
 console.log('PASS: rapid/retry bids, private plans, unrestricted trades, custom deadlines, self-vote rejection, averages, missing votes, legacy compatibility and revision polling');
}finally{await db.close();}
