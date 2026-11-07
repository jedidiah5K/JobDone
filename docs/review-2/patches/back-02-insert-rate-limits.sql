-- back-02: daily caps on the two tables any signed-in account can insert into directly
-- (feedback/reports and error notes). Today a script can loop inserts and fill the 500 MB free database.
-- The app sends at most 5 error notes per session and feedback by hand, so these caps never touch real use.
create index if not exists jobdone_feedback_user_at on public.jobdone_feedback (user_id, created_at);
create index if not exists jobdone_errors_user_at on public.jobdone_errors (user_id, at);

create or replace function public.jobdone_insert_cap() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if tg_table_name = 'jobdone_feedback' then
    select count(*) into n from public.jobdone_feedback where user_id = new.user_id and created_at > now() - interval '1 day';
    if n >= 30 then raise exception 'Too much feedback today. Try again tomorrow' using errcode = '54000'; end if;
  else
    select count(*) into n from public.jobdone_errors where user_id = new.user_id and at > now() - interval '1 day';
    if n >= 50 then return null; end if; -- drop extra error notes quietly
  end if;
  return new;
end $$;
revoke execute on function public.jobdone_insert_cap() from public, anon, authenticated;

drop trigger if exists jobdone_feedback_cap on public.jobdone_feedback;
create trigger jobdone_feedback_cap before insert on public.jobdone_feedback for each row execute function public.jobdone_insert_cap();
drop trigger if exists jobdone_errors_cap on public.jobdone_errors;
create trigger jobdone_errors_cap before insert on public.jobdone_errors for each row execute function public.jobdone_insert_cap();

-- Feedback has no retention today. Keep a year (privacy page: add "feedback and reports are kept for 12 months").
select cron.schedule('jobdone-feedback-trim', '27 3 * * *', $$delete from public.jobdone_feedback where created_at < now() - interval '365 days'$$);
