# Backend, edge functions, security, privacy, free tier

Experts: #3 Backend / database, #4 Edge functions, #5 Security (appsec), #6 Privacy engineer, #24 DevOps / free-tier steward.

How we checked: read schema.sql, every file in supabase/ (8 SQL files, 5 edge functions), vercel.json, build.py, web-src/sw.js, privacy.html, terms.html, web/config.js, and every Supabase call and friends/feed renderer in app.js. On the live project (xvyibgnjibzopwtxajin) we read structure only: policies, grants, function definitions, constraints, foreign keys, triggers, cron jobs, table sizes, and both advisors. No user rows were read. The anon key in web/config.js decodes to `role: anon` (fine). No service-role key, VAPID private key or cron key is in the repo or in web/.

"Confirmed live" means the live database shows it. "From the code" means read, not run.

## Top 10

1. **Broken.** Anyone with your friend code can make themselves your friend without asking. The old `jobdone_friend_add` is still live and callable. They then see where you're training right now, your stories and your stats.
2. **Bad.** A friend can inject HTML into your feed through a post's PR count (`b.pr` is printed without `esc()`). CSP stops scripts but not a full-screen fake "sign in again" link. Chained with #1, any stranger can do it.
3. **Bad.** A friend can crash your Today and Friends screens by sending a status where `tr` is text instead of a list.
4. **Bad.** One account can fill the 500 MB free database in two weeks. The 20 MB per-account cap is copied by the daily backup and kept for 14 days, so one account can take about 300 MB. Two accounts take the project over the limit.
5. **Bad.** Feedback and error notes have no rate limit. A script can insert rows in a loop until the database is full.
6. **Bad.** Two-step sign-in doesn't protect anything social. A password-only session can read friends' stories, post, comment, edit the ID card and accept friend requests.
7. **Bad.** The only backups live inside the same database they protect. A bad migration, a dropped table or a lost free project takes the backups with it.
8. **Annoying.** Reporting a post always says "Reported. Thanks.", even when the report failed. A report also keeps no copy of the post, and the post is auto-deleted within 48 hours.
9. **Annoying.** The privacy page doesn't match the app. It says "only visible to your own account" and "we don't collect your location", but the app has the live "At the gym" status, comments and friends' posts.
10. **Annoying.** Signing out leaves the phone subscribed to the old account's pushes, so nudges with friends' names keep coming. Your face photo and friend code stay on the phone after sign-out and even after deleting the account.

Count: Broken 1 · Bad 6 · Annoying 6 · Nitpick 7 (20 total).

Still open from REVIEW.md: #141 (public sign-up; can't be checked from SQL, see B9), #142 (owner email hard-coded in the feedback policy, live: confirmed), #144 (CSP still in a meta tag), #147 (photos in rows plus full daily copies; worse than described, see B4), #149 (free-project pause), #150 (edge function invocations). Not repeated below except where something new was found.

---

## Findings

### B1. Strangers can add themselves as your friend, skipping your accept
- **Severity:** Broken
- **Experts:** #5, #6, #3
- **Where:** live function `public.jobdone_friend_add(p_code)`, executable by `authenticated`. supabase/friend_requests.sql:6 says it's "unused once v115 is live". app.js doesn't call it anywhere (only `jobdone_friend_request` / `jobdone_friend_answer`, app.js:1884, 1892).
- **Exploit:** your ID card share picture shows your friend code by default (app.js:1419, 1810: "Friend code on shared picture" is on). Someone sees your card on Instagram, signs up (free), and runs `SB.rpc('jobdone_friend_add', { p_code: 'ABC123' })` from the browser console. The function inserts the friendship **both ways** at once (live body: `insert into jobdone_friends ... values (me, f.user_id), (f.user_id, me)`). From that moment `jobdone_friends_list` and `jobdone_feed` give them:
  - your "At the gym" status: the gym name and when you got there, for 3 hours, which is a live location
  - your stories and Done Stamp photos
  - your training status and weekly count, and your card photo
  - the right to comment on and react to your posts, and to nudge you
  If you remove them, they can re-add themselves the same way. There is no block.
