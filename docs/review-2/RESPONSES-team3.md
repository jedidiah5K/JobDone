# Fix Team 3: visual findings and redesigns

Branch `worktree-agent-a3092099fce3572cf` (started from `claude/expert-review` at 259404b). Nothing pushed, merged or deployed. No database changes. The service worker version is unchanged. Screenshots are in `after/t3-*.png`, taken at 390×844 (plus 375×667 with long names) in Agent, Summit (day, dusk and night), Boulder and Skyline.

## Redesigns (the approved mockups)

| Mockup | Status | Commit |
|---|---|---|
| vis-workout: slim rest bar by default, the verdict inside it, hourglass beside the time, Pause by tapping the time, one-line header, one ⋯ per card, swipe hint | Done | 0043b6b, b4fe8a3 |
| vis-exmenu: grouped rows with icons, Remove on its own | Done | e819418 |
| vis-today: one-line greeting, "2 of 4 · streak", lifts line, rotation strip, "Start workout", weight and steps side by side, last session as one row | Done | a49e7d8, 8d92574 |
| vis-feed: photo first, one container per post, header plate, no Refresh button (pull-down spins) | Done | 43d7270 |
| vis-finish: 220 px heroes, numbers first, theme-coloured bars, PR rows with the real "was" set | Done | b9a6b8a |

What changed from the mockups and why:
- The workout target line keeps its current wording. Targets belong to the workout-logic team, and Job still has to decide on them (REPORT decision #7).
- The "vs last" line stays on exercise cards. It's real information and the mockup cut it only to save space.
- On Today, the date picker shows only on past days. Tapping a day mark gets you there, so no feature is lost. The tour line now says "Tap a day to look back at it."
- The Today header lost its day chip ("Today ▾"). Changing the day is still on the workout review page ("▾ change day"), and the chip still shows for past-day workouts.
- Rest bar: "Next set at …" was dropped, as in the mockup. The −30 / +30 / Pause handlers didn't change. The tour's rest-timer step now points at the bar and says "tap the time to pause".

## visual.md findings

| # | Status | Commit / reason |
|---|---|---|
| V1 Summit-day PR pill | Done. Measured 4.7–8.4:1 for posts in each author theme | 43d7270 |
| V2 Boulder request avatar | Done. 4.5:1, uses the face() colour | 43d7270 |
| V3 rest sheet and banner cover the set | Done. Slim bar, verdict inside it, PR and Exercise done pop-ups sit low | 0043b6b |
| V4 long split names | Done. Today button, workout header (81 px on SE), finish pill | 0043b6b, a49e7d8, b9a6b8a |
| V5 Summit-day white titles and grey labels | Done. Labels 8.0:1 (Summit day) and 8.7:1 (Boulder); title, faces and footer shadow; white footer on Summit | 380d01c |
| V6 Skyline Friends header icons | Done. White on a navy plate, about 6:1 | 43d7270 |
| V7 Dynamic Type | Partly done. Tab labels are 11 px and face labels 12 px. **Converting px to rem was out of scope this round** | 380d01c |
| V8 sheet focus, inert, exit motion | Done. Focus moves into the sheet, the page behind is inert, focus goes back on close, .15 s slide-down that respects Reduce Motion. VoiceOver itself isn't checked; that needs an iPhone | 9ab39c7 |
| V9 exercise menu and feed nesting | Done | e819418, 43d7270 |
| V10 + at Summit dusk and night | Done. #155A73, 7.7:1 | 380d01c |
| V11 identical heights | Hero part done (220 px everywhere). Boulder's set-row height is **Job's call** (boxed cells vs identical heights), so it's left alone | b9a6b8a |
| V12 tap targets under 44 pt | Done. 44 px hit areas on segments and day chips, and a taller hidden date input | 380d01c |
| V13 green "At the gym" on light themes | Done. 5.2:1 | 43d7270 |
| V14 Boulder Today | Eyebrow (white) and colour on the Next card only: done. **The rope position isn't done**: it's baked into the wallpaper art | a49e7d8, 380d01c |
| V15 three icon buttons on cards | Done. One ⋯, swap is in the menu, and the fold chevron shows once every set is ticked | 0043b6b |
| V16 stray "9" on the steps chart | Done. Real date labels | 380d01c |
| V17 peach bar in Agent | Done | b9a6b8a |
| V18 Skyline finish clutter | Done. No yellow banner | b9a6b8a |
| V19 share sheet | Not done. Nitpick; the share sheet wasn't redesigned this round | — |
| V20 Splits page | Done. Sparkline gone, muscles on one caption line. Split-colour icons in Skyline were kept off: CLAUDE.md says every Skyline split colour is red | 380d01c |
| V21 two primaries in Agent | Keypad Done is done. **The intro's theme-step Continue isn't done**: the intro belongs to another team | 8d92574 |
| V22 intro Sounds step box | Not done. Intro belongs to another team | — |
| V23 motion | Done: confetti only on a PR finish, only the kg number rolls, JS smooth scrolls follow Reduce Motion. **Not done: the two smooth scrolls inside `logSet`**, which I was told not to touch. They need `behavior: smooth()` | b9a6b8a, 380d01c |
| V24 What's new length | Not done. Belongs with the NEWS list (another team) | — |
| V25 "not X but Y" copy on Strength | Not done. It's copy, not the redesign; passed to the copy team | — |
| V26 duplicate .tab rule | Done | 380d01c |
| V27 long names in Requests | Done. One line with an ellipsis, buttons under the name | 43d7270 |

Also done: perf-05 (duplicated wallpaper art removed), commit 9368d23.

## Checks
- All 8 `tests/*.js` pass.
- The owner path (`profile.owner = true`) renders Today, Progress and Me and opens the plate loader with no page errors (`after/t3-owner-today-spidey.png`).
- No page errors or console errors in any screenshot run.
- Contrast was measured in the page (WCAG formula, alpha composited); the numbers are in the table above.
- Not checked: a real iPhone (VoiceOver, Home Screen mode, real text sizes), and a slow connection.
