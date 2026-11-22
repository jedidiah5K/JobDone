# Condom report: Job's Done

Run 22 Nov 2026 on the repo (main, v209 local) and the live site https://jobdone-peach.vercel.app.
This is a careful first pass by a tool. It is not legal advice and not a penetration test.

**Assumptions** (from the code and project notes, not asked again): users mostly in the Philippines, open to anyone; sign-up is 13+;
about 13 accounts, no money yet; run by Job personally; sensitive data = body weight, measurements, progress photos, steps.
Only harmless checks were run against the live site (headers, file paths). No real user data was read.

## What would hurt first

1. **Password reset doesn't sign out other phones** (Medium). If someone got into an account, resetting the password with the
   recovery code doesn't kick them out.
2. **Privacy page missed two services** (Medium, legal). Sentry (crash notes, since v198) and Cloudflare Turnstile (new in v209)
   weren't listed. **Fixed in this run**: `web-src/privacy.html`, dated 22 Nov.
3. **No leaked-password check** (Low). Supabase's leaked-password check is a paid-plan feature. Fine until launch spending starts.

Counts: Critical 0 · High 0 · Medium 2 (1 fixed) · Low 3.

## The ten core checks

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | Secret key in the browser | CLEAR | `web/` has only the anon key (JWT role `anon`). No `service_role`, `sk_`, VAPID private key or Resend key in built files. |
| 2 | Database rules | CLEAR | Every public table has RLS on. `jobdone_docs` and `jobdone_sync_keys`: own rows only plus the two-step check. No storage buckets. |
| 3 | Price from the browser | Doesn't apply | No payments. |
| 4 | Paid without proof | Doesn't apply | No payments or webhooks. |
| 5 | Server routes that don't check the caller | CLEAR | `delete-account` checks the session token; `steps` checks a hashed sync key; `rest-push` checks the token or the cron key; security definer functions take the user from `jobdone_gym_me()`, not the request. |
| 6 | Someone else's record by id | CLEAR (spot check) | `jobdone_friend_answer`, `jobdone_crew_answer`, `jobdone_gym_board`, `jobdone_turn_ping` all check membership or use the caller's own id. Not every function was read. |
| 7 | No limits | CLEAR | Sign-up 5 per network per hour plus honeypot and timing check, plus Turnstile in v209 once the secret is set; recovery 5 tries per network and per email per 15 min; nudges capped per day; Supabase's own login limits. |
| 8 | Secrets in the repo | CLEAR | No `.env` files tracked or in history; no project keys found in `.claude/settings.local.json`. A full trufflehog scan was not run. |
| 9 | Trackers without a privacy page | CLEAR | No analytics, ad pixels or session replay. Privacy page exists (now lists Sentry and Turnstile). Only functional local storage, so no cookie banner is needed. |
| 10 | Charging without terms | Doesn't apply yet | Nothing is sold. Becomes relevant with the paid tier at the store launch. |

Login redirect check (SEC-AUTH-01): the app has no redirect-after-login parameter. CLEAR.

## Other findings

**SEC · Password reset keeps old sessions** · LIKELY · Medium
Evidence: `supabase/functions/recover/index.ts:36` changes the password with `updateUserById` and never ends existing sessions.
What could happen: someone already signed in on another phone stays signed in after the owner resets.
Fix (Claude, needs a deploy): after the reset, delete that user's rows in `auth.sessions` through a service-role-only SQL function.

**LAW · Privacy page incomplete** · CONFIRMED → FIXED · Medium
Evidence: no mention of Sentry or Cloudflare in `web-src/privacy.html` before this run.
Fix: added both, with what they receive. Ships with v209.

**SEC · Leaked-password check off** · LIKELY · Low
Supabase only offers it on the Pro plan. Revisit with the store launch budget.

**SEC · Owner feedback rule keyed on email** · LIKELY · Low
`jobdone_feedback` "Owner reads feedback" checks `auth.jwt()->>'email'`. Safe while email changes need confirmation; a check on
`jobdone_is_owner()` would be sturdier.

**SEC · Two trigger functions executable by anon** · CLEAR on review · Low
`jobdone_req_push` and `jobdone_party_push` return `trigger`, so they can't be called directly. Revoking execute is tidy, not urgent.

## Headers on the live site (CLEAR)
HSTS (2 years, subdomains) · X-Frame-Options DENY · nosniff · Referrer-Policy · Permissions-Policy · CSP in the page.
`/.git/config` → 404. `app.js.map` → 403.

## Laws

- **Philippines Data Privacy Act 2012**: applies (personal data of people in the Philippines). Privacy page, deletion in the app and
  a contact address are in place. Once you have a company or many users, check whether you must register with the NPC (needs a lawyer).
- **COPPA (US, under 13)**: doesn't apply, sign-up is 13+.
- **GDPR / UK GDPR**: can't tell. Applies if you market to people in Europe. The privacy page already covers most of it.
- **CCPA (California)**: doesn't apply. Thresholds are $25M+ revenue or 100,000+ Californians.
- **CAN-SPAM**: doesn't apply yet, no marketing emails. It will when follow-up emails start (unsubscribe link plus postal address).
- **App store rules**: in-app account deletion and report/block exist. The full store check belongs to launch prep.

## Not checked
Every security definer function line by line · full git-history secret scan (trufflehog) · a professional pen test (worth doing
before handling data at scale).

## Waiting on Job
- Yes or no to the session-revoke fix (Supabase deploy).