- **Why it matters:** the friend-request change (v115) exists so nobody sees you without your yes. That promise is false today. The privacy page also says "it counts once you accept".
- **Fix:** drop the function. [patches/back-01-drop-friend-add.sql](../patches/back-01-drop-friend-add.sql). Two lines, no app change.
- **Status:** confirmed live (function definition and grant).

### B2. HTML injection into friends' feeds through the post PR count
- **Severity:** Bad
- **Experts:** #5
- **Where:** app.js:1512 `${b.pr ? `<span class="pill pr">${b.pr} PR...` (no `esc()`). Server side, `jobdone_post` (supabase/friends_today.sql:51) stores any jsonb under 2 KB.
- **Exploit:** a friend (or a stranger via B1) calls `SB.rpc('jobdone_post', { p_kind: 'stamp', p_body: { pr: '<a href="https://evil.example" style="position:fixed;inset:0;z-index:99;background:#000;color:#fff;font-size:24px">Session expired. Tap to sign in again</a>' }, p_photo: null })`. Every friend who opens Friends sees a full-screen link to a fake sign-in page. The CSP (build.py:42) blocks inline scripts and event handlers, so it can't run code. It can still phish, cover the UI, and inject `<style>`, because style-src allows 'unsafe-inline'.
- **Why it matters:** every other field in postHTML is escaped. This one is the gap REVIEW.md #126 warned about. The share text (app.js:1779) also copies `b.pr` and `b.c` raw into the clipboard, which is harmless there.
- **Fix:** client: print `Math.floor(+b.pr)` only when it's a positive number. Server: the posts table only accepts a number for `pr`. [patches/back-03-feed-input-checks.patch](../patches/back-03-feed-input-checks.patch), [patches/back-05-social-checks.sql](../patches/back-05-social-checks.sql) part (a).
- **Status:** from the code. Live constraints on jobdone_posts were checked: only a size check on `body`.

### B3. A friend can crash your Today screen
- **Severity:** Bad
- **Experts:** #5, #3
- **Where:** app.js:1467 `if (s.d === T && s.tr && s.tr.length) ... s.tr.join(', ')`. `jobdone_stat` (friends_today.sql:8) accepts any object under 1 KB.
- **Exploit:** a friend calls `SB.rpc('jobdone_stat', { p: { d: '<today>', tr: 'x' } })`. A string has `.length` but no `.join`, so `frStatus` throws a TypeError. It runs inside `frStrip()` on Today (app.js:2080), in the friends list and in the faces row. Every friend's Today and Friends tab fails to render until that friend changes their status.
- **Fix:** `Array.isArray(s.tr)` on the client, plus a server check that `stat.tr` is an array. Same two patches as B2.
- **Status:** from the code.

### B4. One account can fill the free database through the backup multiplier
- **Severity:** Bad
- **Experts:** #24, #3, #5
- **Where:** schema.sql:117-128 (20 MB per-account quota). Live cron `jobdone-weekly-backup` runs `30 18 * * *` (**daily**, despite the name) and copies **every** doc row. `jobdone-backup-trim` keeps 14 days. That's still open from REVIEW.md #147, and now with numbers.
- **Exploit:** an account writes about 19 MB of `photos/YYYY-MM-DD-n` docs (allowed: 1.5 MB per row, 20 MB total). Each night the whole lot is copied again, so after 14 days that one account holds about 20 + 14 × 20 = 300 MB. Two such accounts pass 500 MB and the free project goes read-only for everyone. Accounts are free to make (see B9). Normal use grows the same way: every progress photo is stored 15 times. Today the database is 21 MB and backups are already the biggest table (1.3 MB for 62 live docs).
- **Fix:** copy only docs that changed that day, and keep the newest copy of each live doc forever. Restore works the same way (newest copy at or before time T). Lower the cap to 8 MB, and add an index for deleting by user. [patches/back-04-backup-changed-only.sql](../patches/back-04-backup-changed-only.sql). Moving photos to Storage (REVIEW.md wish list, 1 GB free) is the bigger, later fix.
- **Status:** confirmed live (cron schedule, quota trigger, table sizes).

### B5. Feedback and error notes can be inserted without limit
- **Severity:** Bad
- **Experts:** #5, #24
- **Where:** live policies "Send own feedback" and "insert own errors". The only trigger in the whole schema is the docs quota (checked live). Rows can be up to 4,000 chars (feedback) and about 1 KB (errors). Error notes are trimmed after 30 days. Feedback is never trimmed.
- **Exploit:** a signed-in script loops `SB.from('jobdone_errors').insert({...})`. At 50 inserts a second that's about 180 MB an hour, and the database is full in about 3 hours. The app's own limit (5 error notes per session, app.js:5344) is client-side only.
- **Fix:** a small trigger with daily caps: 30 feedback per account (with an error), 50 error notes (extra ones dropped quietly), plus 12-month retention for feedback. [patches/back-02-insert-rate-limits.sql](../patches/back-02-insert-rate-limits.sql)
- **Status:** confirmed live (policies, no triggers). The flood itself wasn't run.

### B6. Two-step sign-in doesn't cover friends, posts or the ID card
- **Severity:** Bad
- **Experts:** #5, #3
- **Where:** the restrictive aal2 policy covers only jobdone_docs and jobdone_sync_keys (schema.sql:81-84). The gym functions check it (`jobdone_gym_me`, gym.sql:78). The live social functions check only `auth.uid() is null`: `jobdone_feed`, `friends_list`, `friend_request`, `friend_answer`, `card_save`, `card_photo`, `at_gym`, `stat`, `post`, `comment`, `react`, `nudge`.
- **Exploit:** someone has your password but not your authenticator. Sign-in gives them an aal1 session. They can't read your workouts, but they can read every friend's stories, post a story as you, change your card name and photo, accept requests from their own account, and comment.
- **Fix:** add the same aal check: `me uuid := public.jobdone_gym_me()` in the plpgsql functions and `and (select jobdone_aal_ok())` in the SQL ones. Readers are done in full, writers as a pattern: [patches/back-05-social-checks.sql](../patches/back-05-social-checks.sql) part (b).
- **Status:** confirmed live (function definitions).

### B7. Backups live inside the database they protect
- **Severity:** Bad
- **Experts:** #24
- **Where:** `jobdone_backups` is in the same Postgres database. The free plan has no point-in-time restore or download. A free project paused for more than 90 days can't be restored (REVIEW.md #149).
- **How to see it:** any accident that hits the database hits the backups too: a `drop table` or wrong `delete` in the SQL editor, a bad migration, or the project being paused and lost. Restoring is also a hand-written SQL job (weekly-backup.sql:9 is one comment line).
- **Fix (free):** a GitHub Action on a weekly schedule that runs `supabase db dump --data-only -s public` (or `pg_dump`) with the database password stored as a GitHub secret, and uploads the file as an artifact kept 90 days. GitHub Actions minutes are free for this size. Add the restore query from back-04 to the repo so restoring isn't guesswork. Needs Job to paste the DB password into GitHub secrets once.
- **Status:** from the setup.

### B8. Reports say "sent" when they weren't, and keep no evidence
- **Severity:** Annoying
- **Experts:** #5, #6, #3
- **Where:** app.js:1803. supabase-js `insert()` doesn't throw on error. It returns `{ error }`. The `try/catch` never fires, so offline or a rejected insert still shows "Reported. Thanks."
- **How to see it:** turn on airplane mode, then ⋯ → Report it. You see the success toast and nothing is sent.
- **What else:** the report row holds only post id, name and user id. The post (photo, caption) is deleted by `jobdone-posts-tidy` within 48 hours, and backups don't include posts. Job can't see what was reported unless he opens the SQL editor within 48 hours. There's no server-side hide or block. "Hide" lives only in this phone's localStorage.
- **Fix:** check `error` (in back-03 patch). For evidence: copy `kind`, `body` and the first 200 chars of the caption into the report body. A `jobdone_report(p_id)` definer function could do this server-side and also stop the post showing to the reporter on every device. That's left for #20 (moderation) to decide.
- **Status:** from the code.

### B9. The sign-up rate limit trusts a header the caller can set
- **Severity:** Annoying
- **Experts:** #4, #5
- **Where:** supabase/functions/signup/index.ts:27 takes the **first** `x-forwarded-for` entry. Proxies append the real address at the end, so the first one is whatever the client sent.
- **Exploit:** `curl -H "X-Forwarded-For: 10.0.0.$i" .../functions/v1/signup` with a new `$i` each time gets past 5-per-hour. Each request also needs `ms >= 1500` in the body, but that's just a number the client sends. Combined with REVIEW.md #141 (public sign-up probably still on, which can't be read from SQL), there's no real limit on new accounts. That feeds B4 and B5.
- **Also:** `email_confirm: true` (line 34) lets anyone register **someone else's** email. Password reset emails don't send (no SMTP), so the real owner can never get that address back.
- **Fix:** send one test request with a fake `X-Forwarded-For` and log what arrives. Then use the last entry or the header Supabase sets for the real client. Turn off public sign-up in Auth settings (free, REVIEW.md #141). Turnstile, from the free to-do list, is the real bot gate.
- **Status:** from the code, needs one test call.

### B10. Privacy page doesn't match what the app does
- **Severity:** Annoying
- **Experts:** #6
- **Where:** web-src/privacy.html:9 "Your data is only visible to your own account." :28 "We don't collect your location". The "Friends activity" section (:26) leaves out the **At the gym** status (gym name and start time, shown to friends for 3 hours: at_gym.sql), comments (friends_social.sql), and nudges going out as push notifications with the sender's name.
- **Why it matters:** "At the gym" is location data shared on purpose, and the page says the app collects none. Under the Philippine DPA and GDPR the notice has to match the processing. Feedback and reports also have no stated retention (none exists, see B5).
- **Fix:** change the short version to "Your log is only visible to you; what you share with friends is listed below". Add a line: "At the gym: when you start a workout and choose to share it, friends see the gym name for up to 3 hours." Add comments to friends activity, and "feedback and reports are kept for 12 months" (back-02).
- **Status:** confirmed (page text vs. SQL).

### B11. Sign-out and delete-account leave things on the phone
- **Severity:** Annoying
- **Experts:** #6
- **Where:** sign-out (app.js:4843) removes only `LS_KEY` and doesn't unsubscribe push. Delete-account (app.js:5077) removes `LS_KEY` and `:pending` only. `jd-idphoto` (your face, base64), `jd-idcode`, `jd-gym`, `jd-hidepost` and `jd-owner-icon` stay (app.js:1344).
- **How to see it:** sign out on a shared or family iPad. That device's push subscription row still points to your account, so rest alerts, the daily reminder and friends' nudges ("Sam: Training today?") keep showing on it. After deleting the account, your face photo is still in that browser's storage.
- **Fix:** on sign-out and delete, call `restFn({ action: 'unsub', endpoint })` plus `sub.unsubscribe()` (the code already exists at app.js:140), and remove the `jd-id*` and `jd-gym` keys. About 3 lines.
- **Status:** from the code, needs iPhone for the push part.

### B12. The reminder cron is live and does a slow lookup per account every minute
- **Severity:** Annoying
- **Experts:** #24, #3
- **Where:** live cron `jobdone-remind` runs `* * * * *`, and `jobdone_remind_tick` is live (its URL points to the real project). CLAUDE.md says daily reminders are "not live", so the docs are out of date. In the function (schema.sql:151), `select 1 from pg_timezone_names where name = ...` re-reads the whole time zone list for each account with reminders on, every minute. jd/meta rows are found by scanning jobdone_docs, because the primary key starts with user_id.
- **Why it matters:** cheap at 5 users. At a few hundred users with reminders on, it's hundreds of time-zone scans a minute on the free micro instance, which also runs the 5-second rest tick.
- **Fix:** delete that line. An unknown zone already raises on the next line and is caught by the existing handler. [patches/back-08-remind-tick-cheaper.patch](../patches/back-08-remind-tick-cheaper.patch). Update CLAUDE.md "Open work".
- **Status:** confirmed live (cron, function). Load is an estimate.

### B13. Push subscriptions accept any https address
- **Severity:** Nitpick
- **Experts:** #4, #5
- **Where:** supabase/functions/rest-push/index.ts:89 checks only `^https://`.
- **Exploit:** a signed-in user saves `https://anything.example/x` as their endpoint, then calls `action: 'test'`. The edge function POSTs to that address on demand: a small blind SSRF and request relay. There's no `http://`, so cloud metadata is out of reach.
- **Fix:** allow only Apple, Google, Mozilla and Microsoft push hosts. [patches/back-07-push-endpoint-allowlist.patch](../patches/back-07-push-endpoint-allowlist.patch)
- **Status:** from the code.

