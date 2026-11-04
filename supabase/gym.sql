-- My Gym (beta), Job, 4 Nov 2026. Shared gym equipment lists, one per branch.
-- Tables are read and written only through the security-definer functions below, which check sign-in,
-- two-step sign-in, membership and daily limits. Nobody can read another person's id or votes.

create table if not exists public.jobdone_gym_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  independent boolean not null default false,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists jobdone_gym_brands_chain on public.jobdone_gym_brands (lower(name)) where not independent;

create table if not exists public.jobdone_gyms (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.jobdone_gym_brands on delete cascade,
  branch text not null check (char_length(branch) between 2 and 60),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  hidden boolean not null default false
);
create unique index if not exists jobdone_gyms_branch on public.jobdone_gyms (brand_id, lower(branch));

create table if not exists public.jobdone_gym_members (
  user_id uuid not null references auth.users on delete cascade,
  gym_id uuid not null references public.jobdone_gyms on delete cascade,
  is_home boolean not null default false,
  last_used timestamptz not null default now(),
  primary key (user_id, gym_id)
);

-- The one fixed machine list. Names are uniform: people and the AI can only pick a key from here.
create table if not exists public.jobdone_equipment_types (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  nicknames text[] not null default '{}',
  lifts text[] not null default '{}',     -- Job's Done exercise names this machine makes possible
  sort smallint not null default 100
);

create table if not exists public.jobdone_gym_equipment (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.jobdone_gyms on delete cascade,
  type_key text not null references public.jobdone_equipment_types on delete cascade,
  added_by uuid references auth.users on delete set null,
  added_at timestamptz not null default now(),
  via text not null default 'list' check (via in ('scan', 'list', 'starter')),
  unique (gym_id, type_key)
);

create table if not exists public.jobdone_equipment_votes (
  equipment_id uuid not null references public.jobdone_gym_equipment on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  vote smallint not null check (vote in (1, -1)),
  at timestamptz not null default now(),
  primary key (equipment_id, user_id)
);

create table if not exists public.jobdone_scan_log (     -- daily scan limit only; no images are ever stored
  user_id uuid not null references auth.users on delete cascade,
  at timestamptz not null default now(),
  found smallint not null default 0
);
create index if not exists jobdone_scan_log_user on public.jobdone_scan_log (user_id, at);

