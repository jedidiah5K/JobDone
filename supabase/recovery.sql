-- Recovery codes (v199, Job 15 Nov): no email can be sent (no custom SMTP, nothing paid), so each account gets a
-- one-time code to save. "Forgot password" takes email + code + new password through the edge function "recover".
-- Only a bcrypt hash of the code is stored. A used code is deleted and every session is signed out.
create table if not exists public.jobdone_recovery (
  user_id uuid primary key references auth.users on delete cascade,
  code_hash text not null,
  at timestamptz not null default now()
);
alter table public.jobdone_recovery enable row level security; -- no policies: only the functions below

create table if not exists public.jobdone_recover_tries (k text not null, at timestamptz not null default now());
create index if not exists jobdone_recover_tries_k on public.jobdone_recover_tries (k, at);
alter table public.jobdone_recover_tries enable row level security;

-- Signed in: make a new code (replaces any old one). The plain code is returned once and never stored.
create or replace function public.jobdone_recovery_make() returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(12); c text := '';
begin
  for i in 0..11 loop c := c || substr(abc, 1 + (get_byte(b, i) % length(abc)), 1); end loop;
  insert into public.jobdone_recovery (user_id, code_hash, at) values (me, extensions.crypt(c, extensions.gen_salt('bf', 8)), now())
  on conflict (user_id) do update set code_hash = excluded.code_hash, at = now();
  return substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4);
end $$;

create or replace function public.jobdone_recovery_has() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.jobdone_recovery where user_id = public.jobdone_gym_me());
$$;

-- Service only (the edge function): the account id if the email and code match, else null.
create or replace function public.jobdone_recovery_check(p_email text, p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid; h text; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select id into u from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  select code_hash into h from public.jobdone_recovery where user_id = u;
  if u is null or h is null or length(c) <> 12 then perform extensions.crypt('x', extensions.gen_salt('bf', 8)); return null; end if; -- same work either way
  return case when extensions.crypt(c, h) = h then u end;
end $$;

-- Service only: after the new password is set, the code is used up and every device is signed out.
create or replace function public.jobdone_recovery_used(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.jobdone_recovery where user_id = p_user;
  delete from auth.sessions where user_id = p_user;
  delete from public.jobdone_recover_tries where at < now() - interval '1 day';
end $$;

revoke all on function public.jobdone_recovery_make() from public, anon;
revoke all on function public.jobdone_recovery_has() from public, anon;
revoke all on function public.jobdone_recovery_check(text, text) from public, anon, authenticated;
revoke all on function public.jobdone_recovery_used(uuid) from public, anon, authenticated;
grant execute on function public.jobdone_recovery_make() to authenticated;
grant execute on function public.jobdone_recovery_has() to authenticated;
grant execute on function public.jobdone_recovery_check(text, text) to service_role;
grant execute on function public.jobdone_recovery_used(uuid) to service_role;
