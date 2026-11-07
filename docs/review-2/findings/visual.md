# Visual, theme, motion, accessibility, AI-slop and iOS PWA findings

Experts: #14 Visual / UI designer, #15 Theme art director, #16 Motion designer, #17 Accessibility (WCAG 2.2 AA), #27 AI slop expert, #11 Mobile / PWA specialist.

Tested 7 Nov 2026 on v134 (branch `claude/expert-review`), offline copy in Chromium at 390×844 and 375×667. Worst-case data: 4-split rotation (Anterior Chain Power Day Heavy → Posterior Chain Volume Builder → Push → Pull), a 30-character lift ("Single-Arm Incline Cable Flyes X"), friends named "Bartholomew Montgomery-Okonkwo" and "Christopher Wolfeschlegelsteinhausen", 45+ workouts. Every theme: Agent (`mono`), Summit (`cliffs`) at day 12:00, dusk 18:00 and night 22:00, Boulder (`climb`), Skyline (`spidey`). Contrast was measured in the page (text colour against the nearest solid background, WCAG formula) and each hit was checked on a screenshot.

Shots are in `../shots/vis-*.png`. Not covered here (needs an iPhone): Home Screen mode, the iOS 26 status bar, the real keyboard, VoiceOver speech, the camera prompt.

---

## Top 10