alter table public.jobdone_gym_brands enable row level security;
alter table public.jobdone_gyms enable row level security;
alter table public.jobdone_gym_members enable row level security;
alter table public.jobdone_equipment_types enable row level security;
alter table public.jobdone_gym_equipment enable row level security;
alter table public.jobdone_equipment_votes enable row level security;
alter table public.jobdone_scan_log enable row level security;
-- Only the machine list can be read directly (it's the same for everyone). Everything else goes through the functions.
drop policy if exists "Signed in read" on public.jobdone_equipment_types;
create policy "Signed in read" on public.jobdone_equipment_types for select to authenticated using (true);

-- ---------- helpers ----------
create or replace function public.jobdone_gym_me() returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.jobdone_aal_ok() then raise exception 'Sign in first' using errcode = '28000'; end if;
  return auth.uid();
end $$;

create or replace function public.jobdone_gym_member(g uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobdone_gym_members m where m.gym_id = g and m.user_id = auth.uid())
$$;

-- ---------- reads ----------
-- Brands and branches matching what you typed, with machine and people counts.
create or replace function public.jobdone_gym_search(q text)
returns table (brand_id uuid, brand text, independent boolean, gym_id uuid, branch text, machines int, people int, mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); t text := '%' || replace(replace(left(coalesce(q, ''), 60), '%', ''), '_', '') || '%';
begin
  return query
  select b.id, b.name, b.independent, g.id, g.branch,
    (select count(*)::int from public.jobdone_gym_equipment e where e.gym_id = g.id
      and (select count(*) from public.jobdone_equipment_votes v where v.equipment_id = e.id and v.vote = 1) >= 2),
    (select count(*)::int from public.jobdone_gym_members m where m.gym_id = g.id),
    exists (select 1 from public.jobdone_gym_members m where m.gym_id = g.id and m.user_id = me)
  from public.jobdone_gym_brands b left join public.jobdone_gyms g on g.brand_id = b.id and not g.hidden
  where char_length(trim(coalesce(q, ''))) >= 2 and (b.name ilike t or g.branch ilike t)
  order by b.independent, b.name, g.branch
  limit 60;
end $$;

-- Your branches.
create or replace function public.jobdone_gym_mine()
returns table (gym_id uuid, brand_id uuid, brand text, independent boolean, branch text, is_home boolean, last_used timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  return query select g.id, b.id, b.name, b.independent, g.branch, m.is_home, m.last_used
  from public.jobdone_gym_members m join public.jobdone_gyms g on g.id = m.gym_id join public.jobdone_gym_brands b on b.id = g.brand_id
  where m.user_id = me order by m.is_home desc, m.last_used desc;
end $$;

-- A branch's machines with vote counts. Only members can see them.
create or replace function public.jobdone_gym_equipment_list(g uuid)
returns table (id uuid, type_key text, here int, nots int, my_vote smallint, by_me boolean, via text)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  if not public.jobdone_gym_member(g) then raise exception 'Join this gym first' using errcode = '42501'; end if;
  return query select e.id, e.type_key,
    (select count(*)::int from public.jobdone_equipment_votes v where v.equipment_id = e.id and v.vote = 1),
    (select count(*)::int from public.jobdone_equipment_votes v where v.equipment_id = e.id and v.vote = -1),
    (select v.vote from public.jobdone_equipment_votes v where v.equipment_id = e.id and v.user_id = me),
    e.added_by = me, e.via
  from public.jobdone_gym_equipment e where e.gym_id = g;
end $$;

-- Machines that at least half of the brand's other branches have confirmed (the starter list for a new branch).
create or replace function public.jobdone_gym_starter(g uuid) returns setof text
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); br uuid; n int;
begin
  if not public.jobdone_gym_member(g) then raise exception 'Join this gym first' using errcode = '42501'; end if;
  select brand_id into br from public.jobdone_gyms where id = g;
  select count(distinct o.id) into n from public.jobdone_gyms o join public.jobdone_gym_equipment e on e.gym_id = o.id where o.brand_id = br and o.id <> g;
  if n = 0 then return; end if;
  return query select e.type_key from public.jobdone_gyms o join public.jobdone_gym_equipment e on e.gym_id = o.id
    where o.brand_id = br and o.id <> g and not o.hidden
      and (select count(*) from public.jobdone_equipment_votes v where v.equipment_id = e.id and v.vote = 1) >= 2
    group by e.type_key having count(distinct o.id) * 2 >= n;
end $$;

-- ---------- writes ----------
create or replace function public.jobdone_gym_join(g uuid) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  if not exists (select 1 from public.jobdone_gyms where id = g and not hidden) then raise exception 'That gym is gone'; end if;
  if (select count(*) from public.jobdone_gym_members where user_id = me) >= 5 and not public.jobdone_gym_member(g) then raise exception 'You can be in up to 5 gyms' using errcode = '54000'; end if;
  insert into public.jobdone_gym_members (user_id, gym_id, is_home)
    values (me, g, not exists (select 1 from public.jobdone_gym_members where user_id = me))
    on conflict (user_id, gym_id) do update set last_used = now();
end $$;

create or replace function public.jobdone_gym_leave(g uuid) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); was boolean;
begin
  delete from public.jobdone_gym_members where user_id = me and gym_id = g returning is_home into was;
  if was then update public.jobdone_gym_members set is_home = true where user_id = me
    and gym_id = (select gym_id from public.jobdone_gym_members where user_id = me order by last_used desc limit 1); end if;
end $$;

-- "Training at": marks a branch as used now; home = true also makes it your home branch.
create or replace function public.jobdone_gym_use(g uuid, home boolean default false) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me();
begin
  if home then update public.jobdone_gym_members set is_home = (gym_id = g) where user_id = me; end if;
  update public.jobdone_gym_members set last_used = now() where user_id = me and gym_id = g;
end $$;

