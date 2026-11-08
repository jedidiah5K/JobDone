-- Reports inbox, auto-hide after 2 reports, remove and suspend for the owner (7 Nov 2026). Applied to the live database 7 Nov 2026.
-- Who moderates: the owner's user id in jobdone_private (k = 'owner_id'), which only the service role can write.
-- It is filled from the auth account with Job's email (auth emails are verified; profile.owner is not).
-- (profile.owner itself can't be trusted here: users can write their own jd/meta.)
-- Safe to run twice. Live functions are edited in place, so earlier edits (no avatars, two-step, blocks) stay.

insert into public.jobdone_private (k, v)
  select 'owner_id', u.id::text from auth.users u where lower(u.email) = 'jobchua123@gmail.com'
    and not exists (select 1 from public.jobdone_private where k = 'owner_id');

alter table public.jobdone_posts add column if not exists hidden boolean not null default false;
alter table public.jobdone_comments add column if not exists hidden boolean not null default false;

create table if not exists public.jobdone_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users on delete cascade,
  target uuid references auth.users on delete set null,
  post_id bigint, comment_id bigint,
  what text not null, copy text not null default '',
  created_at timestamptz not null default now(),
  done boolean not null default false
);
alter table public.jobdone_reports enable row level security; -- no policies: functions only
revoke all on public.jobdone_reports from anon, authenticated;
create unique index if not exists jobdone_reports_once on public.jobdone_reports (reporter, coalesce(post_id, 0), coalesce(comment_id, 0));
create index if not exists jobdone_reports_open on public.jobdone_reports (done, created_at desc);

create table if not exists public.jobdone_suspensions (
  user_id uuid primary key references auth.users on delete cascade,
  until timestamptz not null, created_at timestamptz not null default now()
);
alter table public.jobdone_suspensions enable row level security;
revoke all on public.jobdone_suspensions from anon, authenticated;

create or replace function public.jobdone_is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.jobdone_aal_ok()
    and auth.uid()::text = (select v from public.jobdone_private where k = 'owner_id');
$$;
revoke execute on function public.jobdone_is_owner() from public, anon;
grant execute on function public.jobdone_is_owner() to authenticated;

create or replace function public.jobdone_suspended(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobdone_suspensions s where s.user_id = u and s.until > now());
$$;
revoke execute on function public.jobdone_suspended(uuid) from public, anon, authenticated;

