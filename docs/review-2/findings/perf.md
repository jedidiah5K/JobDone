# Performance findings (expert #9, plus the performance side of #10)

Reviewed v134, branch `claude/expert-review`. Measured on the offline copy (empty `config.js`) in headless Chrome at 390×844, 3× DPR, mobile and touch on. The page was served gzipped by a small local server, so the bytes on the wire match Vercel's gzip. "4× CPU" means Chrome's CPU throttling, which is roughly a mid-range phone. An iPhone 13–16 sits between 1× and 4×.

Lighthouse: not run. `npx lighthouse` isn't installed, and the brief says not to install it. The same numbers came from Chrome's own metrics (paint timing, long tasks, `Performance.getMetrics`).

Scripts used are in the scratchpad (`perf.js`, `perf2.js`, `perf3.js`, `verify.js`). The test data: 500 workouts, 8 lifts × 4 sets each, then a live workout of 8 lifts × 5 sets.

## Top 10

1. **Bad.** The rest timer's hourglass keeps the phone busy for the whole rest. Main thread 49–86% busy at 4× CPU, 144 style recalcs a second. Patch 01 drops it to 8%.
2. **Bad.** Every tap on the Friends tab downloads all friends and the whole feed again, with every photo inline. Each post also carries its author's ID photo again. With 10 friends and 20 posts that's 5.3 MB per tap. Patches 04 + 07.
3. **Bad.** Every time the phone is unlocked, the app downloads the whole account again: every month of history, 5 requests, then a full re-render. That's 1.1 MB of JSON at 500 workouts, and it happens between sets too. Patch 06.
4. **Bad.** First paint on slow 3G takes 8.9 s (fast 3G 2.7 s). Nothing shows until the whole 758 KB page (236 KB gzipped) has arrived and run. Still open from REVIEW.md #131.
5. **Annoying.** The service worker waits up to 2.5 s for the network on every launch before it opens the saved copy. Every install also downloads the page twice (`./` and `index.html`). Patch 03.
6. **Annoying.** Logging a set takes 87–106 ms at 4× CPU (median). Two causes: the workout HTML is parsed twice, and the whole 1.1 MB history is written to localStorage on every tap. Patch 02 brings it to 58 ms.
7. **Annoying.** 173 KB of wallpaper art is inlined in the CSS (54% of all CSS). 63 KB of it is written twice, and every theme's art downloads even though you see one. Patch 05 saves 62 KB raw and 19 KB gzipped. Still open from REVIEW.md #132.
8. **Annoying.** About 200 KB of the 433 KB script is for screens that aren't on the first view: share cards, intro, ID card, My Gym, sign-in, plate loader, camera. All of it is parsed on every launch.
9. **Annoying.** localStorage holds the whole history: 1.1 MB at 500 workouts. iOS gives about 5 MB, so around 2,000 workouts the save fails silently and the offline copy goes stale.
10. **Nitpick.** The rest-done sound and toast play late. Come back 3 minutes after a rest ended and it beeps right then. The timer itself stays accurate when the phone sleeps.

**Count:** Broken 0 · Bad 4 · Annoying 5 · Nitpick 7.

## Measurements