-- A new branch of a chain, or a new independent gym (brand_id null + name). Joins it too. 3 a day.
create or replace function public.jobdone_gym_add_branch(p_brand uuid, p_branch text, p_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); br uuid := p_brand; b text := trim(regexp_replace(coalesce(p_branch, ''), '\s+', ' ', 'g')); nm text; gid uuid;
begin
  if char_length(b) not between 2 and 60 then raise exception 'Give the branch a name (2 to 60 letters)' using errcode = '22023'; end if;
  if (select count(*) from public.jobdone_gyms where created_by = me and created_at > now() - interval '1 day') >= 3 then raise exception 'You can add 3 gyms a day' using errcode = '54000'; end if;
  if br is null then
    nm := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
    if char_length(nm) not between 2 and 60 then raise exception 'Give the gym a name (2 to 60 letters)' using errcode = '22023'; end if;
    insert into public.jobdone_gym_brands (name, independent, created_by) values (nm, true, me) returning jobdone_gym_brands.id into br;
  elsif not exists (select 1 from public.jobdone_gym_brands where jobdone_gym_brands.id = br) then raise exception 'Unknown gym chain';
  end if;
  select g.id into gid from public.jobdone_gyms g where g.brand_id = br and lower(g.branch) = lower(b);
  if gid is null then insert into public.jobdone_gyms (brand_id, branch, created_by) values (br, b, me) returning jobdone_gyms.id into gid; end if;
  perform public.jobdone_gym_join(gid);
  return gid;
end $$;

-- Add machines (from a scan, the list or the starter list). Adding one counts as your "it's here". Up to 120 adds and votes a day.
create or replace function public.jobdone_gym_add(g uuid, keys text[], via text default 'list') returns int
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); k text; eid uuid; n int := 0;
begin
  if not public.jobdone_gym_member(g) then raise exception 'Join this gym first' using errcode = '42501'; end if;
  if via not in ('scan', 'list', 'starter') then via := 'list'; end if;
  if coalesce(array_length(keys, 1), 0) > 40 then raise exception 'Too many at once' using errcode = '22023'; end if;
  if (select count(*) from public.jobdone_equipment_votes v where v.user_id = me and v.at > now() - interval '1 day') + coalesce(array_length(keys, 1), 0) > 120
    then raise exception 'That''s a lot for one day. Try again tomorrow' using errcode = '54000'; end if;
  foreach k in array coalesce(keys, '{}') loop
    continue when not exists (select 1 from public.jobdone_equipment_types t where t.key = k);
    insert into public.jobdone_gym_equipment (gym_id, type_key, added_by, via) values (g, k, me, via)
      on conflict (gym_id, type_key) do nothing;
    select e.id into eid from public.jobdone_gym_equipment e where e.gym_id = g and e.type_key = k;
    insert into public.jobdone_equipment_votes (equipment_id, user_id, vote) values (eid, me, 1)
      on conflict (equipment_id, user_id) do update set vote = 1, at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- "It's here" (1), "Not at this gym" (-1) or take your vote back (0).
create or replace function public.jobdone_gym_vote(e uuid, v int) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); g uuid;
begin
  select gym_id into g from public.jobdone_gym_equipment where id = e;
  if g is null or not public.jobdone_gym_member(g) then raise exception 'Join this gym first' using errcode = '42501'; end if;
  if v = 0 then delete from public.jobdone_equipment_votes where equipment_id = e and user_id = me; return; end if;
  if v not in (1, -1) then raise exception 'Bad vote' using errcode = '22023'; end if;
  if (select count(*) from public.jobdone_equipment_votes x where x.user_id = me and x.at > now() - interval '1 day') >= 120 then raise exception 'That''s a lot for one day. Try again tomorrow' using errcode = '54000'; end if;
  insert into public.jobdone_equipment_votes (equipment_id, user_id, vote) values (e, me, v)
    on conflict (equipment_id, user_id) do update set vote = excluded.vote, at = now();
end $$;

revoke all on function public.jobdone_gym_me(), public.jobdone_gym_member(uuid), public.jobdone_gym_search(text), public.jobdone_gym_mine(),
  public.jobdone_gym_equipment_list(uuid), public.jobdone_gym_starter(uuid), public.jobdone_gym_join(uuid), public.jobdone_gym_leave(uuid),
  public.jobdone_gym_use(uuid, boolean), public.jobdone_gym_add_branch(uuid, text, text), public.jobdone_gym_add(uuid, text[], text),
  public.jobdone_gym_vote(uuid, int) from public, anon;
