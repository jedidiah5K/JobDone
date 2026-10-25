# Job's Done: notes for Claude Code

Job is the owner (GitHub jedidiah5K), lives in UTC+8, uses Windows, tests on an iPhone.

## What the app is
Job's Done is an iPhone-first workout tracker website that installs to the Home Screen (a PWA). Vanilla JS, no framework. Splits, two-tap set logging, last-session comparisons, PRs, plate loader, rest timer, body weight, steps, progress charts, recap share cards, four themes. Friends use it as an "early beta" (never say "soft launch"). User-facing name is "Job's Done" with the apostrophe; repo, Vercel and Supabase names stay "JobDone"/"jobdone".

## Repo layout (branch main)
| Path | What |
|---|---|
| app.js, styles.css | The whole app (~380 KB JS) |
| web-src/ | Website shell (index-shell.html), sw.js offline worker, manifest, icons, fonts, vendored supabase-js 2.45.4, privacy/terms/about/404 pages |
| web/ | Built output that Vercel serves as-is. Don't hand-edit except web/config.js |
| web/config.js | Supabase URL + anon key (public by design; never overwritten by the build) |
| build.py | Rebuilds web/ from source, injects CSP script hashes |
| schema.sql | Tables + row-level security |
| supabase/functions/ | Edge functions: signup, delete-account, steps, rest-push |
| themes-art/ | Wallpaper sources |
| shell.html | Shell for the old single-file Claude artifact build |

## Build and run
```
npm i esbuild@0.23.1
$env:JOBDONE_ESBUILD = "$PWD\node_modules\@esbuild\win32-x64\esbuild.exe"
python build.py
cd web; python -m http.server 8000      # open http://localhost:8000
```
Always build with esbuild set: web/index.html is minified, and building without it makes a huge diff. Bump the service worker version in web-src/sw.js when shipping so phones pick up the update.

## Hosting
- Vercel project jobdone, live at https://jobdone-peach.vercel.app, auto-deploys on every push to main. Root vercel.json serves web/ and sets security headers. Vercel tools only work without a teamId.
- Supabase project jobdone (ref xvyibgnjibzopwtxajin, Singapore, free plan). Main table jobdone_docs (RLS "Own data only"), plus jobdone_sync_keys, jobdone_feedback, jobdone_push_subs, jobdone_rest_alerts, jobdone_private (service-role only), jobdone_backups (daily, 14 days kept). pg_cron runs rest pushes every 5 s. Job's other Supabase project "JobDone" (xgmwqpasogwlvtjaapwo) is unused; ignore it.
- Never put secrets (service-role key, VAPID private key, cron key) in the repo. The anon key in config.js is fine.
- Pushing to main is a live change. Work on a branch and ask Job before merging.

## Standing rules from Job
- Nothing paid, ever. No paid Supabase/Vercel features, no domain purchase, no paid APIs. Free only.
- Job wants the simplest setup and hates multi-step chores. Do things for them; ask before installing tools.
- Job changes direction often: always show screenshots of UI changes before calling them done (Playwright works). When Job sends a design for one theme, change ONLY that theme.
- Copy: plain and human. No AI-sounding writing (stock words, "not X but Y", forced lists of three, filler). Don't make copy about Job; new users get generic wording.
- Never: calorie or protein tracking; plateau alerts or advice telling Job to change weight/reps; exercise pictures (keep muscle map, steps, equipment rules, rep range); anything that pauses music (sounds mix over music and follow the silent switch); a welcome screen; the demo account; Google sign-in or email codes; lime green; nagging about measurements/photos.
- Sign-in is email + password only, stays signed in. No custom SMTP, so password-reset emails don't send.
- Haptics and Dynamic Island aren't possible from a website on iOS. No native app planned.
- Before shipping anything that touches user data, check the security basics: HTTPS/HSTS, RLS, rate limits, no user enumeration, input size limits, security headers, backups, privacy page kept current.

## Users and defaults
- New accounts: count the bar (20 kg), 2:00 rest, per-exercise rest via the workout's ⋯ menu, "Steps from Apple Health".
- Job's own account (legacy, profile.owner): plates only (no bar), 5:00 rest, QWatch step sync, feedback inbox, owner-only Skyline blazer icon.
- First-login intro (new accounts only): 9 steps, no goal or sex/gender question, calm dark style; theme picker previews the whole screen live; Sounds step (all switches default on); How you train; plan step (presets or build your own); CSV import offered.

## Design
Four themes, same layout and identical heights across all of them, uppercase labels:
- Agent (default, listed first; key mono): obsidian wallpaper, red glow at top, sniper-scope day dots, Bond-style lines. No suit-and-tie art, no laser/gun barrel/blinds/casino/silk.
- Summit (key cliffs): whole-screen sky that follows the clock (day/dusk/night), ridges with pines, rock day dots; labels have no chip.
- Boulder (key climb): the classic pre-v7 look Job loves. Cream panels, boxed kg/reps cells, floating tab bar with big purple +, purple rope, chalk wall. Don't iOS-ify it.
- Skyline (key spidey): night city, uniform yet asymmetrical, taller on the right, every third building lit, one web line, cobwebs at bottom corners only, no Spider-Man figure, all split colours red.

Signed-out screens always use Agent. Detailed, not busy. Keep the solid status bar at the top (a translucent one triggers an iOS 26 Home Screen bug).
Share cards and finish pages differ per theme (drawShare/drawBam in app.js) but are all the same size; Post 1080x1350, Story 1080x1920. "That's like…" volume lines are theme-voiced and short (HEAVY in app.js).
App icon: flat black, white shirt and tie, gold ribbon and medal with a check. A new icon needs the Home Screen app removed and re-added.

## Training content
- Presets are built only from Job's foundation lifts: Chest Fly (machine = pec dec), Incline Press (machine default, Smith via swap), Lat Pulldown, Wide-Grip Row (+ Close-Grip Row on back days), Shoulder Press, Lateral Raise, Preacher Curl, Tricep Pushdown, Overhead Tricep, Leg Extension, Leg Curl, Leg Press (no squats), Adductor/Abductor, SLDL, Calf Raise. Reuse existing exercises with an equipment default instead of adding duplicates.
- 10+ preset plans (PPL, UL, Full body A/B, Anterior/Posterior, Torso/Limbs, PHUL, PPL+UL, Arnold, Bro). Splits share by link.
- Rotation: next up is the split after the last one done; saving the rotation restarts it from the first split.
- Plate loader opens first on every kg box (machines too), with a Dial/keypad switch.
- After the last set of each lift, the "Exercise done" pop-up adds a theme-voiced wipe-down line (7 s, tap to close).

## Steps
QWatch Pro (not Apple Watch) → Apple Health → "JobDone Steps" Shortcut (daily 9:30 PM, last 3 days) → edge function steps with a per-user sync key (Me → Steps from QWatch). Working.

## Open work (as of 25 Oct 2026)
- Daily workout reminders are built on branch claude/project-thread-nxnuq7 but not live. Going live = merge to main + run the daily_workout_reminders part of schema.sql + redeploy rest-push. Needs Job's explicit go.
- Ideas still open: more box-merging on Today, bigger milestone moments.
- Job's optional free to-dos: GitHub Dependabot/secret scanning, UptimeRobot, Vercel Web Analytics, Cloudflare Turnstile.
- Files only in the online Claude project (not in GitHub): build prompt, May–Oct workout log CSV, jobdone-backup.json, screenshots, notes/feature-ideas.md, private personal/ seed folder.

## Working with Job
- Job reads replies on their phone, so keep them short and lead with the result.
- When unsure which of two readings Job means, start on the likelier one and say which you picked.
