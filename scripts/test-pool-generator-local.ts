/** Isolated PostgreSQL checks for random 80/20 pools and room opening prices.
 * Requires a disposable cluster on 127.0.0.1:55439 with all drizzle migrations (except 0001 seed)
 * plus a copied public catalogue, snapshot row and pool_groups (see docs/REAL-DATA-ROSTER-UPDATE.md).
 * Never connects to the managed database. */
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS } from '../src/lib/auction-rules';

const sql = postgres({ host: '127.0.0.1', port: 55439, username: 'cricket_test', database: 'postgres', ssl: false, max: 4 });
let pass = 0;
const ok = (c: unknown, m: string) => { if (!c) throw new Error('FAIL ' + m); pass++; console.log('PASS', m); };
async function as<T>(user: string, q: string, p: unknown[] = []): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('request.jwt.claim.sub',${user},true)`;
    await tx.unsafe('SET LOCAL ROLE authenticated');
    const r = await tx.unsafe(q, p as never[]);
    return r[0]?.value as T;
  }) as Promise<T>;
}
async function fails(fn: () => Promise<unknown>, re: RegExp, m: string) {
  try { await fn(); ok(false, m); } catch (e) { ok(re.test(String((e as Error).message)), m + ' — ' + (e as Error).message.slice(0, 140)); }
}
const settings = { ...DEFAULT_SETTINGS, max_teams: 10, min_squad: 11, pool_size: 110 };
async function room(host: string, format: string) {
  await sql`DELETE FROM public.action_limits`;
  const r = await as<{ room_id: string }>(host, 'SELECT public.create_room($1,$2,$3::text::jsonb,$4,$5,$6) AS value', ['Fixture ' + format, format, JSON.stringify(settings), 'Host', 'Host XI', '#22d3ee']);
  return r.room_id;
}
async function pool(id: string) {
  return sql`SELECT p.id,p.role,p.sub_role,p.nationality_type FROM public.room_players rp JOIN public.players p ON p.id=rp.player_id WHERE rp.room_id=${id}`;
}
async function gen(host: string, id: string, n: number) {
  await sql`DELETE FROM public.action_limits`;
  return as<any>(host, 'SELECT public.generate_pool($1,$2) AS value', [id, n]);
}

const host = randomUUID(), guest = randomUUID();
await sql`INSERT INTO auth.users(id) VALUES (${host}),(${guest}) ON CONFLICT DO NOTHING`;
for (const format of ['IPL', 'T20', 'ODI']) {
  const id = await room(host, format);
  const r = (await sql`SELECT pool_rules FROM public.rooms WHERE id=${id}`)[0]!;
  ok(r.pool_rules === 'random-80-20-v1', `${format}: new room uses random-80-20-v1`);
  await fails(() => as(host, 'SELECT public.set_pool($1,$2::uuid[]) AS value', [id, []]), /80\/20 pool generator/, `${format}: client-supplied pool rejected`);
  await fails(() => as(guest, 'SELECT public.generate_pool($1,$2) AS value', [id, 110]), /Only the host/, `${format}: non-host cannot generate`);
  const a = await gen(host, id, 110);
  const p = await pool(id);
  ok(a.established === 88 && a.emerging === 22 && p.length === 110, `${format}: 10 teams x 11 -> 110 = 88 + 22`);
  ok(new Set(p.map((x) => x.id)).size === 110, `${format}: no duplicate players`);
  const c = (f: (x: any) => boolean) => p.filter(f).length;
  ok(c((x) => x.role === 'WK') >= 10 && c((x) => x.role === 'BAT') >= 30 && c((x) => x.role === 'AR') >= 20 && c((x) => x.role === 'BOWL') >= 40, `${format}: role minimums for 10 teams`);
  ok(c((x) => /spin/i.test(x.sub_role)) >= 10 && c((x) => x.nationality_type === 'Indian') >= 50, `${format}: spin and Indian-player feasibility for 10 teams`);
  const stored = (await sql`SELECT pool_generation FROM public.rooms WHERE id=${id}`)[0]!.pool_generation;
  ok(stored.group_rules === 'pool-groups-2' && stored.snapshot_id && typeof stored.seed === 'number', `${format}: seed, snapshot and group version persisted`);
  const again = await pool(id);
  ok(again.map((x) => x.id).sort().join() === p.map((x) => x.id).sort().join(), `${format}: re-reading (reconnect) keeps the same pool`);
  const b = await gen(host, id, 110);
  const p2 = await pool(id);
  const overlap = p2.filter((x) => p.some((y) => y.id === x.id)).length;
  ok(b.seed !== a.seed && overlap < 110, `${format}: regeneration draws a fresh pool (overlap ${overlap}/110)`);
  for (const n of [111, 125]) {
    const g = await gen(host, id, n);
    ok(g.emerging === Math.round(n * 0.2) && g.established === n - Math.round(n * 0.2), `${format}: N=${n} -> ${g.established} + ${g.emerging}`);
  }
  let failures = 0;
  for (let i = 0; i < 25; i++) { try { await gen(host, id, 110); } catch { failures++; } }
  ok(failures === 0, `${format}: 25 consecutive 10-team generations succeed (${failures} failures)`);
  if (format === 'ODI') await fails(() => gen(host, id, 150), /Largest exact 80\/20 pool: 131/, 'ODI: 150 fails before confirmation with capacity');
  else { const g = await gen(host, id, 150); ok(g.established === 120 && g.emerging === 30, `${format}: N=150 -> 120 + 30`); }
  await fails(() => gen(host, id, 100), /at least 110/, `${format}: pool smaller than 10 x 11 refused`);
}

// Opening price freeze and bid validation (IPL room, 2 teams, 22 players).
const id = await room(host, 'IPL');
await sql`UPDATE public.rooms SET settings=settings||'{"max_teams":2}'::jsonb WHERE id=${id}`;
const code = (await sql`SELECT code FROM public.rooms WHERE id=${id}`)[0]!.code;
await as(guest, 'SELECT public.join_room($1,$2,$3,$4) AS value', [code, 'Guest', 'Guest XI', '#f59e0b']);
await gen(host, id, 30);
await as(host, 'SELECT public.start_review($1) AS value', [id]);
const fr = (await sql`SELECT opening_price FROM public.rooms WHERE id=${id}`)[0]!;
ok(Number(fr.opening_price) === 0.2, 'opening price frozen from room min_base at review');
const facts = (await sql`SELECT player_facts FROM public.room_evaluation_inputs WHERE room_id=${id}`)[0]!.player_facts as any[];
ok(facts.length === 30 && facts.every((f) => Number(f.base_price) === 0.2 && 'catalogue_base_price' in f), 'every frozen player shows the common opening price');
await sql`UPDATE public.players SET base_price=base_price WHERE false`;
ok(Number((await sql`SELECT opening_price FROM public.rooms WHERE id=${id}`)[0]!.opening_price) === 0.2, 'later settings edits do not change the frozen opening price');
const legacy = (await sql`SELECT count(*)::int n FROM public.rooms WHERE pool_rules IS NULL AND opening_price IS NOT NULL`)[0]!.n;
ok(legacy === 0, 'no legacy room receives an opening price');
console.log(`\n${pass} checks passed`);
await sql.end();
