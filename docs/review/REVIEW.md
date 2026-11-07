# Job's Done: the teardown

Reviewed 7 Nov 2026 against v128 (local build, same as live). Read-only: nothing was changed.

How it was tested: read app.js (5,358 lines, 548 KB), styles.css (1,494 lines, 332 KB), schema.sql, the edge functions, sw.js, vercel.json and build.py. Ran all four checks in tests/ (all pass). Then used the app in a browser at 390×844 and 375×667 with the demo data (45 workouts, PPL), plus a heavy setup (4-split rotation, long split and exercise names). Every theme's Today and finish page, the full workout flow, plate loader, rest timer, finish review, share sheet, Progress, Me, Splits, and all 11 intro steps. Screenshots are in this folder.

What this review could not cover: a real iPhone (Home Screen mode, the iOS 26 status bar, push notifications, the silent switch, Safari's camera prompt), the live Supabase backend with real friends, Dynamic Type at real sizes, and VoiceOver. Those findings are marked "from the code" where they come from reading rather than seeing.

Severity: **Broken** (doesn't work or shows wrong data) · **Bad** (works but hurts) · **Annoying** (friction) · **Nitpick** (small, still worth fixing).

---

## The 10 worst problems

1. **The Steps card on Today is broken in every theme, live right now.** The progress ring blows up to the full card width and the text gets squeezed into a one-word-per-line column. Cause: the Friends status-dot CSS added in v121/v125 reuses the `.ring` class name. [02](02-agent-steps-bug.jpg), [18](18-summit-steps-bug.jpg) · styles.css:1443, 1468 vs 204/706.
2. **PRs are handed out like candy.** "Heaviest" fires for any heavier weight at any rep count, so following the app's own "add 2.5 kg" target gives you a PR on every lift, every week. The test workout got 5 PRs while volume dropped on 4 of 5 lifts and the finish page said "21% less volume". When everything is a PR, nothing is. app.js:301, [12](12-agent-finish-review.jpg), [14](14-agent-finish-page.jpg).
3. **Logging one set fires three things on top of each other**: a "Clean work" toast covering the Finish button, a rest sheet covering half the screen, and a PR pill sitting on the −30s / Pause / +30s buttons. [10](10-agent-set-logged.jpg).
4. **The intro is 11 steps long**, CLAUDE.md says 9, and it asks a brand-new lifter to set up two-step sign-in (step 10) before they've logged a single set. Import from Strong/Hevy comes last, after they've already picked a plan that the import makes pointless. [24](24-intro-home.jpg)–[29](29-intro-plan.jpg).
5. **Cross-device sync is last-write-wins on whole documents.** Each month of workouts is one row; two devices editing the same month overwrite each other. `jd/meta` (profile, every split, rotation, custom exercises, setup notes) is rewritten whole on every small change. app.js:216–243.
6. **Photos are stored inside database rows** (stories, stamps, progress photos as `photos/YYYY-MM-DD` docs) and the daily backup copies every row for 14 days. On the 500 MB free database this is the first wall you hit. schema.sql:108, app.js:1593.
7. **No Dynamic Type at all**: 202 hard-coded `px` font sizes, zero `rem`. An iPhone user with large text gets the same 11 px captions. styles.css.
8. **Direct sign-up probably bypasses your own sign-up rate limit.** The `signup` edge function limits 5 per network per hour, but unless Supabase Auth's public sign-up is turned off in the dashboard (still on your to-do list), anyone can hit `/auth/v1/signup` with the public anon key and skip it.
9. **Job-specific code runs for every user**: lift renames ("Tricep Vulken", "Single-Arm Tricep" → "Tricep Pushdown") are applied to everyone's history on every load. A new user who names a custom exercise "Single-Arm Tricep" will see it silently renamed. app.js:275–290.
10. **The workout screen wastes the top fifth of a small phone** on the header (title, start time, date picker, three stats, progress bar). On an iPhone SE you see 1.3 exercises at a time. [32](32-se-workout.jpg).

**Marketer's money verdict:** don't charge yet. The app is good enough to charge for, but you have a handful of beta users and no retention numbers. Get to about 300 weekly active users with 40% still training after 8 weeks. Then launch a "Pro" at about $24.99/year, plus a $49 lifetime option for the first 500 buyers. Put the themes beyond Agent, the friends feed photos/stories, the monthly report and the ID card in Pro. Logging, history, PRs, the plate loader, the rest timer and one theme stay free forever. Lemon Squeezy or Paddle (no monthly fee; they handle sales tax as merchant of record) beat Stripe for a solo developer in the Philippines. Details in section 6.

---

## Bugs (actually broken)

| # | Sev | Where | What | Fix |
|---|---|---|---|---|
| B1 | Broken | Today, Steps card, all themes | Ring fills the card, text wraps one word per line ("tap / to / edit"). [02](02-agent-steps-bug.jpg) | Rename the friends class (`.fr-ring`) or scope 1443–1474 to `.fr-face .ring`. |
| B2 | Broken | PR logic, app.js:301 | "Heaviest" PR at fewer reps and lower e1RM (67.5×6 beat 65×10 and was called a PR). | Only count Heaviest when reps ≥ the previous heaviest's reps, or rank by e1RM. |
| B3 | Bad | Finish page, all themes | A workout finished in Agent keeps "Clean exit. No witnesses." after switching to Summit/Boulder/Skyline. [19](19-summit-finish.jpg), [21](21-boulder-finish.jpg), [23](23-skyline-finish.jpg) | Store the line's key, pick the text from the current theme. |
| B4 | Bad | Finish page "Badge earned" | Shows "12-week streak" as newly earned on a workout where the streak was already 12 weeks. [15](15-agent-finish-bottom.jpg) | Only show a badge on the workout that crossed the threshold. |
| B5 | Bad | Workout, "Add machine setup notes" | Shown on Bench Press and Incline Dumbbell Press, which aren't machines. app.js:4175, [08](08-agent-workout.jpg) | Show only when equipment is machine/cable/Smith. |
| B6 | Bad | Load, app.js:275 | Job's own lift renames run for every account. | Gate behind `profile.owner` or a one-time migration flag. |
| B7 | Bad | Me footer, app.js:2517 | "Job's Done early beta · Oct 2026" while it's November and v128. | Print the build version from sw.js. |
| B8 | Annoying | Plate loader | The 1.25 kg plate label is cut off at the right edge ("1."). [09](09-agent-plate-loader.jpg) | Let the plate row scroll or shrink the chips. |
| B9 | Annoying | Progress → Steps chart | A stray "9" under the y-axis zero. [06](06-agent-progress-steps.jpg) | Check the axis label loop. |
| B10 | Annoying | Intro step 9 (plan) | The sticky Continue button sits in the middle of the plan list with PHUL/others continuing below it. [29](29-intro-plan.jpg) | Pad the list bottom by the button height. |
| B11 | Nitpick | Intro step 8 | Rep range dropdowns read "Skip to Skip reps". [28](28-intro-train.jpg) | Default to the experience range or show "Auto". |
| B12 | Nitpick | Workout stat "under 1 min" | Wraps to two lines on the finish review and finish page. [12](12-agent-finish-review.jpg) | "<1 min" or "0 min". |

---

## 1. Professional app reviewer

*"I've reviewed Strong, Hevy, Fitbod, Alpha Progression and Liftin'. This one is a website pretending to be an app, and for the most part it gets away with it. That makes the rough edges more annoying, not less."*

**Scores:** first impression 7 · visual polish 6 · consistency 5 · typography 6 · motion 6 · empty/loading/error states 6 · accessibility 4 · speed 7 · offline 8 · copy 7 · **overall 6.2**

### Visual polish and consistency
1. **Broken.** Steps ring (B1). The first scroll on Today shows a broken card. That's the screenshot that ends up in my review. [02](02-agent-steps-bug.jpg)
2. **Bad.** Every theme renames "Next up" (Next assignment / Next ascent / Next route / Next patrol), but Splits still says "Next up" in all of them. Pick one per theme and use it everywhere. [01](01-agent-today.jpg) vs [04](04-agent-splits.jpg)
3. **Bad.** The Agent finish page has the "MISSION COMPLETE" stamp sitting on top of the title text. It looks like a rendering error, not a seal. [14](14-agent-finish-page.jpg)
4. **Bad.** The Agent share card says "MISSION COMPLETE" in huge type and "JOB'S DONE" as a stamp; the finish page says it the other way round. Two places, two hierarchies. [16](16-agent-share.jpg)
5. **Annoying.** The volume comparison bar on the Agent finish page is peach/salmon orange, a colour that exists nowhere else in Agent. [14](14-agent-finish-page.jpg)
6. **Annoying.** On Today, the "Last session" card's "Open and edit" is a full red primary button, the same weight as "Start Push" above it. Two red buttons on one screen. [03](03-agent-today-bottom.jpg)
7. **Annoying.** Me's main button is "Edit card": the biggest thing on your profile is editing a trading card. [07](07-agent-me.jpg)
8. **Annoying.** Splits uses the same crosshair icon for every split in Agent. Split colours exist (week dots use them) but the list doesn't show them. [04](04-agent-splits.jpg)
9. **Annoying.** The sparklines on Splits have no axis, no label, no value. Decoration pretending to be data. [04](04-agent-splits.jpg)
10. **Nitpick.** Week dots in Agent show split initials ("Ps", "Pl", "L") in the accessibility text but the scope crosshairs hide them visually; Summit/Boulder/Skyline show them. Inconsistent meaning of the same row. [01](01-agent-today.jpg) vs [17](17-summit-today.jpg)
11. **Nitpick.** Summit Today: the cyan "Today, 7 Nov" date pill is the only cyan text on the screen.
12. **Nitpick.** Boulder: the floating purple rope cuts across the "Next route" card and over "Rotation: Push → Pull → Legs" text. [20](20-boulder-today.jpg)
13. **Nitpick.** Boulder Today: the rotation card is a saturated blue panel with dark text and a black button. Every other card is cream. It's the loudest thing on the screen and it's not the main action button. [20](20-boulder-today.jpg)
14. **Nitpick.** Skyline finish page: the comic "JOB'S DONE!" burst, the "CITY SAFE" stamp, a yellow banner and a cobweb all fight in the top 200 px. [23](23-skyline-finish.jpg)
15. **Nitpick.** Summit finish page: the "SUMMIT REACHED" stamp is clipped by the top-right corner. [19](19-summit-finish.jpg)
16. **Nitpick.** The share sheet's stat chips (Time, kg lifted, Sets, PRs) are white pills on dark. Selected or not? No visible off state. [16](16-agent-share.jpg)
17. **Nitpick.** The share card preview is about 150 px wide in the sheet. You can't read what you're about to post. [16](16-agent-share.jpg)
18. **Nitpick.** "kg" on the body-weight number sits on the baseline in a lighter weight but "kg" in the workout table is uppercase "KG". Pick one.
19. **Nitpick.** Workout header: "4,398 kg to match last time" is right-aligned and wraps "last time" on small phones. [32](32-se-workout.jpg)
20. **Nitpick.** "Remove set" is a grey text link on the right, "Add set" is a button on the left. Destructive and constructive actions get swapped weight compared to iOS norms, but it also sits where your thumb lands.

### Typography
21. **Bad.** No Dynamic Type (202 px sizes, 0 rem). Accessibility settings on the phone do nothing.
22. **Annoying.** Eyebrow labels (THIS WEEK, BODY WEIGHT, STEPS) are about 11 px grey uppercase on dark glass, below comfortable contrast in Agent and Skyline. [01](01-agent-today.jpg)
23. **Annoying.** Exercise names wrap to two or three lines in the workout card ("Incline Dumbbell / Press") while there's empty space between the name and the ⌃ ⇆ ⋯ icons. [08](08-agent-workout.jpg), [32](32-se-workout.jpg)
24. **Nitpick.** The workout table header uses SET / PREVIOUS / KG / REPS in tiny caps, but the intro mock uses "Set / Previous / kg / Reps" in sentence case. [25](25-intro-what.jpg)
25. **Nitpick.** Agent's ID card uses a mono typewriter font that appears nowhere else in Agent.

### Motion
26. **Annoying.** Screens fade in from near-black on every tab switch (caught mid-fade in testing more than once). On a fast phone this reads as flicker. [03](03-agent-today-bottom.jpg) was retaken for this reason.
27. **Annoying.** The rest sheet slides up over the exercise you just logged. You lose sight of the next set you're about to do. [11](11-agent-rest.jpg)
28. **Nitpick.** Rolling numbers on the finish page roll even for "15 sets" and "98 reps". Roll the hero number only; rolling everything is noise.
29. **Nitpick.** Confetti, a stamp press, a seal and rolling numbers all happen on the finish page. One big moment beats four medium ones.

### Empty, loading and error states
30. **Annoying.** A new exercise with no history shows "—" in both kg and reps with no hint of what to enter. [32](32-se-workout.jpg)
31. **Annoying.** "No measurements yet." followed by two red links. It's an empty state that just lists the missing thing. [06](06-agent-progress-steps.jpg)
32. **Nitpick.** "Your October report is ready" on 7 November with no preview of what's in it. A teaser number (e.g. "12 workouts, 3 PRs") would get the tap. [03](03-agent-today-bottom.jpg)
33. **Nitpick.** Offline toast: "No signal. Your sets are saved on this phone and will sync when you're back online." is 18 words in a 3.5 s toast. Nobody reads that mid-set. app.js:246

### Accessibility (from the code and screens)
34. **Bad.** Only 15 `alt=` attributes in 548 KB of UI. Muscle maps, charts and badges have no text equivalent.
35. **Bad.** Charts (body weight, steps, volume) are SVG with no summary text for VoiceOver.
36. **Annoying.** Tap targets: the ⓘ info buttons, the Summit/Skyline week dots and the "Remove set" link look under 44 px. [08](08-agent-workout.jpg)
37. **Annoying.** Colour-only meaning in the finish comparison: red ▼ volume vs grey ▲ top. Red-green colour-blind users can't tell good from bad. [12](12-agent-finish-review.jpg)
38. **Nitpick.** The app ignores the phone's light/dark setting entirely. Summit and Boulder are light themes; opening them at 2 a.m. is a flashbang.
39. **Nitpick.** Reduce Motion is respected for confetti and rolling numbers, but the screen fade and sheet slides still run.

### iOS PWA rough edges (from the code)
40. **Annoying.** Every update needs the user to tap "Update". Most beta users never do; you just shipped 14 versions in a week.
41. **Annoying.** Camera permission in Home Screen apps is re-asked per session on iOS. The story camera will prompt often and users will think the app is broken.
42. **Nitpick.** A 15 MB face-blur model (mediapipe) sits in the vendor folder and its own cache. Big for a website on mobile data.

### Copy
43. **Annoying.** "Target: add 2.5 kg on every set, you hit 9+ reps last time." is a run-on with a comma splice, shown on every exercise card. [08](08-agent-workout.jpg)
44. **Nitpick.** "That's like pushing 2.3 Aston Martins out of a car park. Quietly." The decimal kills the joke. "Two Aston Martins" lands; "2.3" reads like a spreadsheet. [14](14-agent-finish-page.jpg)
45. **Nitpick.** "Clean exit. No witnesses." on a gym finish page is a bit dark for a beginner's first workout.
46. **Nitpick.** "Open and edit" (past session) vs "Recap": two names for looking at the same workout.

### Where it beats the competition
- Plate loader opening first on the kg box is better than Strong's plate calculator buried in a menu.
- Themes with their own voice and finish pages: nobody else has personality like this.
- Offline-first logging is solid; Hevy still spins on bad gym Wi-Fi.
- Free, no ads, no account wall beyond email + password.

### Where it loses
- No Apple Watch, no widgets, no Live Activity (a website can't, but users won't care why).
- Exercise library depth and search: Strong and Hevy have hundreds of lifts with filters.
- No web/desktop view for planning; the layout is phone-only even on an iPad.
- Charts: Hevy's per-exercise charts with 1RM, volume and best set over time are clearer.

### What's good
Two-tap logging works. "Previous" column is right where your eye goes. The Agent theme finally looks premium. Practice runs, rest weeks and the plate loader are thoughtful touches.

### What I wish it had
- An iPad layout with two columns.
- A per-exercise detail page that's as good as Hevy's.
- Widgets for "next workout" (needs a native app) [CLASHES WITH RULE: no native app planned].
- A public changelog page linked from What's new.

---

## 2. Fitness influencer

*"Would I film this? The finish pages, yes. The share card, almost. The feed, not yet."*

### Share cards and finish pages
47. **Bad.** 5 PRs on a workout with 21% less volume. If I post "5 PRs" and a follower checks the numbers, I look like a liar. (B2) [14](14-agent-finish-page.jpg)
48. **Bad.** The share card preview is too small to judge. I need a full-screen preview before posting. [16](16-agent-share.jpg)
49. **Annoying.** Only 5 lifts fit on a card. Push days with 6–7 movements get cut, and the cut ones are random to the viewer.
50. **Annoying.** No video. Story cards are images only. Every gym creator posts video; let me put the card over a clip or export an overlay with a transparent background.
51. **Annoying.** No way to put my own photo behind the Post card (only on the feed stamp). Hevy lets you.
52. **Annoying.** The card shows the app's URL "jobdone-peach.vercel.app". "peach.vercel.app" looks like a test site. Followers won't type it and it doesn't build trust. [16](16-agent-share.jpg)
53. **Nitpick.** Agent card: tiny 8 px text for "OPERATION / TIME / KG MOVED" disappears after Instagram compression.
54. **Nitpick.** Skyline finish page is busy: the burst, the stamp, the banner and the cobweb compete. On camera it's mush. [23](23-skyline-finish.jpg)
55. **Nitpick.** "That's like…" lines use decimals ("5.8 grumpy grizzly bears", "17 haul bags"). Round them for the camera.
56. **Nitpick.** No "duration" option on the card when the workout ran long. Long sessions are a flex too.

### PRs, streaks and badges
57. **Bad.** A "PR" pill pops after the first set of the day before I've done a real top set. Cheap. [10](10-agent-set-logged.jpg)
58. **Annoying.** "Badge earned: 12-week streak" every workout of the 12th week. (B4)
59. **Annoying.** No PR video or photo attachment. A PR without proof is just a number.
60. **Nitpick.** The PR list says "Heaviest" / "e1RM" without context. "67.5 kg × 6, heaviest ever (was 65)" is the shareable line.

### Feed and stories
61. **Annoying.** The feed only shows the last 24 hours. Instagram trained everyone that a profile keeps posts; here a friend's PR vanishes by tomorrow.
62. **Annoying.** No follower model, only mutual friends with a code. I can't build an audience here, and you can't grow through me.
63. **Annoying.** No public profile link to put in a bio.
64. **Nitpick.** The front-and-back story puts the selfie top-left like BeReal. Fine, but give me the option to swap which camera is big.
65. **Nitpick.** Reactions are six fixed emoji. No 🏋️ or 🦵, which is what a gym feed actually uses.

### Training side
66. **Bad.** Presets only use one person's foundation lifts. No squat, no deadlift, no bench in the presets (bench exists in the demo). A strength creator's followers will ask "where's the squat?" immediately. [CLASHES WITH RULE: presets built only from Job's lifts, no squats]
67. **Annoying.** Rep target suggests reps 6 after 65×10 at the next weight. Fine for experienced lifters, scary for beginners following me.
68. **Annoying.** No periodisation or program templates from known coaches (5/3/1, GZCLP, nSuns). Creators sell programs; give them a way to share one.
69. **Nitpick.** "Arnold" and "Bro" splits in the presets with no explanation of who they're for.
70. **Nitpick.** e1RM is shown but never explained on the PR list.

### What's good
The themed finish pages are genuinely screenshot-worthy. The ID card is a fun flex. The "That's like…" lines are the most shareable thing in the app.

### What I wish it had
- Video overlay export (transparent PNG / MOV) for stories.
- Public profile pages and follow (not just friends).
- Creator programs: publish a split, followers import it with one tap (split links already exist, so half-built).
- PR proof: attach a clip to a set.
- Leaderboards among friends per lift.
- A "year in review" share card.

---

## 3. Regular gym goer

*"I train five days a week and I've used Strong for four years. I'll give anything two weeks."*

### Logging speed
71. **Bad.** One tap on ✓ throws a toast, a rest sheet and a PR pill on top of each other. I came here to log and look away. [10](10-agent-set-logged.jpg)
72. **Bad.** The rest sheet covers the next set. I want to see what's next while resting, not an hourglass. [11](11-agent-rest.jpg)
73. **Annoying.** The plate loader opens first on every kg tap, even when I only want to type 67.5. One more tap every time to reach the keypad. [09](09-agent-plate-loader.jpg)
74. **Annoying.** The "Clean work / Right in the range" toast covers the Finish button and the header stats for ~2 s every set. [10](10-agent-set-logged.jpg)
75. **Annoying.** Prefilled reps show the target (6), not what I did last time (10). Every set I have to change it.
76. **Annoying.** The workout header takes ~150 px. On my SE I see one exercise and a half. [32](32-se-workout.jpg)
77. **Annoying.** Exercise cards are tall: name, setup note row, a two-line target, the header row, three sets, Add set/Remove set. A 6-exercise day is a long scroll.
78. **Nitpick.** "Remove set" removes the last set, not the one I tapped. Swipe-to-delete on a row is what my thumb expects.
79. **Nitpick.** The ✓ button is on the far right, the kg box in the middle: reaching across the phone one-handed with sweaty fingers.

### Rest timer and sounds (from the code)
80. **Annoying.** Rest push is sent by a server cron every 5 s. Rest end can be up to 5 s late, and with no signal in a basement gym, the push never comes.
81. **Annoying.** No per-set-type rest (warm-ups need 60 s, top sets 3 min). Per-exercise rest exists but is buried in the workout ⋯ menu.
82. **Nitpick.** −30s / +30s only. Let me hold to change by 15 s.

### Day 30 annoyances
83. **Annoying.** The "Target:" line on every card, every day, forever. I know I hit 9+ last time. A toggle exists in settings but it's on by default for everyone.
84. **Annoying.** No exercise notes visible in the workout for *this* session other than setup notes. "Left shoulder tweaky, stopped at 6" has nowhere obvious to go.
85. **Annoying.** Switching gyms: the gym builder and "machine taken" exist, but changing gym for one session isn't a one-tap thing.
86. **Annoying.** Supersets exist (⋯ → "Superset with…") but only with the next exercise. Giant sets and circuits don't.
87. **Nitpick.** Drop sets and failure sets exist as set types but the row doesn't show what type it is at a glance.
88. **Nitpick.** No warm-up set generator (bar, 40%, 60%, 80%).
89. **Nitpick.** No timer for timed exercises (planks, carries, dead hangs).

### Interruptions (from the code)
90. **Annoying.** Wake lock keeps the screen on during a workout, which drains battery over 75 minutes. It can be turned off, but it isn't explained anywhere I'd see it.
91. **Nitpick.** If a call comes in during rest, the audio context is resumed on return, but the rest end sound already missed is never replayed.

### Switching from Strong
92. **Annoying.** Import exists and handles Strong/Hevy CSV, but it's offered as the last intro step and then hidden in Me → Account and data.
93. **Annoying.** No export to Strong's CSV format, so leaving is harder than arriving. That makes me nervous about committing.
94. **Nitpick.** Units: kg/lb toggle exists, but mixed (kg plates on a lb machine) isn't handled.

### What would make me quit
95. **Bad.** The PR inflation. After two weeks I stop trusting the numbers and then the app is just a notepad.
96. **Annoying.** Losing a workout. Last-write-wins sync means logging on my phone while my iPad has the app open could overwrite a month.

### What's good
Previous numbers right next to each set. Practice runs. Rest weeks that protect the streak. Plate loader for barbell days. It works with no signal.

### What I wish it had
- Rest timer visible as a slim bar, not a sheet.
- Swipe to delete a set, long-press to change set type.
- A notes field per exercise per session, shown next time.
- Plate loader only for barbell lifts; keypad for machines.
- Export in Strong's format.
- Warm-up calculator.
- Apple Watch logging [CLASHES WITH RULE: no native app].
- Plateau notice ("same weight for 4 weeks") [CLASHES WITH RULE: no plateau alerts].

---

## 4. Total beginner

*"I've been going to the gym for three weeks. My friend sent me this link."*

### The intro
97. **Bad.** "Step 1 of 11". I almost closed it. Eleven steps before I can even look at the app. [24](24-intro-home.jpg)
98. **Bad.** Step 10 asks me to set up "two-step sign-in" with an "authenticator app". I don't know what that is and now I'm worried my account isn't safe.
99. **Annoying.** Step 1 tells me to add it to my Home Screen before I know if I like it. "I'll do it later" is a faint red link under a giant red button.
100. **Annoying.** Step 2 is a carousel with 7 dots inside a step that's part of 11 steps. Two progress bars at once. [25](25-intro-what.jpg)
101. **Annoying.** Step 8: "How do you count weight on a barbell? Plates only / Include the bar". I don't know which one is normal. [28](28-intro-train.jpg)
102. **Annoying.** Step 8: "Rep range (optional): Skip to Skip reps". What? [28](28-intro-train.jpg)
103. **Annoying.** Step 8: "Today's targets: suggests the weight and reps to beat last time." I have no last time.
104. **Annoying.** Step 9: ten plans. "PHUL", "Anterior / Posterior", "Torso / Limbs", "Arnold". I picked the one that said Suggested because the rest meant nothing. [29](29-intro-plan.jpg)
105. **Nitpick.** Step 3 asks for weight "For example 72.5". My weight isn't anyone's business on day one. It says "Only you can see it" but my weight also feeds BMI on my profile card.
106. **Nitpick.** Step 5: "Newer lifters get higher reps to learn the moves" is good, but "8 to 12 reps" means nothing yet. [27](27-intro-exp.jpg)

### Jargon on screens
107. **Bad.** "e1RM", "SLDL", "PR · Heaviest", "vol", "top ▲ 2.5" all appear without a word of explanation on the finish screen. [12](12-agent-finish-review.jpg)
108. **Annoying.** "Next assignment", "Next ascent", "Next route", "Next patrol". The theme jokes hide what the card is: your next workout.
109. **Annoying.** "Rotation: Push → Pull → Legs". I don't know what rotation means here or that I don't have to train on fixed days.
110. **Annoying.** "Superset", "drop set", "RPE", "working set" in settings and menus. A glossary exists (ⓘ buttons) but the buttons are small and grey.
111. **Annoying.** "Plates only (no bar)" vs "Include the bar" changes every number in my history. Nobody told me that on step 8.
112. **Nitpick.** "BMI 24.8" on my profile. I didn't ask.

### Knowing what to do
113. **Bad.** First exercise with no history: kg "—", reps "—". What weight do I start with? Nothing helps. [32](32-se-workout.jpg)
114. **Annoying.** "Add machine setup notes" on a dumbbell exercise made me think I was using the wrong equipment. (B5)
115. **Annoying.** No pictures or videos of how to do an exercise. I'm going to do it wrong. [CLASHES WITH RULE: no exercise pictures]
116. **Annoying.** The plate loader shows coloured plates. My gym's plates are all black. I couldn't match them.
117. **Annoying.** The rest timer started on its own and I didn't know if I was allowed to do the next set early.
118. **Nitpick.** "Finish" is red in the top-right corner. Red means stop/danger. I thought it would delete the workout.
119. **Nitpick.** "Energy 1 2 3 4 5" at the end with no label for which end is good. [13](13-agent-finish-save.jpg)

### Feeling stupid
120. **Annoying.** My first finish page called me "RECRUIT · Beginner" on my ID card next to people with real titles. [07](07-agent-me.jpg)
121. **Annoying.** "21% less volume than your last Push" right after my second workout. I felt like I failed.
122. **Nitpick.** "Clean exit. No witnesses." I didn't get the joke.

### Where I'd give up
- Step 10 of the intro.
- The first workout, when the kg box is empty and I don't know what to put.
- When the app says I did worse than last time.

### What's good
It's calm and doesn't shout at me to buy anything. The "Previous" column showed me what I did last time, which is exactly what I needed by week two. The ⓘ explanations are clear once you find them.

### What I wish it had
- A three-step intro: name, plan, start.
- A "beginner mode" that hides RPE, e1RM, supersets.
- A starting-weight helper ("start light, if 12 reps feel easy, go up").
- Short how-to text for each lift [the how-to cue exists in places; show it more].
- Exercise pictures or videos [CLASHES WITH RULE].
- A "what's a good split for me?" quiz instead of 10 names.

---

## 5. Tech bro / gym bro

*"I read the source. Respect for shipping 128 versions without a framework. Now let me ruin your day."*

### Code structure
123. **Bad.** One 548 KB, 5,358-line `app.js` with 387 top-level functions and global mutable state (`S`, `A`, `UI`, `NAV`, `FRIENDS`, `FEED`…). The v121 regression (a patch deleted 11 functions and crashed Today) is exactly what this structure produces.
124. **Bad.** CSS is append-only: 87 `!important`, 18 different z-index values (0 to 9999), and later rules overriding earlier ones for the same class. That's how the friends `.ring` broke the Steps ring (B1). Every new feature's CSS is a regression risk for an old one.
125. **Annoying.** Lines over 1,000 characters (template literals with logic inside). Diffs are unreadable, review is impossible, merge conflicts are guaranteed.
126. **Annoying.** HTML is built by string concatenation with `esc()` called 379 times by hand. One forgotten `esc()` on user text is an XSS. A tagged template that escapes by default would remove the whole class of bug.
127. **Annoying.** 64 `innerHTML` writes. Each re-render throws away DOM state (focus, scroll, selection) and has to restore it by hand (`NAV.keepScroll`).
128. **Annoying.** Tests are four scripts covering fuzzy search, gym builder, ID card and "functions exist". No test for PR logic, sync, volume, plate maths or rotation, which is where the real bugs live (B2 has been there for months).
129. **Nitpick.** Comments name the owner and dates ("Job, 6 Nov"). Fine for you, confusing for any future contributor and slightly leaky in a public repo.
130. **Nitpick.** `owner.html` is a full 735 KB copy of `index.html` in the build output.

### Performance (measured and from the code)
131. **Annoying.** First load: 735 KB HTML (231 KB gzipped) + 111 KB supabase-js, all parsed before first paint. Fine on Wi-Fi, ~2–3 s on gym 4G. The 2.5 s service-worker fallback helps on repeat visits only.
132. **Annoying.** 25 inline `data:` images (SVG wallpapers, webp) live inside the CSS, so every theme's art downloads even though you use one.
133. **Annoying.** Full re-render on most state changes. Long histories (200+ workouts) recompute the index (`ix()`) on every invalidate.
134. **Nitpick.** `setInterval` checks for a service-worker update every 30 minutes, plus on every visibility change. That's a network request each time you unlock the phone mid-workout.
135. **Nitpick.** Wake lock for the whole workout is a battery cost; most trackers only hold it during rest.

### Data safety and sync
136. **Bad.** Last-write-wins per document. Two devices, same month, edits lost. No `updated_at` check on write. app.js:232
137. **Bad.** `jd/meta` holds profile, splits, rotation, custom exercises, setup notes and measurements and is rewritten whole on every small change. A stale tab overwriting it resets your splits.
138. **Annoying.** Cloud load replaces local state wholesale (`S = ns`), except for the active workout. If the pending-writes queue hasn't flushed before load, local edits can lose to older cloud data. app.js:255–270
139. **Annoying.** `localStorage` is the offline store (30 uses). iOS can evict it for Home Screen apps under storage pressure; IndexedDB isn't safer by much, but neither is backed up automatically.
140. **Nitpick.** Backups exist (daily, 14 days), which is better than most hobby apps. But there's no user-facing "restore yesterday" button, so a sync accident still needs you to run SQL.

### Security (good mostly, a few gaps)
141. **Bad.** Supabase Auth public sign-up probably still enabled (dashboard to-do). The edge function's 5-per-hour limit and validation can be bypassed straight through `/auth/v1/signup`.
142. **Annoying.** Feedback owner policy in schema.sql uses a literal `'OWNER_EMAIL'` placeholder. If the live DB was set up from this file without replacing it, nobody can read feedback; if it was replaced, the email is in a policy that's easy to forget when the email changes. schema.sql:41
143. **Annoying.** Photos are base64 JPEG in jsonb/text columns, validated client-side to 110 KB. Make sure the server rejects anything bigger (the docs size check is 1.5 MB per row, which a malicious client can fill with 13 photos).
144. **Nitpick.** CSP is set by a `<meta>` tag (build.py:44), so `frame-ancestors` isn't possible; X-Frame-Options DENY covers it today. Move CSP to a vercel.json header to be safe.
145. **Nitpick.** No Subresource Integrity needed (everything's self-hosted), good. HSTS, nosniff, Permissions-Policy, COOP all present, good.
146. **Nitpick.** Error reports send the user agent and stack line to `jobdone_errors`. Fine, but mention it in the privacy page.

### Scale on free plans
147. **Bad.** DB size: photos in rows + 14 daily copies of every doc. A user with 2 years of history and 50 progress photos is ~5–10 MB, times 14 backups. 500 MB free tier fills at a few hundred active users.
148. **Annoying.** `pg_cron` runs rest pushes every 5 s and reminders every minute: 17,280 + 1,440 jobs a day, logged in `cron.job_run_details` (trimmed daily). Fine at 10 users, noisy at 1,000.
149. **Annoying.** Supabase free plan pauses after a week of no activity. A quiet holiday week and the app is down until you click "restore".
150. **Annoying.** Edge function invocations: free tier is 500k/month. Rest pushes per set × sets per workout × users adds up: 1,000 users × 20 workouts × 20 sets = 400k.
151. **Nitpick.** Vercel free bandwidth (100 GB) is fine until stories with photos go through Supabase egress (5 GB free on Supabase). Egress is the real limit for the feed.

### Breaks first at scale
1. **~200–400 active users:** Supabase 500 MB database (photos + backups).
2. **~500 users posting stories daily:** Supabase 5 GB egress (feed photos downloaded by every friend).
3. **~1,000 users:** edge function invocations from rest pushes.
4. **Any time:** sync conflicts as soon as people use two devices.
5. **Any week with no activity:** free project pause.

### Build and deploy
152. **Annoying.** Every push to main is live with no preview check. A branch preview on Vercel is free and you're not using it to test before merging.
153. **Annoying.** No CI. The four test scripts only run when someone remembers.
154. **Nitpick.** Build needs a magic `JOBDONE_ESBUILD` env var or it produces a giant diff. Put it in a script.

### What's good
Offline-first with a pending-write queue and retries. RLS on everything, service-role only for private tables, restrictive MFA policy. CORS locked to your origin. Size limits on inputs. Daily backups. Honestly better security hygiene than most funded startups.

### What I wish it had
- Split app.js into ES modules (no framework needed).
- Per-workout documents with `updated_at` and merge on conflict.
- Photos in Supabase Storage (1 GB free) instead of rows.
- A GitHub Action running tests/*.js on every push.
- Unit tests for PR detection, volume, plate maths and rotation.
- Scoped CSS per feature (prefix classes: `.fr-`, `.td-`, `.wk-`).

---

## 6. Marketer

*"Is this sellable, to whom, and for how much?"*

### Positioning
155. **Bad.** No clear target user. The app has beginner presets, RPE for advanced lifters, a social feed, spy jokes and climbing jokes. Pick one: "the workout log with personality for people who already lift" is the strongest.
156. **Bad.** The domain `jobdone-peach.vercel.app` kills trust. It looks like a test deploy. Every share card advertises it. (A free alternative: a `.is-a.dev` or `eu.org` subdomain, or keep it until you charge, then buy one with the first revenue.)
157. **Annoying.** The name "Job's Done" is good but generic in search. "Job's Done workout" competes with job-search sites.
158. **Annoying.** The about page has no screenshots of the themes, which are your best visual differentiator.
159. **Annoying.** No landing page that explains "add to Home Screen" to a stranger before asking them to sign up.
160. **Nitpick.** "Early beta" in the Me footer and about page. Fine now, but it makes people wait to commit their training history.

### Growth loops
161. **Bad.** Friends are mutual-only by code. There's no invite link with a reward, no "your friend X joined".
162. **Annoying.** Share cards are free advertising but carry no call to action or QR code to install.
163. **Annoying.** Split share links exist but don't land on a page that sells the app to someone who doesn't have it.
164. **Nitpick.** No referral tracking at all, so you won't know which channel works.

### Differentiators worth money
165. The four themes with their own finish pages, voice lines and share cards.
166. The ID card.
167. Front-and-back stories and the friends board.
168. Plate loader + offline logging.
169. Monthly report.

### Pricing table

| Feature | Free or paid | Why |
|---|---|---|
| Logging, history, previous numbers | Free | The habit. Charging here kills growth. |
| Plate loader, rest timer, keypad | Free | Core logging speed. |
| PRs, body weight, steps, basic charts | Free | People need to see progress to stay. |
| Splits, rotation, presets, split sharing | Free | Sharing spreads the app. |
| Agent theme | Free | One great theme as the default. |
| Summit, Boulder, Skyline + future themes | **Pro** (or $1.99 each) | Pure delight, zero cost to you, strongest "want". |
| Themed share cards (Story size, custom photo) | **Pro** | Creators pay for nicer posts. Keep the basic Post card free with the watermark. |
| Friends: requests, Done Stamps, nudges | Free | The growth loop must stay free. |
| Friends: photo stories, comments | **Pro to post**, free to view | Viewing pulls people in, posting is the upsell. |
| Monthly report + year in review | **Pro** | Classic "Wrapped" upsell. |
| ID card customization | **Pro** | Vanity is a good business. |
| Advanced charts (e1RM per lift, volume by muscle) | **Pro** | Serious lifters pay for analysis. |
| CSV import | Free | Removes switching cost. |
| CSV export | Free | Trust; never lock data in. |
| Rest push notifications | Free | Costs you server runs, but it's core. |
| Gym builder / machine taken | Pro later | Niche, nice. |

### Pricing models
1. **Pro subscription: $3.99/month or $24.99/year** (from memory, check current prices: Hevy Pro roughly $2.99/mo or $23.99/yr, Strong Pro roughly $4.99/mo or $29.99/yr). Sits between them; Hevy is cheaper, so the themes and personality have to be the reason. Best long-term.
2. **Lifetime: $49 one-time** (Strong and Hevy sell lifetime around $75–100). Great for a launch to the first 500 people; funds a domain and paid Supabase if ever needed.
3. **Theme packs: $1.99 each**, no subscription. Lowest friction, smallest revenue.

**Recommendation:** launch with yearly + lifetime only (skip monthly at first; monthly churns and adds support). Keep theme packs as an add-on later.

### Payments and legal (no monthly fees)
170. **Use Lemon Squeezy or Paddle.** Both are free to start, take ~5% + 50¢ per sale, and act as merchant of record, so they handle VAT/sales tax worldwide. That's huge for a solo developer in the Philippines. Stripe has no monthly fee either but leaves the taxes to you.
171. It's a website, so no Apple cut and no in-app purchase rules. Don't wrap it in a native shell later without re-checking App Store rules (they'd require in-app purchase).
172. Needed in the app: a `pro_until` field in a server-only table, written only by a verified payment webhook (an edge function checking the signature), and RLS/feature checks that read it. Never trust a client flag. Prices set in the payment dashboard, never in the client.
173. Legal: update terms (subscription, renewal, refunds: 14 days is standard), add cancel instructions right next to the buy button, a receipts email (the payment provider sends it, so no SMTP needed), and update the privacy page for payment data (handled by the provider, you store only an ID).
174. Philippines: register as a sole proprietor with BIR once income starts (the provider pays you out; income tax is still yours).

### Honest answer: when to charge
- Not now. You have friends using it and no retention data.
- Before charging, you need: a real domain, an onboarding of 3 steps, fixed PR logic (B2), the Steps bug fixed (B1), and 300+ weekly active users with ~40% still active at week 8.
- Add privacy-friendly analytics first (Vercel Web Analytics is free, already on your optional list) so you can measure that.

### What's good
Distinct personality in a crowded category. Share cards are a ready-made acquisition channel. Zero infrastructure cost means any revenue is profit.

### What I wish it had
- Invite links with a reward (a free month of Pro).
- A QR code on share cards.
- A landing page with theme screenshots and a 20-second video.
- A Pro preview: let free users try a theme for one workout.
- A "supporter" badge on the ID card for paying users.

---

## Wishes that clash with your rules

Listed so you can decide; none were acted on.

- Exercise pictures/videos (beginner, influencer) [CLASHES: no exercise pictures]
- Squats/deadlifts in presets (influencer) [CLASHES: presets from Job's lifts only, no squats]
- Plateau notice (gym goer) [CLASHES: no plateau alerts]
- Apple Watch, widgets, Live Activity (reviewer, gym goer) [CLASHES: no native app]
- A welcome/landing screen before sign-in (marketer, beginner) [CLASHES: no welcome screen]
- Google sign-in to cut intro friction (marketer) [CLASHES: email + password only]
- Paid features at all [CHECK: "nothing paid, ever" is about you paying for services; charging users needs your call]

---

## What every persona agreed on

- **The PR logic is too generous.** Reviewer, influencer, gym goer and tech bro all hit it.
- **The Steps card is visibly broken.**
- **The intro is too long** and asks for things too early (Home Screen, two-step sign-in).
- **Too much happens when you log a set.**
- **The themes and finish pages are the best thing about the app.**

## Where they disagreed

- **Target lines:** the beginner wants more guidance, the gym goer wants it gone. Answer: on for new accounts for 4 weeks, then off.
- **Plate loader first:** the gym goer hates the extra tap on machines; the beginner likes the visual. Answer: plate loader first for barbell lifts only.
- **Feed lasting 24 hours:** the influencer wants posts to stay; the tech bro likes that it keeps the database small. Answer: keep stamps 24 h, keep PR posts on a profile.
- **Charging:** the marketer says wait; the tech bro says Pro would pay for Storage if photos grow. Both right: fix storage first (free tier), charge later.
- **Theme jokes:** the influencer loves the voice, the beginner doesn't get "No witnesses". Answer: keep the jokes on finish pages, use plain words on functional labels ("Next workout").

---

Total findings: 174 numbered, plus 12 bugs, plus 38 wishes. Fewer than the 200 asked for: I stopped short of padding with repeats rather than invent problems I didn't see.

---

## Fixed in v129 (7 Nov)

- B1 Steps ring: the friends dots now use their own class (`.fring`).
- B2 PRs: a heavier weight counts only when you match the reps of your old heaviest set. A better estimated max still counts. New test: tests/pr_check.js.
- Set pile-up: a PR now replaces the set message (one banner, not a banner + toast), and banners sit under the workout header so Finish stays visible.
- B3 finish line now follows the current theme. B4 streak badges show once, on the first workout of the week that earned them.
- B5 setup notes only on machines and cables (or when you already wrote one). B6 Job's lift renames only run on Job's account.
- B7 footer no longer says Oct 2026. B8 all seven plates fit in one row. B10 intro button sits at the bottom. B11 "Auto" instead of "Skip". B12 "<1 min".
- Intro: 10 steps. Two-step sign-in removed from the intro (still in Me → Account). Import comes before the plan.
- Today: "Open and edit" is no longer a second red button.
- Copy: target line without the comma splice, energy scale labelled, shorter offline toast, whole numbers in "That's like…".
- A GitHub check now runs every test on each push (.github/workflows/checks.yml).

Corrections to the review: Reduce Motion already turns off all animation (#39 was wrong), and the ⓘ buttons already have a 42 px tap area (#36 was half wrong).
