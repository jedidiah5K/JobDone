# Front-end group: findings

Experts: #2 Frontend engineer, #10 Reliability / offline, #21 Data and sync integrity, #22 QA / test engineer, #23 Architecture / maintainability.

Reviewed app.js (v134, 5,455 lines), web-src/sw.js, build.py and tests/ on branch `claude/expert-review`. All six tests in tests/ pass today. The offline copy ran in Chromium at 390×844. Sync bugs were reproduced with a fake cloud database put in place from the console (same `doc().get/set/delete` and `collection().get` shape as `supaDB()`, 200 ms delay, a switch to go offline).

Patches are in `docs/review-2/patches/front-0N-*.patch`. Each one passes `git apply --check` against this branch. All app patches applied together pass `node --check`. Patches 01, 05 and 06 were also loaded into the running app and the failing case was re-run. They fixed it.

## Top 10

1. **Broken.** A workout finished with no signal is wiped when the app comes back online. Local copy, saved copy and cloud all lose it, and the old half-done workout comes back as "in progress". (F1)
2. **Broken.** Sign out throws away sets that haven't synced yet. (F2)
3. **Broken.** A fast double tap on ✓ logs the set and then un-logs it. Double-tapping Add set adds two sets. The double-tap guard never works after a re-render. (F3)
4. **Broken.** Restoring a bad JSON file blanks the app on every launch. In the hosted app it also uploads the bad data. (F4)
5. **Bad.** The rest timer disappears when iOS kills the app in the background, or after tapping Update. (F5)
6. **Bad.** A JSON backup restore drops machine setup notes and measurements, then deletes them from the account. (F6)
7. **Bad.** CSV export drops set types and RPE. Re-importing turns warm-ups into working sets: volume went from 1,600 to 2,080 kg in the test. (F7)
8. **Bad.** After signing out, the next account on the same phone sees the last account's ID photo, friend code, gym list and hidden posts. (F8)
9. **Bad.** Every time the phone is unlocked, the app downloads the user's whole workout history. (F9)
10. **Bad.** Swiping right on a set that's already logged un-logs it, with no undo. (F10)

**Count: 4 Broken, 9 Bad (2 of them still open from REVIEW.md), 9 Annoying, 4 Nitpick (26).**

---

## Workout

### F3. Double tap un-logs a set; Add set doubles (Broken)
- Experts: #2, #22
- Where: app.js:4952–4958 (click handler), app.js:2703–2726 (`renderWorkout`), app.js:3006 (`logSet`). Workout screen, every theme.
- How to see it: start a workout. Tap ✓ on a set twice within about 120 ms. The set ends up not done, but the rest timer still runs. Double-tap "Add set" and you get two new sets. Reproduced in the browser: `done:false, rest:true`, and sets went from 3 to 5.
- What's wrong: the guard is `el === tapEl`. Every tap calls `touchA()` → `renderWorkout()`, which rebuilds `#wk` with `innerHTML`. So the second tap lands on a new button node and the guard never matches. `logSet` toggles, so the second tap undoes the first. A sweaty double tap is common between sets, and the user loses the set without seeing why. A rest push for that set is also still on its way.
- Fix: compare what the button does, not the node: `key = JSON.stringify({...el.dataset})`. Patch: [front-03-double-tap-guard.patch](../patches/front-03-double-tap-guard.patch). The same patch also covers F10.
- Confirmed (browser).

### F10. Swipe right on a logged set un-logs it (Bad)
- Experts: #2, #13 (overlap)
- Where: app.js:5034.
- How to see it: in a workout, swipe a done row to the right by 70 px or more.
- What's wrong: the gesture is "swipe right to log", but it calls `logSet`, which toggles. A sideways drag while scrolling with a sweaty thumb un-logs a finished set silently. There's no toast and no undo, unlike delete.
- Fix: only log when the set isn't done (in patch 03).
- From the code, needs iPhone for the gesture feel.