### B14. Owner email committed to the repo and hard-coded in a live policy
- **Severity:** Nitpick
- **Experts:** #6, #5
- **Where:** supabase/post_theme_fix.sql:15 contains Job's personal Gmail address (commit c6eac96). The live policy "Owner reads feedback" compares against the same literal (still open from REVIEW.md #142).
- **Why it matters:** if the repo is or becomes public, the address is in the history for good, and it's the login for the account that reads every report.
- **Fix:** use `profile.owner` / a `jobdone_admins` table (user_id, like `jobdone_gym_admins`) in the policy, and replace the email in the one-off SQL with a uuid lookup by hand. Check the repo's visibility on GitHub.
- **Status:** confirmed (file and live policy).

### B15. Leaked-password check is off
- **Severity:** Nitpick
- **Experts:** #5
- **Where:** security advisor "Leaked Password Protection Disabled". Supabase's built-in switch is a paid-plan feature, so don't turn it on.
- **Fix (free):** in the signup function, take the SHA-1 of the password, send the first 5 hex chars to `https://api.pwnedpasswords.com/range/XXXXX` (free, no key, the password never leaves the server), and reject on a match. About 6 lines. It only covers new accounts.
- **Status:** confirmed (advisor).

### B16. Rest alerts are marked sent before they're sent; one dead phone delays the rest
- **Severity:** Nitpick
- **Experts:** #4
- **Where:** rest-push/index.ts:66-73. `update ... set sent = true` happens first, then pushes go out one by one, each with a 5 s timeout. A crash mid-loop loses those alerts. An endpoint that hangs (instead of returning 410) delays every later alert in that tick by 5 s.
- **Fix:** send with `Promise.allSettled` over the due list, and keep the update. Later, if it matters: mark `sent` per row after the send.
- **Status:** from the code.