| What | Number |
|---|---|
| `web/index.html` | 758 KB raw, 236 KB gzip. Inline CSS 320 KB (89 KB gz), inline JS 433 KB (146 KB gz) |
| Plus on first load | `vendor/supabase.js` 111 KB, blocking, in `<head>`. `config.js` |
| Slow 3G (2 s RTT, 50 KB/s) + 4× CPU, cold | FCP 8,856 ms · DOMContentLoaded 8,753 ms · 261 KB on the wire · 2 long tasks (longest 115 ms) |
| Fast 3G + 4× CPU, cold | FCP 2,656 ms · 280 KB on the wire |
| No throttling, 4× CPU | FCP 336 ms · longest task 121 ms |
| No throttling, 1× CPU | FCP 124 ms · no long tasks |
| Main-thread time to boot (4× CPU) | Script 48 ms, layout 122 ms, total tasks 321 ms |
| Data URIs in CSS | 22 images, 173 KB. Skyline wallpaper (40 KB) and chalk wall (23 KB) each appear twice |
| Code for screens not on first view | Share/recap/month cards 58 KB · intro/tour/what's new 38 KB · ID card 32 KB · My Gym 30 KB · sign-in/MFA 15 KB · plate loader/keypad 15 KB · friends 15 KB · camera/posts 14 KB (unminified source) |
| CSS by theme | Shared 203 KB · Skyline 85 KB (80 KB is the doubled wallpaper) · Boulder 27 KB · Summit 13 KB · Agent 9 KB |
| Log one set (8×5 workout, 500 in history, 4× CPU) | Median 87–106 ms, p90 100–129 ms. **After patch 02: median 58 ms, p90 71 ms** |
| `renderWorkout()` alone | 43 ms (4× CPU) |
| `lsSave()` alone | 15–29 ms. Writes 1,096 KB each time |
| DOM nodes after that workout | 1,189 in total, 929 inside `#wk` |
| Rest running, popup or pill (4× CPU) | Main thread **49–86% busy**, 144 style recalcs/s. **After patch 01: 8%** |
| Today screen idle, all 4 themes | 0% busy, no running animations (good) |
| Workout open, no rest | 1% busy |
| Tab switch with 500 workouts | Progress 23 ms, Me 21 ms, Today 42 ms |
| `ix()` rebuild with 500 workouts | 12.8 ms |
| Unlock reload (`loadCloud`) at 500 workouts | 24 month docs + 4 others, 1,097 KB JSON (43 KB gzipped, but test data repeats; real logs compress less) |
| Post photo (`postPhoto` → `jpegFit`) | 720×900 JPEG, capped at 110 KB base64 (about 80 KB of image). A detailed photo needed quality 0.5 (q 0.8 = 232 KB). Encode loop 144–164 ms at 4× CPU |
| Feed payload, 20 posts with photos | 4.2 MB (photo + repeated author photo per row) |
| Friends list payload, 10 friends | 1.05 MB (an ID photo each) |
| First feed render, 20 photo posts | 335 ms at 4× CPU. Re-render 106 ms |

## Findings

### P1. The hourglass repaints 60–120 times a second for the whole rest
- **Bad** · `styles.css:298` (`.hg-stream … animation: stream .5s linear infinite`), `app.js:3003` (`tick` rebuilds the SVG). Rest popup and rest pill, all themes. Confirmed in Chrome. The battery effect needs an iPhone to confirm.
- **Measured:** with a rest running, the main thread is 49–86% busy at 4× CPU and does 144 style recalcs a second. The only running animation is `stream@hg-stream (infinite)`. With no rest it's 1%.
- **Why it matters:** rest is most of a workout. A 75-minute session with 5-minute rests means about an hour of non-stop repainting while the screen is held on by the wake lock. `stroke-dashoffset` can't run on the GPU, so the CPU does every frame (120 a second on ProMotion iPhones). On top of that, `tick()` throws away and rebuilds the hourglass SVG twice a second.
- **Fix:** [patches/perf-01-hourglass-stream.patch](../patches/perf-01-hourglass-stream.patch). The stream steps (`steps(2)`, so 4 repaints a second, and the dashes still visibly fall). It turns off under Reduce Motion. `tick` moves the two sand rectangles instead of rebuilding the SVG.
- **Gain:** measured 86% → 8% main-thread busy during rest. The style-recalc count stays at 144/s (Chrome still ticks the animation), but the paint work is gone.