### F5. Rest timer lost on reload (Bad)
- Experts: #10, #2
- Where: app.js:175 (`REST` is a plain variable), app.js:190 (`lsSave` doesn't save it), app.js:543 (Update bar reloads).
- How to see it: log a set so rest starts, then reload. The workout comes back with `REST: null`. Reproduced in the browser.
- What's wrong: iOS often kills a Home Screen app while the user is in Music or Instagram between sets, and the Update bar also reloads. The rest countdown on screen is gone, but the server push for it still comes. The user doesn't know how long they've rested.
- Fix: keep REST in its own small key (`LS_KEY + ':rest'`) on every `renderWorkout`, and load it back with the cached state if it hasn't ended. Patch: [front-04-rest-survives-reload.patch](../patches/front-04-rest-survives-reload.patch).
- Confirmed (browser) for the loss. The iOS kill itself is "from the code, needs iPhone".

### F18. "Today" label is wrong after midnight (Nitpick)
- Experts: #21
- Where: app.js:2716 (header), app.js:2676–2681 (`openWkDay`).
- What's wrong: a workout started at 23:40 and still open at 00:20 says "Today ▾". The day sheet marks "Today" as picked, and picking it deletes `A.date`, which saves the workout under yesterday (the start date). The saved date is right, but the label isn't. Night trainers in UTC+8 hit this. Today's own screen also doesn't move to the new date at midnight until something re-renders.
- Fix: label by `ymd(new Date(A.start))` vs `today()` ("Yesterday ▾" when they differ).
- From the code.

## Sync and offline

### F1. Offline workout wiped when the phone comes back online (Broken)
- Experts: #10, #21, #2
- Where: app.js:4990–4993 (visibility handler calls `loadCloud`), app.js:255–271 (`loadCloud` replaces `S` and maybe `A`), app.js:210 (the other visibility handler that retries pending writes).
- How to see it (reproduced): fake cloud, finish a workout while it's offline, and wait for the 3 retries to fail. At that point `pend` = `months/2026-11, jd/active` and `dirty` is empty. Go online and fire `visibilitychange`. Result: `S.workouts` drops from 1 to 0, `A` is the stale cloud workout again, localStorage has 0 workouts, cloud has no month doc, and `pend` is empty. The workout is gone for good.
- What's wrong: the resume handler only checks `dirty` and `inflight`. A failed write is moved out of `dirty` and lives only in `pend()`. So `loadCloud` runs, `S = ns` overwrites the local workouts with the older cloud copy, and `lsSave()` writes that over the saved copy. Half a second later `retrySoon` sends the *cloud's* version back and clears `pend`. The same race can also hit:
  - edits made during the startup `connect()` load (openData renders the cached state, then awaits `loadCloud`), and
  - an offline cold start where uploading pending writes failed (mode stays `cloud`, so the next resume takes the same path).
- Why it matters: the gym is where the signal is worst. This is the "I lost my workout" moment that makes people quit.
- Fix: in `loadCloud`, keep the local version of every path still in `pend`, `dirty` or `inflight` (for meta, weights, steps, each month, and the active workout). Also skip the resume refresh while `pend()` has anything. Patch: [front-01-loadcloud-keeps-pending.patch](../patches/front-01-loadcloud-keeps-pending.patch). With the patch the same run ends with 1 local workout, the month doc in the cloud, `jd/active` null and `pend` empty.
- Confirmed (browser, fake cloud).

### F2. Sign out deletes unsynced sets (Broken)
- Experts: #10, #21
- Where: app.js:4843 (`signOut`), app.js:219 (`flushNow`).
- How to see it: log a weigh-in while offline, let the write fail, come back online and call `flushNow()`. `pend` still holds `jd/weights` and the cloud still has the old value (reproduced). Sign out then runs `localStorage.removeItem(LS_KEY)`.
- What's wrong:
  - `flushNow` only sends `dirty`, not `pend()`, and `writeDoc` never throws, so sign out can't tell that nothing was sent. The local copy is deleted and the unsynced sets are lost. The sheet says "Your data stays in your account", which is false here.
  - Offline, supabase-js `signOut()` returns an error and doesn't sign out (checked in web-src/vendor/supabase.js `_signOut`). So the button seems to do nothing, while the saved copy is already deleted. If the app is killed before the next save, the data is gone.
- Fix: push `pend()` into `dirty`, flush, and refuse to sign out while anything is left ("Some of your training hasn't synced yet. Get signal, then sign out."). Check the `signOut` error. Then clear all per-account keys and reload. Patch: [front-02-signout-unsynced.patch](../patches/front-02-signout-unsynced.patch). This also fixes F8.
- Confirmed for `flushNow` (browser). The sign-out call itself is from the code (no Supabase in the offline copy).

### F9. Every unlock downloads the whole history (Bad)
- Experts: #10, #9 (overlap)
- Where: app.js:4990–4993, app.js:256 (`DB.collection('months').get()` fetches every month's body).
- What's wrong: each time the app comes to the front with nothing pending, it runs four doc reads plus every month doc. A lifter unlocks the phone 20+ times a workout. With two years of history (~1 MB) that's about 20 MB of Supabase egress per workout per user, against 5 GB free egress a month. It also opens the F1 race every time.
- Fix: refresh at most every 10 minutes. Better: read only `path, updated_at` first and fetch the docs that changed (`updated_at` is already written in `supaDB().set`).
- From the code.

### Still open from REVIEW.md #5 / #136 / #137 (Bad)
Writes are still whole documents with no `updated_at` check (app.js:1177). Two devices open at once still overwrite each other's month or `jd/meta`. One new sharp edge: renaming a split (app.js:4961, on change) rewrites *every* month doc from this device, so a stale iPad renaming "Push" can wipe the phone's workouts in every month. Fix as REVIEW.md said: send the `updated_at` you loaded and reject the write if the row is newer, then merge per workout id.

### F11. `lsSave` hides a full storage (Annoying)
- Experts: #10
- Where: app.js:190, 198.
- What's wrong: `localStorage.setItem` errors are swallowed. If Safari's ~5 MB is full (history plus the ID photo in `jd-idphoto`), every save fails silently. Offline sets then live only in memory.
- Fix: on a quota error, toast once ("This phone is out of space for Job's Done. Get signal so your sets reach your account.") and report it through `reportError`.
- From the code.

### F12. Auto-post is lost when offline (Annoying)
- Experts: #10
- Where: app.js:3078, 1722–1731.
- What's wrong: with "Post every workout" on, `stampPost` runs once at save time. With no signal it shows "Couldn't send it" and never retries, so friends never see that workout.
- Fix: keep the workout id in `UI.stampPending` and retry on `online` and on resume.
- From the code.

## Import, export, backup

### F4. A bad JSON backup blanks the app for good (Broken)
- Experts: #21, #2, #22
- Where: app.js:4494–4499 (`stateFromBackup` checks only that `workouts` is an object), app.js:4483 (`finishImport` saves before rendering), app.js:671 (`render` rethrows a Today crash).
- How to see it (reproduced): restore `{"workouts":{"a":{"date":"2024-01-04","exercises":[]}}}`. `finishImport` saves it, then `ix()` throws "ex is not iterable". After a reload the screen is blank, every time. Screenshot: [front-01-blank-after-bad-restore.png](../shots/front-01-blank-after-bad-restore.png).
- What's wrong: there's no shape check, and Today has no fallback. In the hosted app `persist(...allPaths())` also uploads the bad state, so every device signed in to that account goes blank. Picking the wrong file (another app's export) is enough.
- Fix: keep only workouts with a `YYYY-MM-DD` date and an `ex` array whose items have `name` and a `sets` array. Reject an array `workouts`. Patch: [front-05-backup-restore-safe.patch](../patches/front-05-backup-restore-safe.patch). Also worth having: when Today fails to render, show "Something in your log can't be shown" with Export and Restore buttons instead of a blank screen.
- Confirmed (browser).

### F6. JSON restore drops setup notes and measurements (Bad)
- Experts: #21
- Where: app.js:4496.
- How to see it (reproduced): with `S.setup` and `S.meas` set, export JSON and restore it. `setup` comes back `{}` and `meas` is missing. "Replace everything" then writes `jd/meta` without them, so they're deleted from the account.
- What's wrong: the key list copies profile, splits, rotation, customEx, weights, steps and workouts, but not `setup` or `meas`. The export (`{...S}`) includes both.
- Fix: add `setup` and `meas` (in patch 05).
- Confirmed (browser).

### F7. CSV export loses set types and RPE (Bad)
- Experts: #21, #19 (overlap)
- Where: app.js:4749–4756 (`exportCSV`).
- How to see it (reproduced): a workout with warm-up 40×12, work 100×8 @9 and drop 80×10 exports and re-imports as three working sets with no RPE. Volume goes from 1,600 to 2,080 kg, which also changes PRs. The workout note, energy, start and end times are also dropped.
- What's wrong: the header has no `set_type` or `rpe` column, though the importer already reads `set_type`. Trap: the importer treats any type starting with "w" as a warm-up, so writing "work" would turn every working set into a warm-up.
- Fix: add `set_type` (`warmup`/`dropset`/`failure`, blank for work) and `rpe`, and read `rpe` back. Patch: [front-06-csv-keeps-set-types.patch](../patches/front-06-csv-keeps-set-types.patch).
- Confirmed (browser).

### F13. Two CSV import paths with different rules (Bad)
- Experts: #23, #21
- Where: app.js:4721 (`importCSVFile`, merges and keeps set types), app.js:4503–4516 (`restoreFile` with a CSV runs `buildFromLog` via `logFromCsvList`), app.js:4437–4455.
- What's wrong: Me → "Replace everything" with a CSV goes through `buildFromLog`, which:
  - throws away the set types it just parsed (`t: 'work'`),
  - starts from `freshState()`, so theme, rep range, ID card, sharing settings, every body weight and all steps are wiped,
  - hard-codes Job's own split order and a `['Push', 'Pull']` rotation. An Upper/Lower Strong user ends up with no rotation.
- Fix: route both through `csvToWorkouts` plus the `importCSVFile` merge. Use "replace" only to clear workouts, and keep the profile, weights and steps.
- From the code.

### F14. Strong/Hevy CSV edge cases (Annoying, unconfirmed)
- Experts: #21
- Where: app.js:4705–4706, 4713.
- What's wrong:
  - Hevy's `start_time` looks like "4 Jan 2024, 18:13". It isn't ISO, so it goes to `Date.parse`. Safari's parser is stricter than Chrome's and may return NaN, which skips every row (preview shows "0 new workouts").
  - Strong's "Weight" column is in the user's own unit. A pounds user's file imports 2.2× too heavy. Only a small caption says "Weights are read as kg".
  - Two Strong workouts with the same name on the same day merge into one.
- Fix: parse `D Mon YYYY, HH:MM` by hand. Ask "Is this file in kg or lb?" when only a "weight" column exists.
- Unconfirmed: needs a real Hevy file on an iPhone.

### F19. A JSON restore copies the owner flag (Nitpick)
- Experts: #21, #5 (overlap)
- Where: app.js:4496 (`Object.assign(st.profile, o.profile)`).
- What's wrong: restoring Job's backup (or one where `owner`/`legacy` is set) into another account turns on owner-only code there: the feedback inbox button, lift renames and plates-only loading.
- Fix: `delete st.profile.owner; delete st.profile.legacy;` unless `USER.id` matches the backup's owner.
- From the code.

## Accounts and friends (client side)

### F8. The next account on the phone sees the last one's photo and code (Bad)
- Experts: #2, #6 (overlap)
- Where: app.js:1343–1345 (ID photo and code read once at script start), app.js:744 (`jd-gym`), app.js:1791 (`jd-hidepost`), app.js:5358 (SIGNED_OUT doesn't reset them), app.js:5063–5077 (delete account leaves `jd-idphoto`).
- What's wrong: `jd-idphoto`, `jd-idcode`, `jd-gym` and `jd-hidepost` aren't per account, and sign out doesn't reload the page. When person B signs in on a shared phone:
  - B's ID card shows A's photo and A's friend code until B's own card syncs, and stays that way if B has no card row yet (`idFetched` is already true from A's session),
  - `FRIENDS`, `FEED`, `ID_SENT` and `STAT_SENT` keep A's values in memory.
  B could hand out A's friend code, or share an ID card with A's face. Deleting an account also leaves the photo on the phone.
- Fix: patch 02 clears these keys and reloads after sign out. Delete account should do the same.
- From the code.

### F15. Friends abroad show "Nothing yet today" after they trained (Annoying)
- Experts: #21, #20 (overlap)
- Where: app.js:1448–1455 (`myStat` uses the poster's local date), app.js:1462–1471 (`frStatus` compares it with the viewer's `today()`).
- What's wrong: a friend in UTC−5 who trained this morning (their time) shows "Nothing yet today" with a Nudge button to a UTC+8 viewer for most of the day. `frWeek` breaks the same way on Monday mornings, and the shared streak can drop a week.
- Fix: send the poster's UTC offset with the stat. Show "Trained · Push" when the stat's day is the poster's today, or "Trained yesterday" by their clock.
- From the code.

## Story camera

### F16. Camera stays on after Cancel during the selfie start (Annoying)
- Experts: #2
- Where: app.js:1655–1657 (`open` assigns `st` after `await getUserMedia`), app.js:1689–1694.
- What's wrong: tap Cancel while the front camera is still starting (about 0.5–1 s on an iPhone). `close()` runs `stop()` while `st` is still null. When `getUserMedia` resolves, the new stream is never stopped, so the green camera dot stays on until the app is killed.
- Fix: in `open`, after the await, `if (!ov.isConnected) { s.getTracks().forEach(t => t.stop()); return; }`.
- From the code, needs iPhone.

### F17. `roundRect` has no fallback (Annoying)
- Experts: #2
- Where: app.js:1663 and 4 more uses (share cards).
- What's wrong: `CanvasRenderingContext2D.roundRect` arrived in Safari 16.4. On iOS 16.0–16.3 `compose()` throws inside `review()` before any button is wired, so the story review screen is stuck with dead buttons (Cancel included). Share cards that use it also fail. The build targets `safari15`, but esbuild doesn't add browser APIs.
- Fix: a 6-line `roundRect` fallback (`arcTo` path) at the top of app.js, or draw the inset with `arcTo` directly.
- From the code, needs an iPhone on iOS 16.0–16.3.

## Service worker and build

### F20. Service worker caches error responses for good (Annoying)
- Experts: #10
- Where: web-src/sw.js:24.
- What's wrong: non-page files are cache-first, and the fetch result is stored without checking `res.ok`. One 404 or 500 for `ex/index.json`, `ex/body.json` or a font while Vercel is deploying gets saved, and is served until the next version bump. How-to cards and the muscle map then break on that phone.
- Fix: `if (res.ok) caches.open(CACHE).then(x => x.put(e.request, c));`.
- From the code.

### F21. build.py fails on Windows without PYTHONUTF8 (Annoying)
- Experts: #23
- Where: build.py:8–9, 33, 44, 46 (`open()` with no encoding).
- How to see it: `PYTHONUTF8=0 python -c "open('app.js').read()"` fails with `'charmap' codec can't decode byte 0x9d` (run on this PC). The build steps in CLAUDE.md don't mention PYTHONUTF8; only the panel brief does. A fresh agent following CLAUDE.md fails the build.
- Fix: `encoding='utf-8'` on every open. Patch: [front-07-build-utf8.patch](../patches/front-07-build-utf8.patch).
- Confirmed.

### F22. Crash notes report a version from October (Nitpick)
- Experts: #23, #22
- Where: app.js:116 (`APP_VER = '2026.10.17'`), app.js:5347.
- What's wrong: every error row in `jobdone_errors` says 2026.10.17, while the app is v134. You can't tell whether a crash is from before or after a fix.
- Fix: have build.py write the sw.js `CACHE` version into `APP_VER`.
- From the code.

## Architecture and maintainability

### F23. Four whole-page MutationObservers, two doing the same job (Annoying)
- Experts: #23, #9 (overlap)
- Where: app.js:529 (switch labels), app.js:2382 (how-to hydrate), app.js:5413 (button titles), app.js:5455 (day-first dates). Also `labelIcons()` at app.js:684, called from `render` and `openSheet`, does the same job as 5413.
- What's wrong: each observer watches `documentElement` with `subtree: true`, and three of them run `querySelectorAll` over the whole page on every change. During a workout the 500 ms `tick` changes text and redraws the hourglass, so all of them run about twice a second for 75 minutes. Battery cost, and four places to look when something goes wrong.
- Fix: delete the 5413 observer (`labelIcons` covers it). Run the rest from `render()` and `openSheet()` on the new root only.
- From the code.

### F24. Dead plateau code still holds banned advice (Nitpick)
- Experts: #23, #27 (overlap)
- Where: app.js:3589–3611 (`plateaus()` starts with `return [];` and 15 dead lines follow), app.js:3606 (`plateauTip`: "Try a lighter week…"), app.js:2908 (glossary "A lighter week or a new rep range usually gets it moving again"), app.js:2758 (still called for every exercise card on every render), app.js:4669 (`pf.plateau`).
- What's wrong: CLAUDE.md bans plateau alerts and change-your-weight advice. A fresh agent who sees an unreachable `return` will "fix" it and ship banned advice.
- Fix: delete `plateaus`, `plateauTip`, `plateauCard`, the glossary entry, the `pl-line` in `exCardHTML`, `UI.plHide`, the `plHide` action and the intro pref.
- From the code.

### F25. Still open from REVIEW.md #123 / #125 / #128 (Bad)
- One 560 KB file with global state. 27 top-level `S.profile` migrations run inside `render()` (app.js:647–660) on every render, and each one calls `persist('jd/meta')`.
- Tests now cover PRs, renames, fuzzy search, the gym, the ID card and "all calls defined". Nothing covers sync, import/export, volume, plate maths or rotation, which is where F1, F2, F4, F6 and F7 live.
- Smallest split that would have prevented this review's Broken findings: move `// ---------- storage ----------` to the rename block (app.js:188–271) into a plain `sync.js` with no DOM. Tests can then load it the way pr_check.js does. Move the one-time migrations out of `render()` into a `migrate(S)` that runs once after load.

---

## Proposed new tests

One new file covers the Broken and Bad data-loss items. It's [front-08-test-sync-check.patch](../patches/front-08-test-sync-check.patch), which adds `tests/sync_check.js`. It uses the same "slice the source and run it" style as pr_check.js. It **fails on today's app.js** ("a workout finished offline survives a cloud load") and **passes with patches 01–06 applied**. Run on this PC.

| Finding | Check in tests/sync_check.js |
|---|---|
| F1 | Cloud holds an old month and a stale `jd/active`. Local has today's workout, pending. After `loadCloud()`, today's workout is still in `S` and `A` stays null. |
| F3 | `app.js` doesn't contain `el === tapEl` (a guard that compares DOM nodes can't survive `renderWorkout`). |
| F4 | `stateFromBackup` given a workout with `exercises` and no `ex` keeps no workouts. |
| F6 | `stateFromBackup` keeps `setup` and `meas`. |
| F7 | `exportCSV` then `csvToWorkouts` gives back warm, work, drop. |

Not in the file, because they need Supabase or a DOM. Add them when `sync.js` is split out (F25):
- **F2**: with `pend()` non-empty and every write failing, sign out must not call `localStorage.removeItem(LS_KEY)`. Stub `SB.auth.signOut` and assert it was never called.
- **F5**: after `logSet`, the saved state has a rest end time, and loading it back gives a non-null `REST`.

No CI change is needed: `.github/workflows/checks.yml` already runs every `tests/*.js`.

## Patches

| Patch | Fixes |
|---|---|
| front-01-loadcloud-keeps-pending.patch | F1 (also the startup-load race) |
| front-02-signout-unsynced.patch | F2, F8 |
| front-03-double-tap-guard.patch | F3, F10 |
| front-04-rest-survives-reload.patch | F5 |
| front-05-backup-restore-safe.patch | F4, F6 |
| front-06-csv-keeps-set-types.patch | F7 |
| front-07-build-utf8.patch | F21 |
| front-08-test-sync-check.patch | new test for F1, F3, F4, F6, F7 |

Patches 01, 02 and 06 touch user data. Per the brief, they go in the last batch with a security check. Patches 03 and 04 are safe on their own.