### B17. Missing indexes the advisor flags
- **Severity:** Nitpick
- **Experts:** #3
- **Where:** performance advisor lists 12 unindexed foreign keys. The ones that matter: `jobdone_backups.user_id` (the biggest table, and account deletion cascades through it with no index; covered in back-04), `jobdone_friends.friend_id` (cascades and `friend_remove`), `jobdone_push_subs.user_id` (every send), and `jobdone_reacts.user_id`. Three policies call `auth.*()` per row instead of `(select auth.*())`.
- **Fix:** `create index` on those four. Wrap `auth.uid()` / `auth.jwt()` in `(select ...)` in the feedback and errors policies.
- **Status:** confirmed (advisor).

### B18. Every table is granted ALL, including TRUNCATE, to anon and authenticated
- **Severity:** Nitpick
- **Experts:** #3, #5
- **Where:** live grants on 20 of 26 tables (Supabase's default). RLS blocks rows, and PostgREST doesn't expose TRUNCATE, so it isn't reachable today. But TRUNCATE ignores RLS, and the tables reached only through RPC functions (cards, posts, friends, gyms, push_subs, rest_alerts...) don't need any direct grant.
- **Fix:** `revoke all on <rpc-only tables> from anon, authenticated;`. This is defence in depth, if a future change ever exposes SQL.
- **Status:** confirmed live.

### B19. Service worker caches failed responses
- **Severity:** Nitpick
- **Experts:** #24
- **Where:** web-src/sw.js:21. The cache-first branch stores the response without checking `res.ok`. A 404 or 500 for a vendor file or icon during a deploy then sticks until the next cache version bump.
- **Fix:** `if (res.ok)` before `put`, the same as pageFirst does.
- **Status:** from the code.

### B20. Backup file and job names don't match what runs
- **Severity:** Nitpick
- **Experts:** #24
- **Where:** supabase/weekly-backup.sql:2,8 say Sundays. Live `jobdone-weekly-backup` runs daily (schema.sql:108 matches live). The pg_net extension sits in the public schema (security advisor WARN).
- **Fix:** rename the job when applying back-04 (done there) and delete or update weekly-backup.sql. Leave pg_net where it is unless re-creating it is cheap.
- **Status:** confirmed live.

---

## Checked and fine
- RLS is on for all 26 public tables. Private tables (jobdone_private, backups, friends, friend_tries) have no grants.
- All security definer functions set `search_path` to `''` or `public`. Trigger and helper functions are not executable by clients.
- Friend codes: 10 tries an hour per account, counted even on a miss. 6 chars from 32 gives about 1 billion codes.
- Delete-account removes everything that matters. Docs, sync key and feedback are deleted explicitly. Everything else (cards, friends, requests, posts, comments, reacts, nudges, push subs, rest alerts, backups, errors, gym memberships, votes) cascades from auth.users (all FKs checked live). Gyms and machines you added stay without your id (`set null`), as the privacy page says.
- Sign-up gives the same answer for new and existing emails (no enumeration there).
- Steps key: 32 random bytes, only the SHA-256 is stored, shown once.
- gym-scan: membership, aal and a daily cap are checked before the Gemini call. The answer is limited to an enum of machine keys, so prompt injection in a photo can't do anything. Google's use of the data is on the privacy page.
- CORS is locked to the site in every function. Security headers in vercel.json are good (HSTS, nosniff, X-Frame-Options DENY, COOP, Permissions-Policy).
- Card and post photos are checked by a strict regex both in the database and in `idPhotoOk`. Names, comments, captions, gym names and the feedback inbox all go through `esc()`.
- Free-tier numbers today: database 21 MB of 500, cron log about 21k rows (trimmed daily), pg_net responses 152 kB.

## Patches
- [back-01-drop-friend-add.sql](../patches/back-01-drop-friend-add.sql): B1
- [back-02-insert-rate-limits.sql](../patches/back-02-insert-rate-limits.sql): B5, plus feedback retention for B10
- [back-03-feed-input-checks.patch](../patches/back-03-feed-input-checks.patch): B2, B3, B8 (app.js)
- [back-04-backup-changed-only.sql](../patches/back-04-backup-changed-only.sql): B4, B17 (backups index), B20
- [back-05-social-checks.sql](../patches/back-05-social-checks.sql): B2/B3 server checks, B6
- [back-07-push-endpoint-allowlist.patch](../patches/back-07-push-endpoint-allowlist.patch): B13
- [back-08-remind-tick-cheaper.patch](../patches/back-08-remind-tick-cheaper.patch): B12

Ship order: back-01 first, alone (one line, live hole). Then back-03 with the next app version. Then back-02 and back-05(a). Then back-04, then back-05(b). Every SQL file needs Job's yes before it runs on the live project.

## Couldn't cover
- Supabase Auth settings: public sign-up on or off, session length, password rules. These aren't readable through SQL.
- Whether the repo is public (no `gh` CLI on this PC).
- What the edge runtime actually puts in `x-forwarded-for` (B9 needs one test call).
- Real push delivery on iPhone (B11, B16).
