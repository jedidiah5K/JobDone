-- back-01: remove the old instant-add friend function.
-- jobdone_friend_add (pre-v115) makes two people friends both ways with no request and no accept.
-- The app no longer calls it (only jobdone_friend_request / jobdone_friend_answer), but it is still
-- executable by every signed-in account, so anyone who has your code can skip your consent.
-- Run in the SQL editor after Job says yes. Safe to run twice.
revoke execute on function public.jobdone_friend_add(text) from public, anon, authenticated;
drop function if exists public.jobdone_friend_add(text);

-- Check: should return no rows.
-- select proname from pg_proc where proname = 'jobdone_friend_add';