### P2. The Friends tab re-downloads every photo on every tap
- **Bad** · `app.js:4787` (`tab` sets `FRIENDS = null; FEED = null` whenever Friends is tapped). `supabase/friends_social.sql:52` (`jobdone_feed` returns `ph`, the author's card photo, on every post row). `supabase/friends_today.sql:44` (`jobdone_friends_list` returns every friend's photo). Confirmed from the code and with payload sizes measured on fake data.
- **Measured:** 20 posts = 4.2 MB, 10 friends = 1.05 MB. That's 5.3 MB per tap on the Friends tab. The first render of that feed takes 335 ms at 4× CPU (decoding 30 JPEGs).
- **Why it matters:** the free Supabase plan has 5 GB of egress a month for the whole project. At 5 MB a tap, that's about 1,000 Friends opens a month across all users. Even a small friends group (1 MB a tap) runs out at about 50 daily users opening Friends 3 times a day. For the user, it's megabytes of gym mobile data and a skeleton every time they switch tabs.
- **Fix:** [patches/perf-04-friends-refetch.patch](../patches/perf-04-friends-refetch.patch): reload on a tab tap only if the last load was more than 2 minutes ago (pull-down and the Refresh button still force it). Avatars come from the friends list. Then [patches/perf-07-feed-no-avatar.sql](../patches/perf-07-feed-no-avatar.sql) stops the feed sending `ph`. The real fix is still photos in Supabase Storage with cache headers (REVIEW.md #147 and its storage advice), so a photo is downloaded once per phone, not once per open.
- **Gain:** feed payload −40% (no repeated avatars). Tab taps within 2 minutes cost 0 bytes.

### P3. Every unlock downloads the whole account
- **Bad** · `app.js:4990–4993` (`visibilitychange` → `loadCloud()`), `app.js:255` (`loadCloud` fetches meta, weights, steps, active and **all** `months/*`). Confirmed from the code. Size measured.
- **Measured:** 500 workouts = 24 month docs, 1,097 KB JSON, 5 requests. Then `clone` of everything, `ix()` rebuild (12.8 ms) and a full re-render.
- **Why it matters:** people unlock their phone between almost every set. A 20-set workout means about 20 full downloads of years of history, plus re-renders while they're trying to tap. It's the second-biggest egress cost after photos, and it grows with every workout logged. It also breaks the CLAUDE.md rule "think about how it behaves with hundreds of users".
- **Fix:** [patches/perf-06-resume-reload.patch](../patches/perf-06-resume-reload.patch). One tiny query for the newest `updated_at`; the full reload runs only when it changed. (Marked `ponytail:` in the code: your own writes also move the stamp, so the first unlock after logging still reloads once. If that matters, track your own last write time.) Longer term: fetch only rows with `updated_at` newer than the last load.
- **Gain:** a typical unlock goes from about 1 MB to about 100 bytes, and from 5 requests to 1.

### P4. First paint on slow 3G is 8.9 s, and nothing shows before the whole page arrives
- **Bad** · `web-src/index-shell.html:36–49`. The 320 KB of CSS is inline in `<head>`. `vendor/supabase.js` is a blocking script in `<head>`. The app's 433 KB script is inline at the end, and `#app` stays empty until it runs. Still open from REVIEW.md #131.
- **Measured:** slow 3G + 4× CPU: FCP 8,856 ms. Fast 3G: 2,656 ms. Unthrottled 4× CPU: 336 ms. So it's almost all download, not CPU.
- **Why it matters:** a friend opening an invite link on gym signal sees a white screen for 9 seconds. The Home Screen app is protected by the service worker after the first visit, but see P5.
- **Fix, in order of gain per effort:** (1) P5's cache-first page, so repeat launches don't touch the network. (2) Put a plain wordmark splash in the static `<body>` of the shell, so something paints when the first bytes arrive. (3) Move the wallpapers out of the CSS (P7), which cuts 173 KB raw. (4) Lazy-load the screens in P8 as separate files the service worker caches. (5) Add `defer` to `supabase.js` and wrap `boot()` in `DOMContentLoaded` (signed-in and offline paths don't need it before then).
- **Gain:** (3)+(4) take about 120 KB off the gzipped first load, from 236 KB to roughly 115 KB. On slow 3G that's about 2.5 s sooner.

### P5. The service worker blocks every launch on the network for up to 2.5 s, and installs download the page twice
- **Annoying** · `web-src/sw.js:5–13` (`pageFirst`: network first, cached copy only after 2.5 s), `web-src/sw.js:14` (`SHELL` holds both `'./'` and `'index.html'`, the same 758 KB page under two keys). From the code. Not measurable on localhost because `swRegister` only runs on https.
- **Why it matters:** with weak signal in the gym, every open of the Home Screen app shows the iOS splash for 2.5 s before the saved copy loads. CLAUDE.md says "don't block the first screen on the network". On every release (134 so far), each phone downloads the page three times: the navigation, `./` and `index.html`. That's about 700 KB gzipped per user per release.
- **Fix:** [patches/perf-03-sw-page-cache.patch](../patches/perf-03-sw-page-cache.patch). The saved page opens at once and the network copy refreshes the cache in the background. The first visit still uses the network with the old 2.5 s fallback. `./` is dropped from `SHELL`, and navigations to `/` map to `index.html`. **Trade-off:** a new version shows on the second launch after a deploy, not the first. If Job wants it on the first launch, add a "New version, tap to reload" toast when the service worker installs. That needs a lead decision.
- **Gain:** launch is instant offline and on bad signal. One page download per release instead of three.

### P6. Logging a set parses the workout twice and saves the whole history
- **Annoying** · `app.js:2711–2726` (`renderWorkout` sets `innerHTML`, then reads it back and sets it again for `resolveVars`), `app.js:2686` (`touchA` → `persist('jd/active')`), `app.js:190`/`203` (`lsSave` stringifies `{S, A, UI}`, the full history, on every `persist`). Confirmed.
- **Measured:** 500 workouts, 8×5 workout, 4× CPU: median 87–106 ms per tap (over the 50 ms long-task line), `renderWorkout` 43 ms, `lsSave` 15–29 ms writing 1,096 KB.
- **Why it matters:** this is the app's core action. It's fine on a new account, but it gets slower with every workout logged, and it adds jank right when confetti and the rest popup animate in.
- **Fix:** [patches/perf-02-set-log-cost.patch](../patches/perf-02-set-log-cost.patch). `resolveVars` runs on the string before the single `innerHTML` write. The workout in progress gets its own localStorage key (`<key>:a`, ~3 KB), so a `jd/active`-only persist doesn't rewrite the history; `lsLoad` merges it back, and sign-out and delete-account clear it.
- **Gain:** measured median 90 → 58 ms, p90 102 → 71 ms (−35%). Reloading the page still brings back all 32 logged sets (checked). Rebuilding only the changed set row would get it under 20 ms, but that's a bigger change for the frontend expert.

### P7. Wallpaper art is inlined in the CSS, and two images are written twice
- **Annoying** · `styles.css:864` and `891` (the 40 KB Skyline wallpaper, twice), `styles.css:890` and `1042` (the 23 KB chalk wall WebP, twice), `styles.css:834` (35 KB Agent wallpaper). Still open from REVIEW.md #132.
- **Measured:** 173 KB of `data:` images in CSS (54% of it). The duplicates are more than gzip's 32 KB window apart, so gzip can't remove them either.
- **Fix now:** [patches/perf-05-css-duplicate-art.patch](../patches/perf-05-css-duplicate-art.patch) defines `--wp-spidey` once and reuses `--chalkwall`. CSS goes from 342 KB to 280 KB raw, 93 KB to 74 KB gzipped. Looks the same.
- **Fix next:** move each wallpaper to `web/art/<theme>.svg|webp` and add them to `SHELL`. The browser only fetches the active theme's file, and the service worker keeps it. Theme previews in the intro and the picker would fetch the others on demand. That saves about another 90 KB raw from the first load.

### P8. About half the script is for screens that aren't on the first view
- **Annoying** · `app.js`, the whole file. Biggest pieces: `drawShare` (29 KB), `ACT` (19 KB), `drawMonth` (11 KB), `obBody` (9 KB), `openPlates` (8 KB), `renderSignIn` (8 KB).
- **Measured:** share/recap/month cards 58 KB, intro/tour/what's new 38 KB, ID card 32 KB, My Gym 30 KB, sign-in/MFA 15 KB, plate loader/keypad 15 KB, camera/posts 14 KB (source sizes; about 60% of that after minifying). A signed-in user never needs the intro or sign-in code on a normal launch.
- **Fix:** build.py emits 3–4 extra files (`share.js`, `intro.js`, `idcard.js`, `gym.js`), loaded with `<script src>` the first time they're needed and listed in `SHELL` so they work offline. The CSP already allows `'self'` scripts. This is a split, not a rewrite: the functions stay global. It fits the architecture expert's module plan.
- **Gain:** about 120 KB raw (about 40 KB gzipped) off every cold parse and download.

### P9. localStorage holds the whole history and will run out
- **Annoying** · `app.js:190` (`lsSave`), `app.js:1348` (the ID photo in `jd-idphoto` too). From the code. Size measured.
- **Measured:** 1,096 KB at 500 workouts, so roughly 2.2 KB per workout. iOS Safari allows about 5 MB per site. A heavy user hits it around 2,000 workouts, or sooner with an ID photo. `lsSave` swallows the quota error, so nobody notices the offline copy has stopped updating.
- **Fix:** short term, patch 02 keeps the frequent writes small, and the reliability expert should surface a quota failure (a one-time toast plus an error report). Long term, move the history to IndexedDB (async, much larger quota, no main-thread stringify).

### P10. Rest timer when the phone sleeps (performance side of #10)
- **Nitpick** · `app.js:2999`. From the code, needs iPhone.
- The timer is accurate: `REST.end` is an absolute time, so sleep can't drift it. The server push is cheap and well built. `jobdone_rest_tick` (schema.sql:65) only calls the edge function when an alert is due within 2 s (partial index `jobdone_rest_alerts_due`), so edge calls are about 1 per rest, not 17,280 a day. With pg_cron at 5 s, the push lands between 2 s early and about 5 s late.
- **Issue:** when you return to the app after a rest ended in the background, `tick()` still plays the rest sound and toast, minutes late, on top of the push you already got. **Fix:** in `tick`, play the sound only if `Date.now() - REST.end < 5000`; otherwise clear `REST` quietly.

### Smaller ones (all Nitpick)
- **N1.** Two document-wide `MutationObserver`s (`app.js:5413` tooltips, `app.js:5455` date fields) run a full-document `querySelectorAll` on every DOM change, including `tick`'s text updates twice a second during a workout (8 mutation records a second measured at rest). `render()` also calls `labelIcons(document)` (`app.js:682`), which does the same job as the first observer. Delete the observer and keep `labelIcons` after each `innerHTML` write.
- **N2.** `setInterval(tick, 500)` (`app.js:4995`) runs all day, even with no workout. It's cheap (idle Today measured at 0% busy), but it can stop when `!A`.
- **N3.** `jpegFit` (`app.js:1628`) re-encodes the full 720×900 canvas up to 6 times (144–164 ms at 4× CPU). Start at q 0.7, or use `canvas.toBlob` once Storage is in place. Base64 adds 33% to every stored and downloaded photo.
- **N4.** A service-worker update check runs on every unlock plus every 30 minutes (`app.js:535`). Still open from REVIEW.md #134. Small (3 KB, `no-cache`), but it's a request on every unlock mid-workout.
- **N5.** `owner.html` is a second full 758 KB copy of the page (build.py:47). Still open from REVIEW.md #130. Only the owner downloads it.
- **N6.** The wake lock is held for the whole workout (`app.js:2690`). Still open from REVIEW.md #135. With P1 fixed, the remaining cost is the screen itself.
- **N7.** pg_cron logs 17,280 rest-tick runs a day (trimmed daily). Still open from REVIEW.md #148, but the job itself is cheap (see P10).

## Free-tier outlook (hundreds of users)

A rough per-user egress estimate for a daily active user, before the patches: 10 unlocks × ~150 KB (a real history compresses less than test data) + 3 Friends opens × ~2 MB is about 7.5 MB a day. Supabase's 5 GB/month then covers about **20 daily active users**. After patches 03/04/06/07, it's mostly the feed photos, about 1.5–2 MB a day, or about **80–100 users**. Getting to hundreds needs the photos out of rows and into Storage with caching (already proposed in REVIEW.md). Vercel's bandwidth is not the limit: about 250 KB per release per user after patch 03.

## Patches

| Patch | What | Measured gain |
|---|---|---|
| [perf-01-hourglass-stream.patch](../patches/perf-01-hourglass-stream.patch) | Stepped stream animation, Reduce Motion off, sand moved by attribute | Rest: 86% → 8% main-thread busy |
| [perf-02-set-log-cost.patch](../patches/perf-02-set-log-cost.patch) | One `innerHTML` parse, workout saved under its own key | Set log median 90 → 58 ms |
| [perf-03-sw-page-cache.patch](../patches/perf-03-sw-page-cache.patch) | Cache-first page with background refresh; no double page download | Launch no longer waits up to 2.5 s; 1 page download per release instead of 3 |
| [perf-04-friends-refetch.patch](../patches/perf-04-friends-refetch.patch) | 2-minute reuse of friends/feed on tab taps; avatars from the friends list | 0 bytes for repeat taps |
| [perf-05-css-duplicate-art.patch](../patches/perf-05-css-duplicate-art.patch) | Each wallpaper written once | CSS −62 KB raw, −19 KB gzip |
| [perf-06-resume-reload.patch](../patches/perf-06-resume-reload.patch) | Check newest `updated_at` before reloading on unlock | About 1 MB → about 100 B per unlock |
| [perf-07-feed-no-avatar.sql](../patches/perf-07-feed-no-avatar.sql) | Feed stops repeating author photos (run after 04) | Feed payload about −40% |

All seven patches apply cleanly on top of each other (`git apply --check`), and the patched `app.js` and `sw.js` pass `node --check`. Patches 01 and 02 were measured by swapping the patched functions into the running offline copy. 03–07 are from the code, and 03 needs an https deploy (a Vercel branch preview) to test.