grant execute on function public.jobdone_gym_search(text), public.jobdone_gym_mine(), public.jobdone_gym_equipment_list(uuid),
  public.jobdone_gym_starter(uuid), public.jobdone_gym_join(uuid), public.jobdone_gym_leave(uuid), public.jobdone_gym_use(uuid, boolean),
  public.jobdone_gym_add_branch(uuid, text, text), public.jobdone_gym_add(uuid, text[], text), public.jobdone_gym_vote(uuid, int) to authenticated;

-- Gyms nobody has joined for 30 days drop out of search.
select cron.schedule('jobdone-gym-tidy', '20 3 * * *', $c$
  update public.jobdone_gyms g set hidden = true where not hidden and created_at < now() - interval '30 days'
    and not exists (select 1 from public.jobdone_gym_members m where m.gym_id = g.id);
  delete from public.jobdone_scan_log where at < now() - interval '3 days';
$c$);

-- ---------- seed: chains ----------
insert into public.jobdone_gym_brands (name) values
  ('Anytime Fitness'), ('Fitness First'), ('ActiveSG Gym'), ('Gymm Boxx'), ('Jetts Fitness'), ('Virgin Active'), ('Pure Fitness'),
  ('Evolve'), ('Snap Fitness'), ('Planet Fitness'), ('24 Hour Fitness'), ('Gold''s Gym'), ('PureGym'), ('The Gym Group'),
  ('Crunch Fitness'), ('LA Fitness'), ('Equinox'), ('World Gym'), ('Celebrity Fitness'), ('Fitness Time'), ('Basic-Fit'),
  ('JD Gyms'), ('Club Pilates'), ('UFIT'), ('Ritual Gym'), ('Fitness Park'), ('McFit'), ('EoS Fitness'), ('Chuze Fitness'), ('Genesis Health Clubs')
on conflict do nothing;

