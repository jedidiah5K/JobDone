# Team 1 responses: data safety and speed

Branch `worktree-agent-a2ec3bf58968bcf8c`, based on `claude/expert-review` (259404b). Built output in `web/` is not committed. No service worker version bump.

| Finding | Status | Commit |
|---|---|---|
| F1 Offline workout wiped on reconnect (front-01) | Done | 363cc84 |
| F2 Sign-out deletes unsynced sets (front-02) | Done. Retries pending writes, stays signed in if anything is left, checks the signOut error | f25be15 |
| F8 / back B11 Next account sees the last one's photo, code, gym list, hidden posts; push stays subscribed | Done. Sign-out unsubscribes this phone's push (server and browser), clears per-account and shared keys, reloads. Delete account clears the same. Any other SIGNED_OUT clears shared keys and memory caches but keeps the saved log | f25be15 |
| F4 Bad backup blanks the app (front-05) | Done, plus: wrong-shaped files and files whose workouts are all unreadable are refused | cf52b45, ed8feef |
| F6 Restore drops setup notes and measurements (front-05) | Done | cf52b45 |
| F19 Restore copies the owner flag | Done (owner/legacy kept only when restoring into the owner's account) | cf52b45 |
| F5 Rest timer lost on reload (front-04) | Done | cc07f82 |
| F7 CSV loses set types and RPE (front-06) | Done | 539c687 |
| F13 Replace everything with a CSV wipes settings, weights, steps, forces Push/Pull | Done. Only workouts are replaced; set types kept; a file's splits keep their own order and get a rotation | 104eb71 |
| F21 build.py needs PYTHONUTF8 (front-07) | Done (built with PYTHONUTF8=0 to check) | 0a07d69 |
| front-08 new tests/sync_check.js | Done, extended with CSV replace, backup shape, owner flag and full-storage checks. Fails on the old app.js | 91e3481 (+ later commits) |
| P6 Set logging cost (perf-02) | Done | 3f8bee5 |
| P2 Friends tab refetch (perf-04) | Done (2-minute reuse; avatars fall back to the friends list). perf-07 SQL not run (live database) | 5e9e52f |
| P3 / F9 Resume reloads the whole account (perf-06) | Done. Stamp read before the docs; a delete alone doesn't move the stamp (marked ponytail) | 09efcd6 |
| F24 Dead plateau code and lighter-week advice | Done in app.js. The now-unused `.pl-line` rule in styles.css is left for the CSS owners | fd2b6bd |
| F11 / P9 Full localStorage fails silently | Done. Drops the gym cache and retries, always keeps the workout in progress, one toast and one error report | 737ab00 |
| F20 Service worker caches error responses | Done (sw.js only checks `res.ok`; no version bump) | 6a8aa04 |
| perf-03 Service worker cache-first | Not done, on purpose: stays network-first | |
| F3 / F10 double tap | Already fixed in batch 1 | |
| Two-device overwrite (REVIEW.md #5/#136/#137), F12 auto-post retry, F14 Hevy dates, F15 time zones, F16-F18, F22, F23, F25 | Not in Team 1's scope | |

## How it was checked
- All `node tests/*.js` pass. `sync_check.js` fails on the original app.js (offline workout lost) and on the pre-F11 app.js (no full-storage toast).
- Offline build served on port 8031 with an empty config.js, driven with playwright-cli at 390x844, with a fake cloud DB that can go offline:
  - F1: workout finished offline, then online + resume: workout kept locally and in localStorage, month doc reached the cloud, jd/active null, nothing pending.
  - F5 / perf-02: set logged, page reloaded: set still done, rest timer back at 1:58 and on screen.
  - F2: sign-out with an unsynced weigh-in while offline: toast, signOut never called, saved copy kept. Online: signed out, every per-account key and jd-idphoto/idcode/gym/hidepost removed.
  - F4/F6/F19, F7, F13, quota, perf-04, perf-06 (3 resumes, 2 full loads) and the owner path (`S.profile.owner = true`, Today and Me render) all checked in the browser.
- Not checked: real Supabase sign-out and push unsubscribe (no backend offline), real iPhone storage limits.
