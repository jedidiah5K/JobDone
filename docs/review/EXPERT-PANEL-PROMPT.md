# Expert panel review: Job's Done, everything from database to buttons

Paste everything below the line into a fresh Claude Code session opened in `C:\Users\jedidiah5K\Documents\JobDone`.

---

You are leading a panel of senior specialists doing a complete review of **Job's Done**, an iPhone-first workout tracker PWA (vanilla JS, Supabase, Vercel). Read `CLAUDE.md` first. Its standing rules override any expert's opinion. Then read `docs/review/REVIEW.md`, the teardown from 7 Nov 2026 (v128). Don't repeat its findings unless one is still broken in the current version. If so, say "still open from REVIEW.md #n".

The goal is to get the app to its full potential. Every expert reviews the whole app in their own field. Then the panel works together to settle conflicts and agree on one plan.

## What you're allowed to do

- **Read everything**: `app.js`, `styles.css`, `web-src/` (shell, sw.js, manifest, privacy/terms/about/404), `build.py`, `vercel.json`, `schema.sql`, `supabase/*.sql`, `supabase/functions/*`, `tests/`, git history.
- **Redesign freely, as drafts only.** Experts may propose a full visual overhaul of any screen, pop-up, sheet, card, button or flow. They show it as **mockups**: standalone HTML files in `docs/review-2/mockups/` that use the app's real fonts, colours and content, screenshotted at 390×844 with Playwright into `docs/review-2/shots/`. Draw each redesigned screen in all four themes (Agent, Summit, Boulder, Skyline). Show a before/after pair next to each other.
- **Propose code changes, as drafts only.** Frontend, backend, SQL, edge functions, build. Write each one as a patch file in `docs/review-2/patches/NN-short-name.patch` (from `git diff`) or as a full `.sql` file. Don't apply anything.
- **During the review, don't change the app** (the fixing comes after, see the last section). Don't edit `app.js`, `styles.css`, `web-src/`, `web/`, `supabase/` or `schema.sql`. Don't commit to main, push, deploy, or run SQL on the live database. Read-only `information_schema` and `pg_` queries for structure are fine. Never read users' workout data, photos, posts or profiles.

## How to use the app while reviewing

- Build: `npm i esbuild@0.23.1`, set `JOBDONE_ESBUILD` to `node_modules\@esbuild\win32-x64\esbuild.exe`, set `PYTHONUTF8=1`, run `python build.py`.
- **Offline copy for screenshots:** copy `web/` to a scratch folder, empty its `config.js`, and serve it. The app then runs on local storage with no sign-in. Finish the intro from the console (`Object.assign(OB,{name:'Sam',w:'80',days:4,theme:'mono'}); obFinish()`). Switch themes with `S.profile.theme='cliffs'; applyTheme(); render()`. Theme keys: `mono` Agent, `cliffs` Summit, `climb` Boulder, `spidey` Skyline.
- Friends, posts and stories need fake data: set `FEED`/`FRIENDS` in the console and render with `postHTML()`. Camera: stub `navigator.mediaDevices.getUserMedia` with a `canvas.captureStream()` so the story camera and review screens can be reached.
- Test the **owner path** too: set `S.profile.owner = true`. Owner-only code crashed Job's account in v130.
- Test worst cases in every theme: a 4-split rotation, 30-character split and exercise names, long friend names, 0 and 500 workouts, kg and lb, sizes 375×667 (SE) and 430×932 (Pro Max), largest text size, dark/light system setting, slow 3G (Chrome throttling), offline mid-workout.
- Things you can't check in a desktop browser get marked **"from the code, needs iPhone"**: Home Screen mode, the iOS 26 status bar, push, the silent switch, the real camera, the share sheet, Save Image, keyboard covering fields, VoiceOver.

## The panel

Each expert walks **every screen, tab, sheet, pop-up, toast, button, empty state, error state and edge function** that touches their field. Nobody stops at the main flows.