-- ---------- seed: the fixed machine list ----------
insert into public.jobdone_equipment_types (key, name, nicknames, lifts, sort) values
  ('dumbbells', 'Dumbbells', '{db,dumbells,free weights,dumbbell rack}', '{Dumbbell Bench Press,Incline Dumbbell Press,Dumbbell Fly,Dumbbell Shoulder Press,Arnold Press,Dumbbell Lateral Raise,Front Raise,Dumbbell Curl,Hammer Curl,Incline Dumbbell Curl,Concentration Curl,Spider Curl,Dumbbell Row,Shrug,Dumbbell RDL,Dumbbell Kickback,Goblet Squat,Bulgarian Split Squat,Walking Lunge,Step-Up,Wrist Curl,Farmer''s Carry}', 10),
  ('barbell', 'Barbell and plates', '{bar,olympic bar,free bar}', '{Barbell Row,Pendlay Row,Deadlift,Romanian Deadlift,Stiff-Leg Deadlift,Barbell Curl,Good Morning,Hip Thrust,Glute Bridge,Reverse Curl}', 11),
  ('ez_bar', 'EZ Bar', '{ez curl bar,curl bar,cambered bar}', '{EZ-Bar Curl,Skull Crusher}', 12),
  ('bench_press', 'Flat Bench Press', '{bench,flat bench,bench station}', '{Bench Press,Close-Grip Bench Press}', 20),
  ('incline_bench', 'Incline Bench Press', '{incline bench station}', '{Incline Bench Press}', 21),
  ('decline_bench', 'Decline Bench Press', '{decline bench}', '{Decline Bench Press}', 22),
  ('smith_machine', 'Smith Machine', '{smith,smith rack}', '{Smith Bench Press,Smith Squat,Incline Press}', 23),
  ('squat_rack', 'Squat Rack', '{power rack,squat cage,rack}', '{Back Squat,Front Squat,Rack Pull,Overhead Press}', 24),
  ('incline_press_machine', 'Incline Press Machine', '{incline chest press,incline machine,upper chest machine}', '{Incline Press}', 30),
  ('chest_press_machine', 'Chest Press Machine', '{chest press,seated chest press}', '{Chest Press}', 31),
  ('pec_dec', 'Pec Dec', '{pec deck,butterfly,chest fly machine,fly machine,chest pec dec fly machine,rear delt machine}', '{Chest Fly,Pec Deck,Reverse Pec Deck,Rear Delt Fly}', 32),
  ('cable_stack', 'Cable Machine', '{cable,cables,cable station,cable crossover,functional trainer,pulley}', '{Cable Crossover,Low-to-High Cable Fly,Tricep Pushdown,Rope Pushdown,Overhead Tricep Extension,Cable Curl,Bayesian Curl,Lateral Raise,Face Pull,Upright Row,Cable Crunch,Oblique Crunch,Pallof Press,Woodchopper,Cable Kickback,Straight-Arm Pulldown,Forearm Curl}', 33),
  ('lat_pulldown', 'Lat Pulldown', '{pulldown,lat machine,lat pull}', '{Lat Pulldown,Straight-Arm Pulldown}', 40),
  ('seated_row', 'Seated Cable Row', '{cable row,low row,seated row}', '{Seated Cable Row,Wide-Grip Row,Close-Grip Row}', 41),
  ('row_machine', 'Row Machine', '{machine row,chest supported row,plate loaded row}', '{Machine Row,Chest-Supported Row}', 42),
  ('t_bar_row', 'T-Bar Row', '{t bar,landmine row}', '{T-Bar Row}', 43),
  ('pullup_bar', 'Pull-Up Bar', '{chin up bar,pull up bar,captain''s chair}', '{Pull-Up,Chin-Up,Hanging Leg Raise}', 44),
  ('assisted_pullup', 'Assisted Pull-Up / Dip', '{assisted pull up,assisted dip,gravitron}', '{Assisted Pull-Up,Dip}', 45),
  ('back_extension', 'Back Extension Bench', '{hyperextension,roman chair,45 degree bench}', '{Back Extension}', 46),
  ('shoulder_press_machine', 'Shoulder Press Machine', '{shoulder press,overhead press machine,military press machine}', '{Shoulder Press}', 50),
  ('lateral_raise_machine', 'Lateral Raise Machine', '{side raise machine,lateral machine,delt machine}', '{Machine Lateral Raise}', 51),
  ('preacher_curl', 'Preacher Curl', '{preacher bench,preacher machine,curl machine,bicep curl machine}', '{Preacher Curl}', 60),
  ('tricep_dip_machine', 'Tricep Dip Machine', '{seated dip,dip machine,tricep machine}', '{Tricep Dip Machine}', 61),
  ('leg_press', 'Leg Press', '{leg press machine,45 degree leg press,sled}', '{Leg Press,Leg Press Calf Raise}', 70),
  ('hack_squat', 'Hack Squat', '{hack squat machine,hack}', '{Hack Squat}', 71),
  ('pendulum_squat', 'Pendulum Squat', '{pendulum}', '{Pendulum Squat}', 72),
  ('leg_extension', 'Leg Extension', '{quad extension,leg ext}', '{Leg Extension}', 73),
  ('seated_leg_curl', 'Seated Leg Curl', '{leg curl,hamstring curl,seated hamstring}', '{Leg Curl,Seated Leg Curl}', 74),
  ('lying_leg_curl', 'Lying Leg Curl', '{prone leg curl,lying hamstring curl}', '{Leg Curl,Lying Leg Curl}', 75),
  ('hip_adduction', 'Adductor / Abductor', '{inner thigh,outer thigh,hip adductor,hip abductor,adductor,abductor}', '{Adductor,Abductor}', 76),
  ('glute_drive', 'Hip Thrust Machine', '{glute drive,hip thrust machine,glute machine}', '{Glute Drive,Hip Thrust}', 77),
  ('standing_calf', 'Standing Calf Raise', '{calf raise machine,calf machine,standing calf}', '{Calf Raise,Standing Calf Raise,Donkey Calf Raise}', 78),
  ('seated_calf', 'Seated Calf Raise', '{seated calf machine}', '{Seated Calf Raise}', 79),
  ('ab_crunch_machine', 'Ab Crunch Machine', '{crunch machine,ab machine}', '{Crunch Machine}', 90)
on conflict (key) do update set name = excluded.name, nicknames = excluded.nicknames, lifts = excluded.lifts, sort = excluded.sort;