-- Report a post or a comment. The server copies the text (no photo), so a report can't be faked.
-- Two different people reporting the same thing hides it for everyone but its author until the owner looks.
create or replace function public.jobdone_report(p_post bigint, p_comment bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.jobdone_gym_me(); tgt uuid; pid bigint := p_post; txt text; w text; n int;
begin
  if (select count(*) from public.jobdone_reports where reporter = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many reports today' using errcode = '54000'; end if;
  if p_comment is not null then
    select c.user_id, c.post_id, c.body into tgt, pid, txt from public.jobdone_comments c where c.id = p_comment;
    w := 'comment';
  else
    select p.user_id, concat_ws(' · ', p.body->>'sp', p.body->>'c', p.body->>'h'), p.kind into tgt, txt, w from public.jobdone_posts p where p.id = p_post;
    w := coalesce(w, 'post') || ' post';
  end if;
  if tgt is null or pid is null or not public.jobdone_can_see(pid) then return jsonb_build_object('none', true); end if;
  if tgt = me then return jsonb_build_object('self', true); end if;
  insert into public.jobdone_reports (reporter, target, post_id, comment_id, what, copy)
    values (me, tgt, case when p_comment is null then pid end, p_comment, w, left(coalesce(nullif(txt, ''), '(no text)'), 500))
    on conflict do nothing;
  if p_comment is not null then
    select count(distinct reporter) into n from public.jobdone_reports where comment_id = p_comment and not done;
    if n >= 2 then update public.jobdone_comments set hidden = true where id = p_comment; end if;
  else
    select count(distinct reporter) into n from public.jobdone_reports where post_id = pid and comment_id is null and not done;
    if n >= 2 then update public.jobdone_posts set hidden = true where id = pid; end if;
  end if;
  return jsonb_build_object('ok', true, 'hidden', n >= 2);
end $$;
revoke execute on function public.jobdone_report(bigint, bigint) from public, anon;
grant execute on function public.jobdone_report(bigint, bigint) to authenticated;

-- Owner: open reports, newest first, grouped per post or comment.
create or replace function public.jobdone_reports_inbox() returns table (id bigint, what text, copy text, target uuid, target_n text,
  post_id bigint, comment_id bigint, hidden boolean, gone boolean, reports bigint, at timestamptz, suspended boolean)
language sql stable security definer set search_path = '' as $$
  select max(r.id), max(r.what), max(r.copy), r.target, max(c.card->>'n'), r.post_id, r.comment_id,
    coalesce(bool_or(p.hidden), bool_or(m.hidden), false),
    bool_and(p.id is null and m.id is null), count(*), max(r.created_at), public.jobdone_suspended(r.target)
  from public.jobdone_reports r
  left join public.jobdone_cards c on c.user_id = r.target
  left join public.jobdone_posts p on p.id = r.post_id
  left join public.jobdone_comments m on m.id = r.comment_id
  where public.jobdone_is_owner() and not r.done
  group by r.target, r.post_id, r.comment_id
  order by max(r.created_at) desc limit 100;
$$;
revoke execute on function public.jobdone_reports_inbox() from public, anon;
grant execute on function public.jobdone_reports_inbox() to authenticated;

-- Owner: act on a report. remove = delete the post or comment; suspend = remove + no posting, commenting,
-- reacting, nudging or friend requests for p_days; dismiss = put it back and close the report.
create or replace function public.jobdone_moderate(p_report bigint, p_action text, p_days int default 7) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.jobdone_reports;
begin
  if not public.jobdone_is_owner() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into r from public.jobdone_reports where id = p_report; if not found then return; end if;
  if p_action in ('remove', 'suspend') then
    if r.comment_id is not null then delete from public.jobdone_comments where id = r.comment_id;
    elsif r.post_id is not null then delete from public.jobdone_posts where id = r.post_id; end if;
  end if;
  if p_action = 'suspend' and r.target is not null then
    insert into public.jobdone_suspensions (user_id, until) values (r.target, now() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 365))))
      on conflict (user_id) do update set until = excluded.until;
  end if;
  if p_action = 'dismiss' then
    if r.comment_id is not null then update public.jobdone_comments set hidden = false where id = r.comment_id;
    elsif r.post_id is not null then update public.jobdone_posts set hidden = false where id = r.post_id; end if;
  end if;
  if p_action not in ('remove', 'suspend', 'dismiss') then raise exception 'Unknown action'; end if;
  update public.jobdone_reports set done = true
    where coalesce(post_id, 0) = coalesce(r.post_id, 0) and coalesce(comment_id, 0) = coalesce(r.comment_id, 0) and not done;
end $$;
revoke execute on function public.jobdone_moderate(bigint, text, int) from public, anon;
grant execute on function public.jobdone_moderate(bigint, text, int) to authenticated;

-- Edits to live functions: the feed skips hidden posts (except your own) and hidden comments,
-- and suspended accounts can't post, comment, react, nudge or send requests.
do $$
declare f text; d text; n text;
begin
  d := pg_get_functiondef('public.jobdone_feed()'::regprocedure);
  if d not like '%p.hidden%' then
    n := replace(replace(d,
      'where p.created_at > now() - interval ''24 hours''', 'where (not p.hidden or p.user_id = (select public.jobdone_gym_me())) and p.created_at > now() - interval ''24 hours'''),
      'where m0.post_id = p.id and', 'where m0.post_id = p.id and not m0.hidden and');
    if n = d or n not like '%m0.hidden%' then raise exception 'unexpected jobdone_feed body'; end if;
    execute n;
  end if;
  foreach f in array array['jobdone_post(text,jsonb,text)','jobdone_comment(bigint,text)','jobdone_react(bigint,text)','jobdone_nudge(uuid)','jobdone_friend_request(text)'] loop
    d := pg_get_functiondef(('public.' || f)::regprocedure);
    if d like '%jobdone_suspended%' then continue; end if;
    n := regexp_replace(d, E'\nbegin\n', E'\nbegin\n  if public.jobdone_suspended(me) then raise exception ''Suspended'' using errcode = ''42501''; end if;\n');
    if n = d then raise exception 'unexpected body in %', f; end if;
    execute n;
  end loop;
end $$;

-- Reports are kept 12 months, like feedback (privacy page).
select cron.schedule('jobdone-reports-trim', '33 3 * * *', $$delete from public.jobdone_reports where created_at < now() - interval '365 days'$$);