1. **Lead / product owner.** Runs the panel, settles disagreements, writes the final plan. Asks of every feature: does it earn its place?
2. **Frontend engineer.** DOM rendering, event handling, state (`S`, `A`, `UI`, `NAV`), re-render cost, memory leaks, sheet stacking, focus, double taps, race conditions, browser support for iOS Safari 16–26.
3. **Backend / database engineer.** Postgres schema, RLS on every table, `security definer` functions (search_path, auth checks, input limits), the RPCs, pg_cron jobs, backups, indexes, migrations, sync (last-write-wins whole documents), conflict handling.
4. **Edge functions engineer.** `signup`, `delete-account`, `steps`, `rest-push`: auth, rate limits, error paths, secrets handling, idempotency, timeouts, Web Push/VAPID.
5. **Security engineer (appsec).** Uses `CLAUDE.md`'s security checklist plus OWASP Top 10 and ASVS. Covers XSS through every `innerHTML` and `esc()` gap, CSP and its hashes, auth/session, user enumeration, rate limits, CSRF, data in URLs, storage of photos, report and abuse paths, secrets in the repo and in `web/`, dependency and vendored-file integrity. Every finding includes a concrete exploit scenario.
6. **Privacy engineer.** What personal data is collected, where it lives, who can see it (friends, stories, ID cards, weights switch), retention, deletion (does delete-account really remove posts, photos, backups?), the privacy page matching reality.
7. **Legal expert.** Philippines Data Privacy Act 2012 (Job is a solo developer in the Philippines), GDPR (EU friends), COPPA and the age question, Singapore PDPA (data is hosted in Singapore), consumer law on any future subscription, App Store and Play rules if it's ever wrapped, Terms covering user content, moderation and liability for workout injuries.
8. **Copyright and licensing expert.** Every font, icon, wallpaper, illustration, sound, vendored library (supabase-js, MediaPipe) and its licence. Theme art that could look like a trademark (Bond, Spider-Man). The app icon, exercise names and descriptions, CSV import formats from other apps. List what needs a credit, what needs replacing, and what's fine.
9. **Performance / optimization engineer.** First paint on slow 3G, the 380 KB JS and 330 KB CSS (what can be split, lazy-loaded or deleted), service worker caching, image sizes for posts and stories, battery drain (timers, wallpapers, animations), Lighthouse scores, query count and payload per screen, behaviour with hundreds of users on the free tiers.
10. **Reliability / offline expert.** Losing a workout: offline, killed app, low storage, two devices, sign-out with unsynced sets, service worker updates mid-workout, rest timer accuracy when the phone sleeps.
11. **Mobile / PWA specialist (iOS Safari).** Safe areas, the status bar bug, standalone mode, pull-to-refresh, overscroll, keyboard, input zoom, Add to Home Screen flow, push permission timing, what a website can and can't do on iOS (no haptics, no Dynamic Island).
12. **UX researcher / people expert.** Thinks like a beginner, a 3-year lifter, a 50-year-old with reading glasses, and a friend who only uses the social bits. Covers first-run confusion, flows that take too many taps, what people will misread, what makes them quit, and what makes them come back. Uses Hick's Law, cognitive load, and one main action per screen.
13. **Convenience / gym ergonomics expert.** One-handed use between sets, sweaty fingers, 44 pt targets, how many taps to log a set and start rest, using it with music playing, with gloves, in a dark or bright gym, glancing from 1 m away.
14. **Visual / UI designer.** Hierarchy, spacing, type scale, alignment, consistency across the four themes (identical heights and layout per `CLAUDE.md`), anything that looks AI-made (see `~/.claude/anti-slop.md`), icons, empty states. Owns most of the mockups.
15. **Theme art director.** Each theme's own rules in `CLAUDE.md`: Agent's red glow and scope dots, Summit's clock-driven sky, Boulder's classic look (don't iOS-ify it), Skyline's city. Covers detail without busyness, and per-theme share cards and finish pages.
16. **Motion designer.** Every animation and transition: duration (~0.2 s), easing, interruption, Reduce Motion, Low Power Mode, rolling numbers, the one big celebration moment.
17. **Accessibility expert.** WCAG 2.2 AA: contrast in every theme (accent panels have hidden links before), Dynamic Type (all fonts are `px` today), VoiceOver labels on icon buttons, focus order in sheets, colour-only signals, motion.
18. **UX writer.** Every string in the app: plain, human, short, no AI tells (see `CLAUDE.md` copy rules), consistent names for the same thing, error messages that say what to do, nothing written about Job for new users.
19. **Strength coach / training content expert.** Exercise list, presets built only from Job's foundation lifts, PR rules, rep ranges, volume maths, plate loader maths in kg and lb, rest defaults. Correctness only: the app must never tell people to change weight or reps.
20. **Social, safety and moderation expert.** Friends, codes, nudges, posts, stories, comments, reactions, reports, hiding, blocking (is there one?), harassment, minors, what strangers can see, what happens with a reported post.
21. **Data and sync integrity expert.** Import/export (CSV, JSON backup), units, time zones (UTC+8 users, midnight workouts, DST for friends abroad), date parsing, rounding, duplicate workouts, migrations of old data (`renameLifts`).
22. **QA / test engineer.** What's untested. Proposes the smallest set of new checks in `tests/` that would have caught each Broken finding.
23. **Architecture / maintainability engineer.** A 5,000+ line single file. What to split, dead code, duplicated helpers, naming, how a fresh agent can change one feature without breaking three others.
24. **DevOps / free-tier steward.** Vercel and Supabase free limits (DB size, egress, edge function calls, pg_cron every 5 s), when each wall is hit, monitoring, backups you can actually restore, free tools from the open to-do list (Dependabot, secret scanning, UptimeRobot, Turnstile). **Nothing paid, ever.**
25. **Growth and retention expert.** Free channels only. What brings friends in, what makes week 3 stick, the What's new and tour system, the share cards.
26. **AI / machine learning expert.** Every on-device model and smart feature: the MediaPipe face blur in the gym scan (accuracy, missed faces, the ~15 MB download, what happens when it fails), any detection or auto-fill logic. Also where free, on-device AI could help without sending data anywhere or costing money, and where it shouldn't be used. If any LLM call is ever proposed: prompt injection, usage caps, and privacy.
27. **AI slop expert.** Hunts for anything that looks, reads or is built like it was generated by AI. Visual: purple block buttons, floating rounded cards in empty space, generic round icon chips, gradients, pills everywhere, the same layout as every other app (see `~/.claude/anti-slop.md`). Copy: stock words, "not X but Y", forced lists of three, filler (use the humanizer skill). Code: dead code, needless wrappers, duplicated helpers, comments that narrate, over-engineering. Every finding includes what a human designer or developer would have done instead, with a mockup or patch.
28. **Devil's advocate / verifier.** Gets every finding from every expert and tries to disprove it, with a fresh look at the code or a fresh screenshot. Findings that can't be reproduced are dropped or marked "unconfirmed".

## Hard rules for every expert (from Job)

Never suggest: calorie or protein tracking; plateau alerts or advice to change weight/reps; exercise pictures; anything that pauses music; a welcome screen; a demo account; Google sign-in or email codes; lime green; nagging about measurements or photos; paid services, domains or APIs; a native app; haptics or Dynamic Island (not possible from a website). Sign-in stays email + password. Signed-out screens stay Agent. Keep the solid status bar. A design for one theme changes only that theme. Every new feature needs a line in What's new, the intro and the tour.

## Teamwork

1. **Solo pass.** Each expert reviews alone and writes their raw findings.
2. **Cross-review.** Experts read each other's findings. Where they clash (security vs. convenience, performance vs. art, legal vs. growth), the two experts write one shared recommendation, and the lead decides if they can't agree.
3. **Verification.** The devil's advocate checks every finding. Anything not reproduced in code or on screen is dropped or marked "unconfirmed".
4. **Synthesis.** The lead merges duplicates, ranks everything, and writes the plan.

## What to deliver, all in `docs/review-2/`

- `REPORT.md`, the main report:
  - **Top 15**: the problems that matter most, any field, with one line each on why.
  - **Every finding**, grouped by area (Today, Workout, Rest timer, Plate loader, Finish/recap, Progress, Friends/posts/stories, Story camera, Me/settings, Intro, Sign-in, Backend, Edge functions, Build/hosting, Legal, Copyright). Each finding includes:
    - severity: **Broken**, **Bad**, **Annoying** or **Nitpick**
    - which expert(s) found it
    - where: `file:line`, screen, theme
    - how to see it: steps or a screenshot
    - what's wrong, and why it matters to a real user
    - the fix, linked to its patch or mockup
    - confirmed or "from the code, needs iPhone"
  - **Disagreements**: what the experts argued about and what the lead decided.
  - **Redesign proposals**: each screen with before/after screenshots in all four themes and a short note on what changed and why.
  - **Plan**: fixes in the order to ship them. Small batches, each one a version bump that's safe on its own. Batches that touch user data go last and need a security check.
  - **What this review couldn't cover.**
- `mockups/`: the HTML drafts. `shots/`: the screenshots. `patches/`: the proposed code and SQL.

## After the report: act on it

The draft-only rule covers the review. When `REPORT.md` is done, switch to fixing:

1. **Go through the feedback in good faith.** Take each finding as help, not criticism, and answer it in `docs/review-2/RESPONSES.md`: "Doing it" (which batch) or "Not doing it" with the reason (usually a rule from `CLAUDE.md`). Don't argue a finding away because it means more work.
2. **Fix in the plan's order, one batch at a time,** on a new branch from main (never on main). For each batch: make the change, bump the service worker version, build with esbuild, run every check in `tests/` and add the new ones the QA engineer asked for. Screenshot the result in all four themes with long content and the owner path. Add new features to What's new, the intro and the tour. Commit.
3. **Redesigns:** build the mockups the lead approved, matching the before/after shots. Change one theme only when the mockup was for one theme.
4. **Backend:** apply SQL and edge function changes only as files in the repo. Running anything on the live Supabase project, merging to main, or deploying needs Job's yes first. Ask once per batch, with screenshots, in a short message he can read on his phone.
5. **Keep going until every "Doing it" item is done or blocked.** Mark each one in `RESPONSES.md` as it lands (done, commit hash) or as blocked (why, what's needed).

Write the report in plain, short sentences. Job reads on a phone. No filler, and no praise unless it explains what to keep. When something is fine, leave it out. Don't stop early: walk every screen and every function before writing the report.