1. **Broken.** Summit (day) users see friends' PR pills as blank red blobs. [V1](#v1)
2. **Broken.** Boulder: the friend-request avatar letter is invisible (white on cream). [V2](#v2)
3. **Bad.** Logging a set still covers half the screen with the rest sheet, and the set message sits on the card you're logging. Still open from REVIEW.md #27 / #72. [V3](#v3)
4. **Bad.** Long split names break Today, the workout header and the Boulder finish page. [V4](#v4)
5. **Bad.** Summit by day: white titles on a pale sky, and grey labels at 2.8:1. Boulder's weight card has the same grey. [V5](#v5)
6. **Bad.** Skyline Friends header: red icons on the red skyline glow. [V6](#v6)
7. **Bad.** Text doesn't scale with the phone's text size, and the tab labels are 10 px. Still open from REVIEW.md #7 / #21. [V7](#v7)
8. **Bad.** Sheets don't move focus, trap it or give it back, and they vanish with no exit motion. [V8](#v8)
9. **Annoying.** Generated-looking UI: the exercise ⋯ menu is ten identical boxed buttons, and the feed post has boxes three levels deep. [V9](#v9)
10. **Annoying.** Summit dusk and night: the big white + sits on light cyan at 2.0–2.4:1. [V10](#v10)

**Count:** 2 Broken · 6 Bad · 8 Annoying · 11 Nitpick (27 total).

---

## All findings

### V1
**Broken** · #17, #15 · `styles.css:1165` vs `styles.css:1561-1581` · Friends feed · Summit day/dusk viewer, any post
Screenshot: [vis-30-feed-cliffs-day-a](../shots/vis-30-feed-cliffs-day-a.png), zoom [vis-36-zoom-pill-cliffs-day](../shots/vis-36-zoom-pill-cliffs-day.png)
Posts keep their author's theme, but Summit's day rule `:root[data-theme="cliffs"]:not([data-tod="night"]):not([data-tod="dusk"]) .pill.pr { color: #7A5410 }` is more specific than `.po2.po-t-spidey .pill.pr { color: #fff }`. The "2 PRs" text turns brown on red: measured 1.5:1. Summit-day users can't read the one number friends are proudest of.
Fix: scope 1165 away from posts (`:not(.po2 *)`), or raise the post rules to `.po2.po2.po-t-X .pill.pr`. Confirmed.

### V2
**Broken** · #17 · `app.js:1558` (`style="--avc:var(--raised)"`) + `styles.css:1387` · Friends → Requests and "Waiting for them" · Boulder
Screenshot: [vis-31-friends-climb](../shots/vis-31-friends-climb.png), zoom [vis-36-zoom-request-climb](../shots/vis-36-zoom-request-climb.png)
Request avatars use `--raised` as the circle colour and white text. In Boulder `--raised` is #F6F2EC, so the letter is white on cream (1.1:1). It reads as an empty circle.
Fix: use the requester's initial on `var(--accent)` or a neutral dark (#3A3446), as `face()` does for friends. Confirmed.

### V3
**Bad** · #14, #16, #11 · `styles.css:290` (`.restpop`), `styles.css:1500` (`.cele` at a fixed 124 px), `app.js:2773` · Workout, after ticking a set · all themes
Screenshots: [vis-21-setlogged-mono](../shots/vis-21-setlogged-mono.png), [vis-21-setlogged-climb](../shots/vis-21-setlogged-climb.png), [vis-21-setlogged-spidey](../shots/vis-21-setlogged-spidey.png)
Still open from REVIEW.md #27 / #72. The rest sheet takes the bottom ~45% of the screen (hourglass, 44 px clock, three buttons, Skip). The "Clean work / Right in the range" banner is placed at a fixed 124 px from the top. That assumes a one-line header, so with a two-line split name it covers the exercise name and its ⋯ button. You lose sight of the set you just logged and the next one. A slim `restpill` already exists (`REST.min`) but only appears after you minimise.
Fix: open rest as a slim bottom bar by default (clock, −30, +30, Skip, one progress line), put the set verdict inside that bar, and drop the separate banner. Mockup: [vis-workout](#workout-logger).

### V4
**Bad** · #14, #11 · `app.js:2084` (button label `Start ${name}`), workout header, finish hero pill · Today, Workout, Finish · all themes, worst in Boulder
Screenshots: [vis-10-today-mono-a](../shots/vis-10-today-mono-a.png) (button on two lines), [vis-20-workout-mono-a](../shots/vis-20-workout-mono-a.png) (title on two lines), [vis-41-se-workout-mono](../shots/vis-41-se-workout-mono.png) (SE: title and "Started · Today ▾" each wrap, header ~150 px, still open from REVIEW.md #10), [vis-26-finish-climb](../shots/vis-26-finish-climb.png) (pill wraps and "2 PRs" breaks into "2 / PRs")
The split name is repeated inside the main button, so a 30-character name makes a two-line button. The workout title isn't clamped. On the Boulder finish page the tilted split pill wraps and pushes the PR pill to two lines.
Fix: the button says "Start workout" (the name is right above it); the workout title is one line with an ellipsis and the meta goes on one line; finish pills get `white-space: nowrap; text-overflow: ellipsis`. Mockups: [Today](#today), [Workout](#workout-logger), [Finish](#finish-page).

### V5
**Bad** · #17, #15 · `--muted` / `--text2` at `rgba(52,48,62,.74)` on Summit day and Boulder cards; Summit headers use `--hdr-ink: #fff` · Today, Progress, Me · Summit day, Boulder
Screenshots: [vis-10-today-cliffs-day-a](../shots/vis-10-today-cliffs-day-a.png), [vis-10-me-cliffs-day-a](../shots/vis-10-me-cliffs-day-a.png), [vis-10-today-climb-b](../shots/vis-10-today-climb-b.png)
Measured: "Body weight", "7-day avg", "since 16 Aug" and "per month" on the grouped weight card are 2.7–2.8:1 in Summit day and 2.76:1 in Boulder (12–13 px text needs 4.5:1). By day, the white greeting, the "Progress"/"Maximilian" titles and the "Job's Done early beta" footer sit on a pale sky. The footer is close to invisible on Me.
Fix: raise light-theme `--muted` to about `rgba(40,38,50,.82)`. Give Summit's header text a soft dark shadow (`0 1px 2px rgba(10,30,50,.55), 0 0 18px rgba(10,30,50,.35)`), as the mockups do, and use dark ink for the footer by day.

### V6
**Bad** · #17, #15 · `styles.css:1164` (`:root[data-theme="spidey"] :is(… .icon-btn …)` sets the accent colour) · Friends header · Skyline
Screenshot: [vis-30-feed-spidey-a](../shots/vis-30-feed-spidey-a.png), zoom [vis-36-zoom-header-spidey](../shots/vis-36-zoom-header-spidey.png)
Add friend, Refresh and Settings are #FF5A50 on a 14% translucent plate over the red skyline glow, so they nearly disappear. The same memory-note pattern as the red tour bubble: an `!important` accent rule hits things on accent art.
Fix: header icon buttons on wallpaper get white ink on a darker plate (`rgba(10,18,48,.55)`). Mockup: [Feed](#friends-feed).

### V7
**Bad** · #17, #11 · `styles.css` (228 `font-size: …px`, 0 rem/em) · everywhere
Still open from REVIEW.md #7 / #21. Tab labels are 10 px (`styles.css:196`, `1597`), face statuses 11 px (`1393`), chart text and post stat labels 11 px (`223`, `1513`). Larger Text on the iPhone changes nothing.
Fix: use `font: -apple-system-body` on `html` and convert sizes to rem against it, starting with tabs, captions and eyebrows. Minimum 12 px for anything readable. From the code, needs iPhone for the real sizes.

### V8
**Bad** · #17, #16 · `app.js:546-577` (`openSheet`, `closeSheet`) · every sheet (plates, keypad, rest settings, ⋯ menus, comments, What's new)
`openSheet` sets `role="dialog"` and `aria-modal` but never moves focus into the sheet, doesn't trap Tab, doesn't make the page behind `inert`, and `closeSheet` doesn't return focus to the button that opened it. VoiceOver users stay on the page behind. On the motion side, sheets slide up in .32 s (`styles.css:333`) but `sh.el.remove()` makes them vanish in one frame.
Fix: on open, focus the first control (or the sheet) and set `inert` on `#app`; on close, run a ~.22 s slide-down, then remove and refocus the opener. From the code; VoiceOver needs iPhone.

### V9
**Annoying** · #27, #14 · `exMenu` (`app.js:4335`), `postHTML` (`app.js:1505`, `.po-wk` / `.po-stats`) · Workout ⋯ menu, Friends feed · all themes
Screenshots: [vis-24-exmenu-mono](../shots/vis-24-exmenu-mono.png), [vis-24-exmenu-climb](../shots/vis-24-exmenu-climb.png), [vis-30-feed-mono-a](../shots/vis-30-feed-mono-a.png)
The ⋯ menu is ten full-width bordered buttons of equal weight, with "Remove" styled the same apart from red text. It's a wall to read mid-set. The feed post puts stat tiles inside a bordered workout box inside the post card: three nested containers. Both are classic generated-UI tells ("every block in a bordered container").
Fix: grouped iOS-style list rows with icons, a value on the right (Rest 2:00), groups "This workout" and "Change", and Remove on its own. The post gets the photo edge to edge, stats as one row of three numbers, and lifts as plain rows with hairlines. Mockups: [Exercise menu](#exercise-menu), [Feed](#friends-feed).

### V10
**Annoying** · #17 · `styles.css:426`, `styles.css:1006` (`--accent: #5BB0D2 / #6CC0DE`) with white ink on `.tab-start` · tab bar + · Summit dusk and night
Screenshot: [vis-10-today-cliffs-night-a](../shots/vis-10-today-cliffs-night-a.png)
Measured: the white + on #6CC0DE is 2.05:1 (dusk) and on #5BB0D2 2.45:1 (night). Non-text contrast needs 3:1. Finish, Pause and Start already use the dark `--accent-ink` (6.7:1), so only the + is off.
Fix: use `--accent-ink` (#06222D) for the + at dusk and night, or use a darker teal plate (#155A73, 7.4:1 for white, used in the mockups).

### V11
**Nitpick** · #15, #14 · finish hero, workout set rows · Finish, Workout
CLAUDE.md wants identical heights across themes. Measured: finish heroes are 217 px (Agent), 229 (Summit), 235 (Boulder), 238 (Skyline). Boulder's set rows are 48 px against 43 px elsewhere, so every Boulder exercise card is 16 px taller (331 vs 315). The boxed kg/reps cells are a Boulder rule, so this is a clash to settle, not a bug.
Fix: lock the hero to one height (220 px in the mockups), and make Boulder's boxes 36 px tall inside the shared 43 px row.

### V12
**Annoying** · #17, #11 · Progress segmented control, range chips, date chip · Progress, Today · all themes
Measured: Body / Strength / Volume / History are 89×32, 1M…All are 62×36, and "Today, 7 Nov ▾" is 109×28. All are under 44 pt tall.
Fix: 44 px min-height on `.seg button` and `.daychip`, or a padded `::after` hit area like the ⓘ buttons.

### V13
**Annoying** · #17 · `styles.css:1307` (`.live-txt { color: #2FBF71 }`) · Friends list "At Anytime Fitness…" · Boulder, Summit day
Screenshot: [vis-31-friends-climb](../shots/vis-31-friends-climb.png)
Green on cream measures 2.1:1. Fix: #1F7A40 on light themes (5.3:1).

### V14
**Nitpick** · #15 · Boulder Today
Screenshots: [vis-10-today-climb-a](../shots/vis-10-today-climb-a.png), [vis-10-today-climb-b](../shots/vis-10-today-climb-b.png)
The monthly-report eyebrow is purple on purple (3.2:1). The wallpaper's rope runs down the right edge over the "Rotation…" text and the "1h 01m" on the cards. The saturated orange Next card plus a saturated green Last-session card give two loud panels on one screen (REVIEW.md #13 is still open for the colour part).
Fix: white eyebrow on the banner, pull the rope 6 px right of the card edge, and keep colour on the Next card only (the mockup's Last-session row is cream with a green dot).

### V15
**Annoying** · #14 · workout exercise card header · all themes
Screenshot: [vis-20-workout-mono-a](../shots/vis-20-workout-mono-a.png)
Still open from REVIEW.md #23. "Single-Arm Incline / Cable Flyes X" wraps because ⌃, ⇆ and ⋯ take ~130 px. Fix: one ⋯ button; collapse and swap live in the menu. Mockup: [Workout](#workout-logger).

### V16
**Nitpick** · #14 · Progress → Steps chart · all themes
Screenshot: [vis-10-progress-mono-b](../shots/vis-10-progress-mono-b.png). Still open from REVIEW.md B9: a stray "9" under the chart's bottom-left corner.

### V17
**Nitpick** · #15 · finish page volume bar · Agent
Screenshot: [vis-26-finish-mono](../shots/vis-26-finish-mono.png). Still open from REVIEW.md #5: the "Today" bar is peach/orange, a colour Agent uses nowhere else. Fix: Agent red (#E0303C). Summit and Boulder use their own accent too (mockup).

### V18
**Nitpick** · #15 · finish hero · Skyline
Screenshot: [vis-26-finish-spidey](../shots/vis-26-finish-spidey.png). Still open from REVIEW.md #14 / #54: burst, "City safe" stamp, yellow banner and cobweb all fight in the top 200 px. Fix: drop the yellow banner; the line goes under the burst as plain text. Mockup: [Finish](#finish-page).

### V19
**Nitpick** · #14 · share sheet · all themes
Screenshots: [vis-27-share-mono](../shots/vis-27-share-mono.png), [vis-27-share-climb](../shots/vis-27-share-climb.png). Still open from REVIEW.md #16 / #17: the card preview is ~170 px wide, and Agent's stat chips are white pills with no visible off state.

### V20
**Annoying** · #14, #27 · Splits page · all themes
Screenshots: [vis-10-splits-mono-a](../shots/vis-10-splits-mono-a.png), [vis-10-splits-climb-a](../shots/vis-10-splits-climb-a.png)
"Anterior / Chain Power / Day Heavy" wraps to three lines next to a sparkline with no axis or value (still open from REVIEW.md #9). Agent and Skyline still draw the same icon for every split (still open #8), while Boulder colours its holds per split. Each row also carries 2–3 muscle pills.
Fix: drop the sparkline and give the name the width; use the split colour in the icon in every theme; show muscles as one plain caption line.

### V21
**Nitpick** · #14 · Agent primary buttons
Screenshots: [vis-23-keypad-mono](../shots/vis-23-keypad-mono.png), [vis-01-intro-06-theme](../shots/vis-01-intro-06-theme.png)
Agent's main button is a red gradient (Start, Use 67.5 kg, Done on finish), but the keypad's Done and the intro's theme-step Continue are white. Two "primary" looks in one theme, and the intro's button changes colour on one step only.
Fix: one primary per theme.

### V22
**Nitpick** · #27 · intro Sounds step · signed-out (Agent)
Screenshot: [vis-01-intro-07-prefs](../shots/vis-01-intro-07-prefs.png). "Daily weigh-in" is a bordered box inside the bordered settings card. Fix: same plain rows as the others.

### V23
**Annoying** · #16 · `app.js:1995-2011` (`rollNums`, `confetti`), `.fin-press`, 6 × `scrollIntoView({ behavior: 'smooth' })` · Finish, Workout
Screenshots: [vis-26-finish-mono-early](../shots/vis-26-finish-mono-early.png), [vis-26-finish-climb-early](../shots/vis-26-finish-climb-early.png)
Still open from REVIEW.md #28 / #29: confetti falls over rolling numbers while the stamp presses in. Every finish gets four effects, so a PR finish doesn't feel bigger than a normal one. The global Reduce Motion rule (`styles.css:477`) kills CSS animation, but JS smooth scrolls (`app.js:2035`, `3019`, `3027`, `4658`, `4879`) still animate.
Fix: confetti only on a PR finish; roll the volume number only; pass `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`.

### V24
**Nitpick** · #14 · `app.js:1117` What's new sheet
Screenshot: [vis-11-whatsnew-mono](../shots/vis-11-whatsnew-mono.png). Seven entries of 2–3 lines each; "Got it" sits below the fold. Fix: show the newest three, then "See all".

### V25
**Nitpick** · #27 · `app.js:2269` · Progress → Strength
Screenshot: [vis-12-progress-strength-mono](../shots/vis-12-progress-strength-mono.png). "The cut is taking fat, not muscle." is the not-X-but-Y pattern, and it claims body composition the app can't measure. Fix: "Your strength went up 22% while your weight dropped 4%."

### V26
**Nitpick** · #27 · `styles.css:818` and `styles.css:1597` both define `:root:not([data-theme]) .tab` with different sizes; the later rule wins. Delete 818.

### V27
**Annoying** · #14 · Friends → Requests · all themes
Screenshot: [vis-31-friends-mono](../shots/vis-31-friends-mono.png). "Christopher Wolfeschlegelsteinhausen" breaks mid-word over three lines beside Decline/Accept. Fix: name on one line with an ellipsis, buttons on a row under it.

### Checked and fine (no finding)
- The status bar stays solid (`setBar`, `styles.css` `--barc`) in every theme.
- Inputs are 16–17 px (`styles.css:180`, `183`, `533`), so iOS won't zoom in.
- 46 `safe-area` uses; sheets pad for the home indicator.
- Today's card heights are identical across all four themes (measured 158 / 300 / 387 px).
- No unlabelled icon-only buttons found on Today, Progress, Me, Friends (`labelIcons` covers sheets).
- Signed-out and intro screens are Agent. No gun, laser or Spider-Man art.

---

## Redesign proposals

Each mockup is one HTML file with a theme switch (`?t=mono|cliffs|climb|spidey`). It uses the app's tokens (read from the running app), the real wallpapers (`mockups/assets/bg-*.png`), the system font stack and Permanent Marker from `web/fonts`. Real content and worst-case names throughout. Shots are at 390×844.

### Today
Before: [Agent](../shots/vis-mock-today-before-mono.png) · [Summit](../shots/vis-mock-today-before-cliffs.png) · [Boulder](../shots/vis-mock-today-before-climb.png) · [Skyline](../shots/vis-mock-today-before-spidey.png)
After: [Agent](../shots/vis-mock-today-mono.png) · [Summit](../shots/vis-mock-today-cliffs.png) · [Boulder](../shots/vis-mock-today-climb.png) · [Skyline](../shots/vis-mock-today-spidey.png) · file `mockups/vis-today.html`
- The greeting fits on one line ("Afternoon, Maximilian"), which saves ~40 px.
- The Next card shows the first lifts in one line instead of a "Show 5 exercises" button, plus a 4-step rotation strip with the current split marked. The button says "Start workout", always one line.
- Weight and steps share one card in two columns, with the grey raised to readable contrast.
- Last session is one tappable row with "Recap ›" instead of two buttons and a third "Show exercises" button.
- Each theme keeps its own day marks (scopes, rocks, holds, hexes), Boulder's orange Next card and dark button, and the Summit sky. Summit titles get a soft shadow so they read on a pale sky.

### Workout logger
Before (set just logged): [Agent](../shots/vis-mock-workout-before-mono.png) · [Summit](../shots/vis-mock-workout-before-cliffs.png) · [Boulder](../shots/vis-mock-workout-before-climb.png) · [Skyline](../shots/vis-mock-workout-before-spidey.png)
After: [Agent](../shots/vis-mock-workout-mono.png) · [Summit](../shots/vis-mock-workout-cliffs.png) · [Boulder](../shots/vis-mock-workout-climb.png) · [Skyline](../shots/vis-mock-workout-spidey.png) · file `mockups/vis-workout.html`
- The header is one line: title with an ellipsis, then "1 of 15 sets · 405 kg · 3,993 kg to match last time", and a quiet Finish (it isn't the main action mid-set).
- Rest is a slim bar at the bottom: the theme's set verdict ("Clean work." / "Good ground." / "Clean move." / "Clean swing."), the clock, −30, +30 and Skip, all 44 px. Both cards stay visible. No banner over the card.
- Exercise cards have one ⋯ button, so long names get the full width. The target line is shorter ("Target 67.5 kg · you hit 9+ reps last time").
- Boulder keeps its white boxed kg/reps cells, sized to the shared row height.
- "Swipe a set left to remove it" is a proposal (no swipe on set rows today). Without it, keep "Remove set" as a quiet text button.

### Friends feed
Before: [Agent](../shots/vis-mock-feed-before-mono.png) · [Summit](../shots/vis-mock-feed-before-cliffs.png) · [Boulder](../shots/vis-mock-feed-before-climb.png) · [Skyline](../shots/vis-mock-feed-before-spidey.png)
After: [Agent](../shots/vis-mock-feed-mono.png) · [Summit](../shots/vis-mock-feed-cliffs.png) · [Boulder](../shots/vis-mock-feed-climb.png) · [Skyline](../shots/vis-mock-feed-spidey.png) · file `mockups/vis-feed.html`
- The photo comes first, edge to edge. Below it: title + PR pill, one row of three stats with hairline dividers, and lifts as plain rows. One container instead of three.
- Long names are one line with an ellipsis. Face labels are 13/12 px instead of 13/11.
- Header icon buttons get a plate that works on any wallpaper (white ink, fixes V6). Refresh is dropped: pull-to-refresh already exists (`#fr-pull`).
- The mockup shows the post in the viewer's theme to compare themes. The real rule (posts keep their author's theme) stays, with the V1 pill fix.

### Finish page
Before: [Agent](../shots/vis-mock-finish-before-mono.png) · [Summit](../shots/vis-mock-finish-before-cliffs.png) · [Boulder](../shots/vis-mock-finish-before-climb.png) · [Skyline](../shots/vis-mock-finish-before-spidey.png)
After: [Agent](../shots/vis-mock-finish-mono.png) · [Summit](../shots/vis-mock-finish-cliffs.png) · [Boulder](../shots/vis-mock-finish-climb.png) · [Skyline](../shots/vis-mock-finish-spidey.png) · file `mockups/vis-finish.html`
- Every hero is exactly 220 px tall (V11). The stamp sits in the top-right corner, clear of the title. The split pill is one line with an ellipsis.
- Time, kg, sets and PRs come first in one card; PRs leave the hero pill.
- Volume bars use the theme's accent (Agent red, Summit teal, Boulder purple, Skyline red), never peach.
- PR rows say what the record is and what it beat ("Best estimated max · was 42.5 × 8"; the old value is sample data).
- Skyline keeps the burst and the "City safe" stamp and loses the yellow banner. Boulder keeps the paper card, Permanent Marker "Sent!" and the check hold. Agent keeps the red scope and the mono file label. Summit keeps the sunset over the ridges.

### Exercise menu
Before: [Agent](../shots/vis-mock-exmenu-before-mono.png) · [Summit](../shots/vis-mock-exmenu-before-cliffs.png) · [Boulder](../shots/vis-mock-exmenu-before-climb.png) · [Skyline](../shots/vis-mock-exmenu-before-spidey.png)
After: [Agent](../shots/vis-mock-exmenu-mono.png) · [Summit](../shots/vis-mock-exmenu-cliffs.png) · [Boulder](../shots/vis-mock-exmenu-climb.png) · [Skyline](../shots/vis-mock-exmenu-spidey.png) · file `mockups/vis-exmenu.html`
- The header names the lift and its equipment, muscle and sets.
- Two groups of plain rows with icons ("This workout": note, warm-ups, rest time with its value, superset; "Change": swap, left/right, reorder, setup notes, history). Remove sits alone at the bottom.
- The same items as today, nothing added or removed. Rows are 50 px.
