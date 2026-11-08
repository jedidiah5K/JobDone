-- Friends features need two-step sign-in too (expert review back-05 part b). Applied to the live database 7 Nov 2026.
-- Before: these functions only checked auth.uid(), so a password-only session of an account with two-step on could
-- read friends' stories, post, comment and edit the ID card. Workout data already needed the code.
-- How: each live definition is edited in place, so nothing else in them changes (perf-07's feed without avatars stays).
--   plpgsql: "declare me uuid := auth.uid();" -> "declare me uuid := public.jobdone_gym_me();" (raises unless two-step is done)
--   sql:     every auth.uid() -> (select public.jobdone_gym_me())  (evaluated once per call)
-- Accounts without two-step see no change: jobdone_aal_ok() is true when no verified factor exists.
-- Safe to run twice (already-edited functions are skipped). Stops if a definition doesn't look as expected.
do $$
declare f text; d text; n text;
begin
  foreach f in array array['jobdone_card_get()','jobdone_card_photo(text)','jobdone_card_save(jsonb)','jobdone_at_gym(text)',
    'jobdone_stat(jsonb)','jobdone_comment(bigint,text)','jobdone_friend_answer(uuid,boolean)','jobdone_friend_request(text)',
    'jobdone_nudge(uuid)','jobdone_post(text,jsonb,text)','jobdone_react(bigint,text)'] loop
    d := pg_get_functiondef(('public.' || f)::regprocedure);
    if d like '%public.jobdone_gym_me()%' then continue; end if;
    n := replace(d, 'declare me uuid := auth.uid();', 'declare me uuid := public.jobdone_gym_me();');
    if n = d then raise exception 'unexpected body in %', f; end if;
    execute n;
  end loop;
  foreach f in array array['jobdone_can_see(bigint)','jobdone_comment_delete(bigint)','jobdone_friend_remove(uuid)',
    'jobdone_friend_requests()','jobdone_friends_list()','jobdone_feed()','jobdone_post_delete(bigint)','jobdone_post_photo(bigint,text)'] loop
    d := pg_get_functiondef(('public.' || f)::regprocedure);
    if d like '%public.jobdone_gym_me()%' then continue; end if;
    n := replace(d, 'auth.uid()', '(select public.jobdone_gym_me())');
    if n = d then raise exception 'unexpected body in %', f; end if;
    execute n;
  end loop;
end $$;
