-- Game layer batch 3 (Job, 13 Nov): gym board (king or queen of the week, Regulars, machine owners), gym vs gym, crews.
-- Scores ride on the stat each phone already saves (jobdone_cards.stat -> 'g'); these functions only read and add them up.
-- Names show on a gym board only for people who turned on "Show me on my gym's board" (g.gb); everyone else counts anonymously.

create or replace function public.jobdone_jnum(j jsonb, k text, mx numeric default 1000000) returns int
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j -> k) = 'number' then greatest(0, least((j ->> k)::numeric, mx))::int else 0 end
$$;

-- Your gym's board. Only members of the gym can read it.
create or replace function public.jobdone_gym_board(g uuid)
returns table (n text, tier text, wx int, mx int, lc int, mine boolean, mc jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  if not public.jobdone_gym_member(g) then raise exception 'Join this gym first' using errcode = '42501'; end if;
  return query
  select case when (c.stat -> 'g' ->> 'gb') = 'true' or c.user_id = me then left(split_part(coalesce(nullif(c.card ->> 'n', ''), 'Member'), ' ', 1), 20) end,
    left(coalesce(c.stat -> 'g' ->> 't', 'bronze'), 10),
    case when (c.stat ->> 'w') ~ '^\d{4}-\d{2}-\d{2}$' and (c.stat ->> 'w')::date >= current_date - 6 then public.jobdone_jnum(c.stat -> 'g', 'wx', 100000) else 0 end,
    case when (c.stat -> 'g' ->> 'mk') = to_char(now(), 'YYYY-MM') then public.jobdone_jnum(c.stat -> 'g', 'mx', 400000) else 0 end,
    public.jobdone_jnum(c.stat -> 'g', 'lc', 520),
    c.user_id = me,
    case when ((c.stat -> 'g' ->> 'gb') = 'true' or c.user_id = me) and jsonb_typeof(c.stat -> 'g' -> 'mc') = 'object' and pg_column_size(c.stat -> 'g' -> 'mc') < 600 then c.stat -> 'g' -> 'mc' end
  from public.jobdone_gym_members m join public.jobdone_cards c on c.user_id = m.user_id
  where m.gym_id = g and (c.stat -> 'g' ->> 'gym') = g::text and coalesce(c.card ->> 'hidden', '') <> 'true'
  order by 3 desc, 4 desc limit 100;
end $$;

-- Gym vs gym: the 20 gyms whose members earned the most XP this month.
create or replace function public.jobdone_gym_ranks()
returns table (gym_id uuid, name text, xp int, people int, mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  return query
  select gy.id, left(b.name || case when b.independent then '' else ' · ' || gy.branch end, 70), sum(public.jobdone_jnum(c.stat -> 'g', 'mx', 400000))::int, count(*)::int,
    bool_or(m.user_id = me)
  from public.jobdone_gym_members m
    join public.jobdone_cards c on c.user_id = m.user_id and (c.stat -> 'g' ->> 'gym') = m.gym_id::text and (c.stat -> 'g' ->> 'mk') = to_char(now(), 'YYYY-MM')
    join public.jobdone_gyms gy on gy.id = m.gym_id and not gy.hidden
    join public.jobdone_gym_brands b on b.id = gy.brand_id
  group by gy.id, b.name, b.independent, gy.branch
  order by 3 desc limit 20;
end $$;

-- ---------- crews: 3 to 6 friends with a name and an emblem ----------
create table if not exists public.jobdone_crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 30),
  emblem text not null check (emblem in ('bolt', 'peak', 'crown', 'star', 'flame', 'shield')),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.jobdone_crew_members (
  crew_id uuid not null references public.jobdone_crews on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  accepted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists jobdone_crew_members_user on public.jobdone_crew_members (user_id);
alter table public.jobdone_crews enable row level security;
alter table public.jobdone_crew_members enable row level security;
-- no policies: only the functions below touch these tables

-- Start a crew with friends of yours. They get an invite and join when they accept.
create or replace function public.jobdone_crew_create(p_name text, p_emblem text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); cid uuid; x uuid; n int := coalesce(array_length(p_members, 1), 0);
begin
  if n < 2 or n > 5 then raise exception 'A crew is 3 to 6 people, you included' using errcode = '22023'; end if;
  if (select count(*) from public.jobdone_crew_members where user_id = me) >= 3 then raise exception 'You can be in up to 3 crews' using errcode = '54000'; end if;
  if (select count(*) from public.jobdone_crews where created_by = me and created_at > now() - interval '1 day') >= 3 then raise exception 'Too many crews today' using errcode = '54000'; end if;
  foreach x in array p_members loop
    if x = me or not exists (select 1 from public.jobdone_friends where user_id = me and friend_id = x) then raise exception 'Crews are made from your friends' using errcode = '42501'; end if;
  end loop;
  insert into public.jobdone_crews (name, emblem, created_by) values (trim(p_name), p_emblem, me) returning id into cid;
  insert into public.jobdone_crew_members (crew_id, user_id, accepted) values (cid, me, true);
  insert into public.jobdone_crew_members (crew_id, user_id) select cid, u from (select distinct unnest(p_members) u) s;
  return cid;
end $$;

-- Your crews and invites. Members' scores show only to people who accepted.
create or replace function public.jobdone_crew_mine()
returns table (crew_id uuid, name text, emblem text, accepted boolean, members jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  return query
  select cr.id, cr.name, cr.emblem, mm.accepted,
    (select coalesce(jsonb_agg(jsonb_build_object('id', o.user_id, 'n', left(split_part(coalesce(nullif(c.card ->> 'n', ''), 'Member'), ' ', 1), 20), 'in', o.accepted,
       'g', case when mm.accepted and o.accepted then c.stat -> 'g' end, 'w', case when mm.accepted and o.accepted then c.stat ->> 'w' end, 'k', case when mm.accepted and o.accepted then c.stat -> 'k' end) order by o.joined_at), '[]'::jsonb)
     from public.jobdone_crew_members o left join public.jobdone_cards c on c.user_id = o.user_id where o.crew_id = cr.id)
  from public.jobdone_crew_members mm join public.jobdone_crews cr on cr.id = mm.crew_id
  where mm.user_id = me order by mm.accepted, cr.created_at;
end $$;

create or replace function public.jobdone_crew_answer(p_crew uuid, p_yes boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  if p_yes then
    if (select count(*) from public.jobdone_crew_members where user_id = me and accepted) >= 3 then raise exception 'You can be in up to 3 crews' using errcode = '54000'; end if;
    update public.jobdone_crew_members set accepted = true, joined_at = now() where crew_id = p_crew and user_id = me;
  else
    delete from public.jobdone_crew_members where crew_id = p_crew and user_id = me;
    delete from public.jobdone_crews c where c.id = p_crew and (select count(*) from public.jobdone_crew_members m where m.crew_id = p_crew and m.accepted) < 1;
  end if;
end $$;

create or replace function public.jobdone_crew_leave(p_crew uuid) returns void language sql security definer set search_path = '' as $$
  select public.jobdone_crew_answer(p_crew, false);
$$;

revoke execute on function public.jobdone_jnum(jsonb, text, numeric), public.jobdone_gym_board(uuid), public.jobdone_gym_ranks(),
  public.jobdone_crew_create(text, text, uuid[]), public.jobdone_crew_mine(), public.jobdone_crew_answer(uuid, boolean), public.jobdone_crew_leave(uuid) from public, anon;
grant execute on function public.jobdone_gym_board(uuid), public.jobdone_gym_ranks(),
  public.jobdone_crew_create(text, text, uuid[]), public.jobdone_crew_mine(), public.jobdone_crew_answer(uuid, boolean), public.jobdone_crew_leave(uuid) to authenticated;
