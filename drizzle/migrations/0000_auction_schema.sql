-- ========== ROLES ==========
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ========== PLAYERS ==========
create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  format text not null check (format in ('IPL','T20','ODI')),
  role text not null check (role in ('WK','BAT','AR','BOWL')),
  sub_role text not null,
  batting_hand text not null default 'Right',
  bowling_style text not null default 'None',
  rating int not null check (rating between 1 and 100),
  base_price numeric(6,2) not null,
  nationality_type text not null check (nationality_type in ('Indian','Overseas')),
  age_group text not null default 'Prime',
  tier text not null check (tier in ('Marquee','A','B','C','Uncapped')),
  image_placeholder text,
  created_at timestamptz not null default now(),
  unique (name, format)
);
grant select on public.players to authenticated;
grant insert, update, delete on public.players to authenticated;
grant all on public.players to service_role;
alter table public.players enable row level security;
create policy "players readable" on public.players for select to authenticated using (true);
create policy "admin insert players" on public.players for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update players" on public.players for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete players" on public.players for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ========== ROOMS ==========
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  host_id uuid not null,
  format text not null check (format in ('IPL','T20','ODI')),
  settings jsonb not null,
  status text not null default 'lobby' check (status in ('lobby','review','auction','paused','completed','trade','results')),
  review_ends_at timestamptz,
  current_rp uuid,
  current_bid numeric(8,2),
  current_bidder uuid,
  lot_ends_at timestamptz,
  paused_remaining_ms int,
  accel_done boolean not null default false,
  trade_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  nickname text not null,
  team_name text not null,
  color text not null default '#f5b301',
  purse numeric(8,2) not null,
  is_ready boolean not null default false,
  last_seen timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id),
  set_name text not null,
  lot_order int not null,
  round int not null default 1,
  status text not null default 'pending' check (status in ('pending','live','sold','unsold')),
  sold_to uuid references public.participants(id),
  sold_price numeric(8,2),
  unique (room_id, player_id)
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_player_id uuid not null references public.room_players(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  amount numeric(8,2) not null,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_player_id uuid not null references public.room_players(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  price numeric(8,2),
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  player_id uuid not null references public.players(id),
  room_player_id uuid not null references public.room_players(id) on delete cascade,
  price numeric(8,2) not null,
  acquired_via text not null default 'auction',
  created_at timestamptz not null default now(),
  unique (room_id, player_id)
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  from_participant uuid not null references public.participants(id) on delete cascade,
  to_participant uuid not null references public.participants(id) on delete cascade,
  offer_players uuid[] not null default '{}',
  request_players uuid[] not null default '{}',
  cash numeric(8,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','countered','cancelled','expired')),
  parent_trade_id uuid references public.trades(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.room_events (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.private_notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  targets jsonb not null default '{}'::jsonb,
  xi jsonb not null default '{"order":[],"overs":{}}'::jsonb,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (room_id, user_id)
);

grant select on public.rooms, public.participants, public.room_players, public.bids, public.sales, public.squads, public.trades, public.room_events to authenticated;
grant all on public.rooms, public.participants, public.room_players, public.bids, public.sales, public.squads, public.trades, public.room_events, public.private_notes to service_role;
grant usage, select on sequence public.room_events_id_seq to service_role;
grant select, insert, update, delete on public.private_notes to authenticated;

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.room_players enable row level security;
alter table public.bids enable row level security;
alter table public.sales enable row level security;
alter table public.squads enable row level security;
alter table public.trades enable row level security;
alter table public.room_events enable row level security;
alter table public.private_notes enable row level security;

create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participants where room_id = p_room and user_id = auth.uid())
$$;

create policy "members read rooms" on public.rooms for select to authenticated using (public.is_room_member(id));
create policy "members read participants" on public.participants for select to authenticated using (public.is_room_member(room_id));
create policy "members read pool" on public.room_players for select to authenticated using (public.is_room_member(room_id));
create policy "members read bids" on public.bids for select to authenticated using (public.is_room_member(room_id));
create policy "members read sales" on public.sales for select to authenticated using (public.is_room_member(room_id));
create policy "members read squads" on public.squads for select to authenticated using (public.is_room_member(room_id));
create policy "members read trades" on public.trades for select to authenticated using (public.is_room_member(room_id));
create policy "members read events" on public.room_events for select to authenticated using (public.is_room_member(room_id));
create policy "owner read notes" on public.private_notes for select to authenticated using (user_id = auth.uid());
create policy "owner insert notes" on public.private_notes for insert to authenticated with check (user_id = auth.uid() and public.is_room_member(room_id));
create policy "owner update notes" on public.private_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner delete notes" on public.private_notes for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.rooms, public.participants, public.room_players, public.bids, public.squads, public.trades, public.room_events;

create or replace function public._me(p_room uuid) returns public.participants
language plpgsql stable security definer set search_path = public as $$
declare me public.participants;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into me from public.participants where room_id = p_room and user_id = auth.uid();
  if not found then raise exception 'You are not in this room'; end if;
  return me;
end $$;

create or replace function public._log(p_room uuid, p_kind text, p_msg text) returns void
language sql security definer set search_path = public as $$
  insert into public.room_events(room_id, kind, message) values (p_room, p_kind, p_msg);
$$;

create or replace function public._is_spinner(p_sub text) returns boolean language sql immutable as $$
  select p_sub ilike '%spin%'
$$;
create or replace function public._is_pacer(p_role text, p_sub text) returns boolean language sql immutable as $$
  select p_role in ('BOWL','AR') and (p_sub ilike '%pace%' or p_sub ilike '%medium%')
$$;

create or replace function public.next_bid_amount(p_settings jsonb, p_current numeric, p_base numeric)
returns numeric language plpgsql immutable as $$
declare inc jsonb; step numeric := 0.5;
begin
  if p_current is null then return p_base; end if;
  for inc in select * from jsonb_array_elements(coalesce(p_settings->'increments','[]'::jsonb)) loop
    if inc->>'upto' is null or p_current < (inc->>'upto')::numeric then
      step := (inc->>'step')::numeric; exit;
    end if;
  end loop;
  return round(p_current + step, 2);
end $$;

create or replace function public._squad_counts(p_part uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'WK', count(*) filter (where p.role='WK'),
    'BAT', count(*) filter (where p.role='BAT'),
    'AR', count(*) filter (where p.role='AR'),
    'BOWL', count(*) filter (where p.role='BOWL'),
    'overseas', count(*) filter (where p.nationality_type='Overseas'),
    'spin', count(*) filter (where public._is_spinner(p.sub_role)),
    'pace', count(*) filter (where public._is_pacer(p.role, p.sub_role))
  ) from public.squads s join public.players p on p.id = s.player_id where s.participant_id = p_part
$$;

create or replace function public._max_bid(p_settings jsonb, p_purse numeric, p_counts jsonb, p_role text)
returns numeric language plpgsql immutable as $$
declare need int := 0; role_need int := 0; r text; minb numeric := coalesce((p_settings->>'min_base')::numeric, 0.2);
begin
  foreach r in array array['WK','BAT','AR','BOWL'] loop
    role_need := role_need + greatest(0, coalesce((p_settings->>('min_'||lower(r)))::int,0) - (p_counts->>r)::int - (case when r = p_role then 1 else 0 end));
  end loop;
  need := greatest(coalesce((p_settings->>'min_squad')::int,0) - (p_counts->>'total')::int - 1, role_need, 0);
  return round(p_purse - need * minb, 2);
end $$;

create or replace function public.create_room(p_name text, p_format text, p_settings jsonb, p_nickname text, p_team text, p_color text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_room uuid; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_format not in ('IPL','T20','ODI') then raise exception 'Invalid format'; end if;
  if coalesce((p_settings->>'max_teams')::int,0) not between 2 and 10 then raise exception 'Teams must be between 2 and 10'; end if;
  if coalesce((p_settings->>'purse')::numeric,0) <= 0 then raise exception 'Purse must be positive'; end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(chars, 1 + floor(random()*length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms(code, name, host_id, format, settings) values (v_code, coalesce(nullif(trim(p_name),''),'Auction Room'), auth.uid(), p_format, p_settings) returning id into v_room;
  insert into public.participants(room_id, user_id, nickname, team_name, color, purse)
    values (v_room, auth.uid(), left(coalesce(nullif(trim(p_nickname),''),'Host'),24), left(coalesce(nullif(trim(p_team),''),'Team 1'),30), coalesce(p_color,'#f5b301'), (p_settings->>'purse')::numeric);
  perform public._log(v_room, 'info', 'Room created');
  return json_build_object('room_id', v_room, 'code', v_code);
end $$;

create or replace function public.join_room(p_code text, p_nickname text, p_team text, p_color text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.rooms; n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into r from public.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'No room with that code'; end if;
  if exists (select 1 from public.participants where room_id = r.id and user_id = auth.uid()) then
    update public.participants set last_seen = now() where room_id = r.id and user_id = auth.uid();
    return r.id;
  end if;
  if r.status <> 'lobby' then raise exception 'This auction has already started'; end if;
  select count(*) into n from public.participants where room_id = r.id;
  if n >= (r.settings->>'max_teams')::int then raise exception 'Room is full'; end if;
  insert into public.participants(room_id, user_id, nickname, team_name, color, purse)
    values (r.id, auth.uid(), left(coalesce(nullif(trim(p_nickname),''),'Player'),24), left(coalesce(nullif(trim(p_team),''),'Team '||(n+1)),30), coalesce(p_color,'#22d3ee'), (r.settings->>'purse')::numeric);
  perform public._log(r.id, 'info', coalesce(nullif(trim(p_team),''),'A team') || ' joined');
  return r.id;
end $$;

create or replace function public.update_my_team(p_room uuid, p_team text, p_color text, p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me public.participants := public._me(p_room);
begin
  update public.participants set
    team_name = left(coalesce(nullif(trim(p_team),''), team_name),30),
    color = coalesce(p_color, color),
    is_ready = coalesce(p_ready, is_ready),
    last_seen = now()
  where id = me.id;
end $$;

create or replace function public.heartbeat(p_room uuid) returns void
language sql security definer set search_path = public as $$
  update public.participants set last_seen = now() where room_id = p_room and user_id = auth.uid();
$$;

create or replace function public.update_room_settings(p_room uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can change settings'; end if;
  if r.status <> 'lobby' then raise exception 'Settings are locked after the auction starts'; end if;
  if (p_settings->>'max_teams')::int < (select count(*) from public.participants where room_id = p_room) then raise exception 'More teams have already joined'; end if;
  update public.rooms set settings = p_settings where id = p_room;
  update public.participants set purse = (p_settings->>'purse')::numeric where room_id = p_room;
end $$;

create or replace function public.set_pool(p_room uuid, p_player_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare r public.rooms; teams int; n int; s jsonb; bad int; rl text;
begin
  select * into r from public.rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can set the pool'; end if;
  if r.status <> 'lobby' then raise exception 'Pool is locked'; end if;
  s := r.settings;
  teams := (s->>'max_teams')::int;
  select count(distinct x) into n from unnest(p_player_ids) x;
  select count(*) into bad from unnest(p_player_ids) x left join public.players p on p.id = x where p.id is null or p.format <> r.format;
  if bad > 0 then raise exception 'Pool contains players from another format'; end if;
  if n < teams * (s->>'min_squad')::int then raise exception 'Pool needs at least % players (% teams x % min squad)', teams * (s->>'min_squad')::int, teams, s->>'min_squad'; end if;
  foreach rl in array array['WK','BAT','AR','BOWL'] loop
    if (select count(distinct p.id) from public.players p where p.id = any(p_player_ids) and p.role = rl) < teams * coalesce((s->>('min_'||lower(rl)))::int,0) then
      raise exception 'Pool needs at least % % players', teams * (s->>('min_'||lower(rl)))::int, rl;
    end if;
  end loop;
  if (select count(distinct p.id) from public.players p where p.id = any(p_player_ids) and public._is_spinner(p.sub_role)) < teams * coalesce((s->>'min_spinners')::int,0) then raise exception 'Pool needs more spinners'; end if;
  if (select count(distinct p.id) from public.players p where p.id = any(p_player_ids) and public._is_pacer(p.role,p.sub_role)) < teams * coalesce((s->>'min_pacers')::int,0) then raise exception 'Pool needs more pacers'; end if;
  delete from public.room_players where room_id = p_room;
  insert into public.room_players(room_id, player_id, set_name, lot_order)
  select p_room, p.id, z.st, row_number() over (order by z.so, p.rating desc, p.name)
  from (select distinct x from unnest(p_player_ids) x) ids join public.players p on p.id = ids.x
  cross join lateral (select case when p.tier='Marquee' then 'Marquee' when p.role='WK' then 'Wicketkeepers' when p.role='BAT' then 'Batsmen' when p.role='AR' then 'All-rounders' else 'Bowlers' end as st,
                              case when p.tier='Marquee' then 0 when p.role='WK' then 1 when p.role='BAT' then 2 when p.role='AR' then 3 else 4 end as so) z;
  perform public._log(p_room, 'info', 'Player pool set: '||n||' players');
  return n;
end $$;

create or replace function public.start_review(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'lobby' then raise exception 'Already started'; end if;
  if (select count(*) from public.participants where room_id = p_room) < 2 then raise exception 'At least 2 teams are needed'; end if;
  if not exists (select 1 from public.room_players where room_id = p_room) then raise exception 'Generate and confirm the player pool first'; end if;
  update public.rooms set status = 'review', review_ends_at = now() + make_interval(secs => coalesce((r.settings->>'review_seconds')::int,120)) where id = p_room;
  perform public._log(p_room, 'info', 'Review time started');
end $$;

create or replace function public._advance_lot(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; nxt uuid;
begin
  select * into r from public.rooms where id = p_room;
  select id into nxt from public.room_players where room_id = p_room and status = 'pending' order by round, lot_order limit 1;
  if nxt is null and not r.accel_done and exists (select 1 from public.room_players where room_id = p_room and status = 'unsold') then
    update public.room_players set status = 'pending', round = 2 where room_id = p_room and status = 'unsold';
    update public.rooms set accel_done = true where id = p_room;
    perform public._log(p_room, 'info', 'Accelerated round: unsold players return');
    select id into nxt from public.room_players where room_id = p_room and status = 'pending' order by round, lot_order limit 1;
  end if;
  if nxt is null then
    update public.rooms set status = 'completed', current_rp = null, current_bid = null, current_bidder = null, lot_ends_at = null where id = p_room;
    perform public._log(p_room, 'info', 'Auction complete');
    return;
  end if;
  update public.room_players set status = 'live' where id = nxt;
  update public.rooms set current_rp = nxt, current_bid = null, current_bidder = null,
    lot_ends_at = now() + make_interval(secs => coalesce((r.settings->>'bid_timer')::int, 20)) where id = p_room;
end $$;

create or replace function public._resolve_lot(p_room uuid, p_force_unsold boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; rp public.room_players; pl public.players; t public.participants;
begin
  select * into r from public.rooms where id = p_room;
  if r.current_rp is null then return; end if;
  select * into rp from public.room_players where id = r.current_rp;
  select * into pl from public.players where id = rp.player_id;
  if r.current_bidder is not null and not p_force_unsold then
    select * into t from public.participants where id = r.current_bidder;
    update public.participants set purse = purse - r.current_bid where id = t.id;
    update public.room_players set status = 'sold', sold_to = t.id, sold_price = r.current_bid where id = rp.id;
    insert into public.squads(room_id, participant_id, player_id, room_player_id, price) values (p_room, t.id, pl.id, rp.id, r.current_bid);
    insert into public.sales(room_id, room_player_id, participant_id, price) values (p_room, rp.id, t.id, r.current_bid);
    perform public._log(p_room, 'sold', pl.name || ' SOLD to ' || t.team_name || ' for ' || r.current_bid);
  else
    update public.room_players set status = 'unsold' where id = rp.id;
    insert into public.sales(room_id, room_player_id, participant_id, price) values (p_room, rp.id, null, null);
    perform public._log(p_room, 'unsold', pl.name || ' UNSOLD');
  end if;
end $$;

create or replace function public.tick(p_room uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  perform public._me(p_room);
  select * into r from public.rooms where id = p_room for update;
  if r.status = 'review' and now() >= r.review_ends_at then
    update public.rooms set status = 'auction' where id = p_room;
    perform public._log(p_room, 'info', 'Auction started');
    perform public._advance_lot(p_room);
    return 'started';
  end if;
  if r.status = 'auction' and r.lot_ends_at is not null and now() >= r.lot_ends_at then
    if now() > r.lot_ends_at + interval '15 seconds' then
      update public.rooms set lot_ends_at = now() + make_interval(secs => coalesce((r.settings->>'bid_timer')::int,20)) where id = p_room;
      perform public._log(p_room, 'info', 'Room was empty; lot timer restarted');
      return 'resumed';
    end if;
    perform public._resolve_lot(p_room, false);
    perform public._advance_lot(p_room);
    return 'resolved';
  end if;
  if r.status = 'trade' and now() >= r.trade_ends_at then
    update public.trades set status = 'expired', resolved_at = now() where room_id = p_room and status = 'pending';
    update public.rooms set status = 'results' where id = p_room;
    perform public._log(p_room, 'info', 'Trade window closed');
    return 'results';
  end if;
  return 'noop';
end $$;

create or replace function public.place_bid(p_room uuid, p_amount numeric) returns numeric
language plpgsql security definer set search_path = public as $$
declare r public.rooms; me public.participants; rp public.room_players; pl public.players; s jsonb; nxt numeric; c jsonb; reset_s int;
begin
  me := public._me(p_room);
  select * into r from public.rooms where id = p_room for update;
  select * into me from public.participants where id = me.id;
  if r.status <> 'auction' then raise exception 'Auction is not live'; end if;
  if r.current_rp is null or r.lot_ends_at is null or now() >= r.lot_ends_at then raise exception 'Bidding closed for this player'; end if;
  if r.current_bidder = me.id then raise exception 'You are already the highest bidder'; end if;
  select * into rp from public.room_players where id = r.current_rp;
  select * into pl from public.players where id = rp.player_id;
  s := r.settings;
  nxt := public.next_bid_amount(s, r.current_bid, pl.base_price);
  if p_amount is distinct from nxt then raise exception 'Someone bid first. Next valid bid is %', nxt; end if;
  c := public._squad_counts(me.id);
  if (c->>'total')::int + 1 > (s->>'max_squad')::int then raise exception 'Your squad is full'; end if;
  if pl.nationality_type = 'Overseas' and (c->>'overseas')::int + 1 > (s->>'max_overseas')::int then raise exception 'Overseas limit reached'; end if;
  if nxt > public._max_bid(s, me.purse, c, pl.role) then raise exception 'Not enough purse left to complete your squad'; end if;
  reset_s := coalesce((s->>'bid_reset')::int, 10);
  insert into public.bids(room_id, room_player_id, participant_id, amount) values (p_room, rp.id, me.id, nxt);
  update public.rooms set current_bid = nxt, current_bidder = me.id,
    lot_ends_at = greatest(lot_ends_at, now() + make_interval(secs => reset_s)) where id = p_room;
  update public.participants set last_seen = now() where id = me.id;
  return nxt;
end $$;

create or replace function public.host_control(p_room uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; sl public.sales; minord int; minround int; pname text;
begin
  select * into r from public.rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can do that'; end if;
  if p_action = 'pause' then
    if r.status <> 'auction' then raise exception 'Not live'; end if;
    update public.rooms set status = 'paused', paused_remaining_ms = greatest(1000, (extract(epoch from (r.lot_ends_at - now()))*1000)::int) where id = p_room;
    perform public._log(p_room, 'info', 'Auction paused');
  elsif p_action = 'resume' then
    if r.status <> 'paused' then raise exception 'Not paused'; end if;
    update public.rooms set status = 'auction', lot_ends_at = now() + make_interval(secs => coalesce(r.paused_remaining_ms,10000)/1000.0) where id = p_room;
    perform public._log(p_room, 'info', 'Auction resumed');
  elsif p_action = 'skip' then
    if r.status not in ('auction','paused') then raise exception 'Not live'; end if;
    perform public._resolve_lot(p_room, true);
    update public.rooms set status = 'auction' where id = p_room;
    perform public._advance_lot(p_room);
  elsif p_action = 'undo' then
    if r.status not in ('auction','paused','completed') then raise exception 'Cannot undo now'; end if;
    select * into sl from public.sales where room_id = p_room and participant_id is not null and not undone order by created_at desc limit 1;
    if not found then raise exception 'Nothing to undo'; end if;
    if not exists (select 1 from public.squads where room_player_id = sl.room_player_id and participant_id = sl.participant_id) then raise exception 'That player has moved'; end if;
    delete from public.squads where room_player_id = sl.room_player_id;
    update public.participants set purse = purse + sl.price where id = sl.participant_id;
    update public.sales set undone = true where id = sl.id;
    select coalesce(min(lot_order),1), coalesce(min(round),1) into minord, minround from public.room_players where room_id = p_room and status in ('pending','live');
    update public.room_players set status = 'pending', sold_to = null, sold_price = null, lot_order = minord - 1, round = minround where id = sl.room_player_id;
    select p.name into pname from public.room_players rp join public.players p on p.id = rp.player_id where rp.id = sl.room_player_id;
    perform public._log(p_room, 'info', 'Undo: '||pname||' returns to the auction');
    if r.status = 'completed' then
      update public.rooms set status = 'auction' where id = p_room;
      perform public._advance_lot(p_room);
    end if;
  elsif p_action = 'end' then
    if r.status not in ('auction','paused') then raise exception 'Not live'; end if;
    update public.room_players set status = 'unsold' where room_id = p_room and status in ('pending','live');
    update public.rooms set status = 'completed', current_rp = null, current_bid = null, current_bidder = null, lot_ends_at = null where id = p_room;
    perform public._log(p_room, 'info', 'Host ended the auction');
  elsif p_action = 'skip_review' then
    if r.status <> 'review' then raise exception 'Not in review'; end if;
    update public.rooms set review_ends_at = now() where id = p_room;
  elsif p_action = 'results' then
    if r.status not in ('completed','trade') then raise exception 'Finish the auction first'; end if;
    update public.trades set status = 'expired', resolved_at = now() where room_id = p_room and status = 'pending';
    update public.rooms set status = 'results' where id = p_room;
    perform public._log(p_room, 'info', 'Results are in');
  else
    raise exception 'Unknown action';
  end if;
end $$;

create or replace function public.open_trades(p_room uuid, p_minutes int) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can open trades'; end if;
  if r.status <> 'completed' then raise exception 'Auction must be complete'; end if;
  update public.rooms set status = 'trade', trade_ends_at = now() + make_interval(mins => greatest(1, least(coalesce(p_minutes,10), 120))) where id = p_room;
  perform public._log(p_room, 'info', 'Trade window open for '||p_minutes||' min');
end $$;

create or replace function public.transfer_host(p_room uuid, p_participant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms; me public.participants := public._me(p_room); target public.participants; host_seen timestamptz;
begin
  select * into r from public.rooms where id = p_room for update;
  select * into target from public.participants where id = p_participant and room_id = p_room;
  if not found then raise exception 'Unknown team'; end if;
  if r.host_id <> auth.uid() then
    select last_seen into host_seen from public.participants where room_id = p_room and user_id = r.host_id;
    if host_seen > now() - interval '30 seconds' then raise exception 'The host is still connected'; end if;
    if target.id <> me.id then raise exception 'You can only claim host for yourself'; end if;
  end if;
  update public.rooms set host_id = target.user_id where id = p_room;
  perform public._log(p_room, 'info', target.team_name || ' is now the host');
end $$;

create or replace function public.propose_trade(p_room uuid, p_to uuid, p_offer uuid[], p_request uuid[], p_cash numeric, p_parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.rooms; me public.participants := public._me(p_room); v uuid;
begin
  select * into r from public.rooms where id = p_room;
  if r.status <> 'trade' or now() >= r.trade_ends_at then raise exception 'Trade window is closed'; end if;
  if p_to = me.id or not exists (select 1 from public.participants where id = p_to and room_id = p_room) then raise exception 'Pick another team'; end if;
  if coalesce(array_length(p_offer,1),0) = 0 and coalesce(array_length(p_request,1),0) = 0 then raise exception 'Add at least one player'; end if;
  if (select count(*) from public.squads where participant_id = me.id and player_id = any(p_offer)) <> coalesce(array_length(p_offer,1),0) then raise exception 'You do not own all offered players'; end if;
  if (select count(*) from public.squads where participant_id = p_to and player_id = any(p_request)) <> coalesce(array_length(p_request,1),0) then raise exception 'They do not own all requested players'; end if;
  insert into public.trades(room_id, from_participant, to_participant, offer_players, request_players, cash, parent_trade_id)
    values (p_room, me.id, p_to, coalesce(p_offer,'{}'), coalesce(p_request,'{}'), coalesce(p_cash,0), p_parent) returning id into v;
  perform public._log(p_room, 'trade', me.team_name || ' proposed a trade');
  return v;
end $$;

create or replace function public._check_after_trade(p_settings jsonb, p_before jsonb, p_part uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a jsonb := public._squad_counts(p_part); rl text; pname text; pv numeric;
begin
  select team_name, purse into pname, pv from public.participants where id = p_part;
  if pv < 0 then raise exception '% cannot afford this trade', pname; end if;
  if (a->>'total')::int > (p_settings->>'max_squad')::int then raise exception '% would exceed max squad size', pname; end if;
  if (a->>'overseas')::int > (p_settings->>'max_overseas')::int and (a->>'overseas')::int > (p_before->>'overseas')::int then raise exception '% would exceed overseas limit', pname; end if;
  if (a->>'total')::int < (p_settings->>'min_squad')::int and (a->>'total')::int < (p_before->>'total')::int then raise exception '% would drop below min squad size', pname; end if;
  foreach rl in array array['WK','BAT','AR','BOWL'] loop
    if (a->>rl)::int < coalesce((p_settings->>('min_'||lower(rl)))::int,0) and (a->>rl)::int < (p_before->>rl)::int then
      raise exception '% would drop below minimum % players', pname, rl;
    end if;
  end loop;
end $$;

create or replace function public.respond_trade(p_trade uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.trades; r public.rooms; me public.participants; b_from jsonb; b_to jsonb;
begin
  select * into t from public.trades where id = p_trade;
  if not found then raise exception 'Trade not found'; end if;
  select * into r from public.rooms where id = t.room_id for update;
  me := public._me(t.room_id);
  select * into t from public.trades where id = p_trade for update;
  if t.status <> 'pending' then raise exception 'Trade is no longer pending'; end if;
  if p_action = 'cancel' then
    if me.id <> t.from_participant then raise exception 'Only the proposer can cancel'; end if;
    update public.trades set status = 'cancelled', resolved_at = now() where id = p_trade; return;
  end if;
  if me.id <> t.to_participant then raise exception 'Only the receiving team can respond'; end if;
  if p_action in ('reject','counter') then
    update public.trades set status = case when p_action='reject' then 'rejected' else 'countered' end, resolved_at = now() where id = p_trade;
    perform public._log(t.room_id, 'trade', 'Trade '||p_action||'ed');
    return;
  end if;
  if p_action <> 'accept' then raise exception 'Unknown action'; end if;
  if r.status <> 'trade' or now() >= r.trade_ends_at then raise exception 'Trade window is closed'; end if;
  perform 1 from public.participants where id in (t.from_participant, t.to_participant) for update;
  if (select count(*) from public.squads where participant_id = t.from_participant and player_id = any(t.offer_players)) <> coalesce(array_length(t.offer_players,1),0)
     or (select count(*) from public.squads where participant_id = t.to_participant and player_id = any(t.request_players)) <> coalesce(array_length(t.request_players,1),0) then
    raise exception 'Players in this trade have already moved';
  end if;
  b_from := public._squad_counts(t.from_participant);
  b_to := public._squad_counts(t.to_participant);
  update public.squads set participant_id = t.to_participant, acquired_via = 'trade' where room_id = t.room_id and participant_id = t.from_participant and player_id = any(t.offer_players);
  update public.squads set participant_id = t.from_participant, acquired_via = 'trade' where room_id = t.room_id and participant_id = t.to_participant and player_id = any(t.request_players);
  update public.participants set purse = purse - t.cash where id = t.from_participant;
  update public.participants set purse = purse + t.cash where id = t.to_participant;
  perform public._check_after_trade(r.settings, b_from, t.from_participant);
  perform public._check_after_trade(r.settings, b_to, t.to_participant);
  update public.trades set status = 'accepted', resolved_at = now() where id = p_trade;
  update public.trades set status = 'cancelled', resolved_at = now()
    where room_id = t.room_id and status = 'pending' and id <> p_trade
      and (offer_players && (t.offer_players || t.request_players) or request_players && (t.offer_players || t.request_players));
  perform public._log(t.room_id, 'trade', 'Trade accepted');
end $$;

revoke execute on function public._me(uuid), public._log(uuid,text,text), public._advance_lot(uuid), public._resolve_lot(uuid,boolean), public._check_after_trade(jsonb,jsonb,uuid), public._squad_counts(uuid) from public, anon, authenticated;
