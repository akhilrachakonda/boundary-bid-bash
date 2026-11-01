/** Official native stack only; fails closed before writes for any non-loopback URL. */
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export function localEnvironment(path: string) {
  const values = Object.fromEntries(readFileSync(path, 'utf8').split('\n').filter(line => line.includes('='))
    .map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1).replace(/^["']|["']$/g,'')]; }));
  for (const [key, port] of [['API_URL','54321'],['DB_URL','54322']] as const) {
    const url = new URL(values[key] ?? '');
    if(url.hostname!=='127.0.0.1'||url.port!==port) throw Error('Refusing non-isolated service configuration');
  }
  return values;
}
const path=process.argv[2];
if(!path) throw Error('Usage: bun scripts/prepare-isolated-stack.ts /tmp/local-stack.env');
const values=localEnvironment(path);
const sql=postgres(values['DB_URL'] ?? '',{max:1});
try {
  const [identity]=await sql`SELECT inet_server_addr()::text host,inet_server_port() port,current_database() database,current_setting('data_directory') data_directory`;
  console.log('Local server identity',identity);
  if(!String(identity?.data_directory).startsWith('/tmp/cricket-native/home/stacks/')) throw Error('Isolation data-directory mismatch');
  console.log('ISOLATION',identity);
  if(!(await sql`SELECT to_regclass('storage.objects') object`)[0]?.object) throw Error('Start official native storage service before setup; no stand-in tables');
  const installed=(await sql`SELECT to_regclass('public.auction_commands') present`)[0]?.present;
  if(!installed) {
    // Do not import production catalogue/evidence. Never replace Auth with SQL claims.
    for(const file of readdirSync('drizzle/migrations').filter(f=>f.endsWith('.sql')&&!f.startsWith('0001_')).sort()) {
      await sql.begin(tx=>tx.unsafe(readFileSync(`drizzle/migrations/${file}`,'utf8')));
      console.log('Local migration',file);
    }
    await sql.begin(tx=>tx.unsafe(readFileSync('scripts/staged/0018_post_launch_auction_controls.sql','utf8')));
  }
  for(let i=0;i<16;i++) {
    const name=`DISPOSABLE LOCAL Player ${i+1}`;
    if((await sql`SELECT id FROM public.players WHERE name=${name}`).length) continue;
    await sql`INSERT INTO public.players(id,name,country,format,role,sub_role,rating,base_price,nationality_type,tier)
      VALUES(${randomUUID()},${name},'Test','IPL','BAT','Top order',60,0.2,'Indian','C')`;
  }
  await sql`NOTIFY pgrst, 'reload schema'`;
  console.log('Native schema installed; 16 synthetic players; no production reads, accounts, or data');
} finally { await sql.end(); }