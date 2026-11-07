# UX, convenience, copy, training content, growth

Experts: #12 UX researcher, #13 Gym ergonomics, #18 UX writer, #19 Strength coach, #25 Growth.

Tested on v134 (branch `claude/expert-review`), offline copy, 390×844 and 375×667. I walked the full intro as a new lifter (3 days a week, "New to lifting", PPL), the tour, Today, the + sheet, a first workout, a second Push a week later, plate loader, keypad, rest timer, exercise done pop-up, finish review, finish page, share sheet, Progress, Me and its settings, Splits, the Friends tab (empty and with a fake post), and the owner path (no crash, no console errors). Screenshots are in `../shots/ux-NN-*.png`.

Not covered here: story camera and review (covered by the frontend/mobile group), real iPhone behaviour (sounds over music, push, keyboard), live friends.

Count: **Broken 2 · Bad 7 · Annoying 16 · Nitpick 12** (37 findings).

---

## Top 10

1. **Broken.** Targets, set messages and pre-filled reps ignore the plan's rep range. A new lifter's plan says 8–12 reps, but the app uses 6–9 everywhere in the workout, so 40×12 becomes a pre-filled 42.5×6.
2. **Broken.** "Next set →" on the keypad doesn't tick the set, though the tour says it does. The set stays open: no rest starts and it isn't counted.
3. **Bad.** The app tells people to change weight and reps: targets are on by default, heavier weights are pre-filled, and a "Use 45 kg for your next sets?" pop-up appears. The brief says the app must never do this. Job decides.
4. **Bad.** Tapping ✓ on an empty set logs it. No kg and no reps, but "1 / 18 sets" goes up and rest starts.
5. **Bad.** Typing "8.5" on the reps keypad saves **85 reps**. The "." key works on reps and gets dropped.
6. **Bad.** The plate loader on machines (Chest Fly = pec dec) starts with "Empty 20 kg bar" and "Use 20 kg". Machine weights get logged with a bar that isn't there.
7. **Bad.** The intro is still 10 steps, then a 6-slide carousel, then an 18-step tour: 34 screens before the first set. Body weight is required on step 3.
8. **Bad.** In the intro, the "Sounds and alerts" screen is broken. An unclosed section nests "Notifications" and "During workouts" inside the Sound box.
9. **Bad.** Logging a PR stacks three layers (PR banner, rest sheet, "Use 45 kg?" sheet). The "Exercise done" pop-up sits over the next lift's first set while the rest sheet hides the rest.
10. **Annoying.** A first-ever workout's review says "Compared with last time", and every row reads "top first time · vol" with nothing after "vol".

---

## Findings

### Workout and training content

**1. Broken. The rep range in the workout isn't the plan's rep range.** (#19, #12)
- Where: app.js:2622 `repRange()` falls back to `[6, 9]`. It's used for the target line (app.js:2744), the set message (`setVerdict`, app.js:2967) and the pre-fill. The split's own `repMin/repMax` are never read. `tgt` is computed at app.js:2741 and never used.
- How to see it: in the intro pick "New to lifting · 8 to 12 reps". The split page says "3 sets × 8–12 reps" ([33](../shots/ux-33-split-editor.png)). Log Chest Fly 40×12. Next Push pre-fills **42.5 × 6** with "Target: +2.5 kg on every set (you hit 9+ reps last time)" ([18](../shots/ux-18-week2-prefill-target.png)). Logging 10 reps says "Top of your range" ([15](../shots/ux-15-set-logged.png)). The intro's Training defaults step says "Leave it on Auto and we'll use 6 to 9" right after the beginner picked 8 to 12 ([06](../shots/ux-06-intro-train.png)).
- Why it matters: a beginner is told to add weight and cut reps to 6, which is below their own plan. One app, three different rep ranges.
- Fix: one source of truth. Per exercise use `tgt.repMin/repMax`, then `profile.repRange`, then the experience range. Pass the range into `setVerdict` and the target line. Change the intro text to "Not sure? Leave it on Auto and we'll use your plan's range."

**2. Bad (Job's call). The app tells people to change weight or reps.** (#19, rule check)
- Where: target line app.js:2744 (on by default, `targets: true` app.js:4626); heavier pre-fill; "Use 45 kg for your next sets? 2 sets of Chest Fly are set lighter" app.js:3034 ([19](../shots/ux-19-pr-set-logged.png)); tour mock "Nearly time to add weight." app.js:4551.
- Why it matters: the brief's rule is "the app must never tell people to change weight or reps", and CLAUDE.md bans "advice telling Job to change weight/reps". The plateau alerts are already switched off (app.js:3590). This is the same kind of advice, shown on every set.
- Fix (pick one with Job): (a) pre-fill last time's numbers, keep targets off by default and keep the switch; (b) keep targets but drop the "Use 45 kg for your next sets?" pop-up and the "Nearly time to add weight" mock. Both are cheap.

**3. Broken. "Next set →" doesn't log the set.** (#13, #18)
- Where: keypad handler app.js:3976 only moves to the next box. Tour step app.js:1029 says "Tap Next and this one gets ticked for you."
- How to see it: tap kg → load a plate → Use → type 10 → Next set →. Set 1 shows 40/10 but isn't ticked, no rest, "0 / 18 sets" ([14](../shots/ux-14-after-next-set.png)).
- Why it matters: people trust the tour, rush through sets with Next and end up with open sets, no rest timer and missing volume.
- Fix: in the `next` branch on the reps field, call `logSet(ei, si)` when the set has a weight and reps and isn't done. Or change the tour line to "Next moves you to the next set. Tap ✓ to log it."

**4. Bad. An empty set can be logged.** (#13)
- Where: `logSet` app.js:3006 has no check for `w == null || r == null`.
- How to see it: day 1, tap ✓ on a blank row. It's ticked, "1 / 18 sets" and rest starts ([11](../shots/ux-11-check-empty-set.png)).
- Why it matters: a sweaty mis-tap makes a fake set that counts toward sets and streaks. A beginner may think ✓ means "start this set".
- Fix: when either box is empty, open the plate loader/keypad for that box instead of ticking.

**5. Bad. "8.5" reps saves as 85.** (#13, #21)
- Where: keypad app.js:3978. The "." key is live on the reps field, and the value is saved as a whole number.
- How to see it: open reps, type 8 . 5, Done → "85 reps" ([30](../shots/ux-30-reps-dot-becomes-85.png)).
- Why it matters: one fat-finger gives a bogus set, volume and maybe a "most reps" PR.
- Fix: hide or disable "." when `f === 'r'`.

**6. Bad. Plate loader adds a bar on machines.** (#19, #13)
- Where: `openPlates` app.js:3861. The bar comes from the profile for every exercise.
- How to see it: Chest Fly (machine) → kg → "Empty 20 kg bar", "Use 20 kg" ([12](../shots/ux-12-plate-loader-machine.png)).
- Why it matters: every preset lift except SLDL is a machine or cable, so a new account logs pec dec and pulldown weights 20 kg too heavy, or has to dig into "Bar, custom plates" each time.
- Fix: keep the loader first (Job's rule). Start with bar 0 ("Plates only") when `exInfo(name).equip` is machine, cable or Smith-less. For pin-stack machines, say "Machine stack · tap plates to add up the pin weight".

**7. Annoying. The workout never shows the rep range, and day 1 has no hint.** (#12) Still open from REVIEW.md #113 and #30.
- How to see it: first Push, every box is "–" with no "8–12 reps" anywhere on the card ([10](../shots/ux-10-after-start.png)). The range only appears on the split page.
- Fix: put "3 × 8–12" in the Reps column header or under the exercise name. Use it as the reps placeholder on day 1.

**8. Annoying. The set message is wrong one rep below the range.** (#19)
- Where: `setVerdict` app.js:2970. `r <= lo` returns "Right in the range", so 5 reps on a 6–9 range is "in the range".
- Fix: `if (r < lo) 'Below your rep range.'; else if (r < hi) …`.

**9. Nitpick. The Bro split uses lifts outside Job's foundation list.** (#19)
- Where: app.js:4532, "Chest Press" (Chest day) and "Reverse Pec Deck" (Shoulders day). CLAUDE.md: presets only from the foundation lifts.
- Fix: Chest = Chest Fly, Incline Press, Incline Press (Smith via swap) or just two lifts. Shoulders = Shoulder Press, Lateral Raise.

### Logging ergonomics (gym)

**Core loop tap count.** Day 1: Start (1) → kg (1) → plate (1+) → Use (1) → reps digits (2) → Done (1) → ✓ (1) = **8 taps**, and rest starts by itself. From week 2, with numbers pre-filled: Start (1) → ✓ (1) = **2 taps**. The week-2 loop is good. The problem is that what gets pre-filled is a target, not last time (finding 2).

**10. Bad. Too much lands on screen after a set.** (#13) Still open from REVIEW.md #3, #27 and #72.
- How to see it: a heavier first set shows the PR banner over the exercise name, the rest sheet over the bottom half and the "Use 45 kg?" sheet on top ([19](../shots/ux-19-pr-set-logged.png)). Finishing a lift shows the "Exercise done" pop-up for 7 s exactly over the next lift's set 1. The rest sheet hides the rest, so only sets 2 and 3 of the next lift are visible ([31](../shots/ux-31-exercise-done-popup.png)).
- Fix: drop the "Use X kg?" sheet (finding 2). Show "Exercise done" as a line at the top under the header, not over the next card. Make the rest timer a slim bar above the tab bar.

**11. Annoying. Tap targets in the set row are small and packed.** (#13)
- Measured: ✓ 44×38 px, kg/reps cells 67×36, rows 42.5 px tall, and the set-number button (opens set type) 30×40 right next to Previous ([26](../shots/ux-26-se-workout.png)).
- Why it matters: with sweaty fingers, hitting the row above changes the wrong set. A mis-tap on "1" changes the set type.
- Fix: rows ≥ 48 px, ✓ 48×44, cells 44 px tall.

**12. Annoying. The workout header still wraps on an SE.** (#13) Still open from REVIEW.md #10.
- "Started 5:39 pm · <1 min · / Today ▾" breaks onto two lines. The first card starts at 147 px, and about 1.4 exercises fit ([26](../shots/ux-26-se-workout.png)).
- Fix: drop "Started" ("5:39 pm · 1 min") and move the date picker into the ⋯ menu.

**13. Nitpick. Pre-filled numbers look the same as logged ones.** (#13) Target values are bold white like real entries ([18](../shots/ux-18-week2-prefill-target.png)). From a metre away you can only tell done rows by the ✓ colour. Fix: pre-fills at 60% opacity until edited or ticked.

### First run (intro and tour)

**14. Bad. 34 screens before the first set.** (#12, #25)
- Intro is "Step 1 of 10" ([01](../shots/ux-01-intro-step1.png)). CLAUDE.md says 9. Step 2 is a 6-slide carousel. Then an 18-step tour starts right away on Today, with its first bubble covering "Start Push" and a "You're all set" toast at the same time ([09](../shots/ux-09-today-new-agent.png)).
- Step 3 refuses to continue without body weight: "Add your weight today so your charts have a starting point." ([03](../shots/ux-03-intro-you-weight-required.png)).
- Why it matters: this is where beta friends drop off. Weight is personal, and the field isn't marked as required until you fail.
- Fix: 9 steps (fold "Moving from another app" into the plan step as a "Bring your history" link). Make weight optional. Split the tour: 4 Today steps now, and the 8 workout steps the first time a real workout opens.

**15. Bad. The "Sounds and alerts" step is broken.** (#12)
- Where: app.js:4586. The Sound `<section><div class="sgrp">` is never closed, so the next two groups render inside it, indented ([05](../shots/ux-05-intro-prefs.png)).
- Also: when not on the Home Screen, "Notifications" holds only "Daily weigh-in", which is an in-app pop-up, not a notification.
- Fix: close `</div></section>` after the sound row. Move "Daily weigh-in" under its own "Reminders" heading.

**16. Annoying. The suggested plan is 3rd of 11.** (#12) "Full body · Suggested" sits under PPL and Upper/Lower ([08](../shots/ux-08-intro-plan.png)). Fix: put the suggested plan first and fold the rest under "See all plans".

**17. Annoying. The daily weigh-in is on by default and asks every day.** (#12) The Me text says "Asks once a day until you log a weight" (app.js:2535). CLAUDE.md: no nagging about measurements. Fix: default off for new accounts (Job's call).

**18. Annoying. Height is always in cm.** (#12) With lb picked, the label stays "Height (cm)" ([03](../shots/ux-03-intro-you-weight-required.png)). Fix: show ft/in when lb is chosen.

### Finish and sharing

**19. Annoying. First workout shows a comparison with nothing.** (#12, #18) "Compared with last time", and every row reads "top first time / vol" with an empty value ([16](../shots/ux-16-finish-review.png)). Fix: on a first time, title the card "Your first Push" and show only the sets.

**20. Annoying. The Agent Post card silently drops lifts.** (#25)
- Where: app.js:3349-3350 `if (y > CH - 120) break;`. The sheet says "Up to 5 fit on this card" with 5 ticked, and the preview shows 3 ([28](../shots/ux-28-share-sheet.png)).
- Fix: set `SHARE_MAX.mono` for Post to the real number (3), or shrink the line height.

**21. Annoying. The share card does little for growth.** (#25) Still open from REVIEW.md #52 and #156.
- The URL is tiny ("RECRUITING · JOBDONE-PEACH.VERCEL.APP"), "PRS 0" shows by default, and on the finish page Share is the grey button while Done is red ([17](../shots/ux-17-finish-page.png)).
- Fix (free): add the friend code to the workout card like the ID card already does (the "Friend code on shared picture" switch). Turn the PRs stat off when it's 0. Make the URL line readable at 1080 px.

**22. Nitpick. "TARGETS" on the Agent card means the list of lifts.** In the app, "Target" means the weight suggestion. Fix: "LIFTS" or "OBJECTIVES".

### Friends

**23. Annoying. The empty Friends tab doesn't explain itself.** (#12, #25) It shows "Tell friends I'm at the gym" with zero friends, "No friends yet." and two add buttons (icon + red) ([20](../shots/ux-20-friends-empty.png)). Fix: hide the gym button until you have a friend. Write "Swap codes with a friend to see each other's workouts. Your code: JD-XXXXXX [Copy]" with one button.

**24. Annoying. The status under friends' faces says "Not yet".** ([27](../shots/ux-27-feed-post.png)) It reads like a pending request. Fix: "No workout yet" or "Rest day?".

**25. Annoying. Post stats get cut off.** "1 h 12 ..." in the Time box ([27](../shots/ux-27-feed-post.png)). Fix: "1:12" or "72 min".

**26. Nitpick. The ID card help points to the wrong place.** app.js:1418: "Friends type this in Me → Friends". Adding a friend now lives in the Friends tab. Fix: "Friends type this in Friends → Add a friend."

### Retention and What's new

**27. Annoying. What's new is a 17-item wall you can't reopen.** (#25) app.js:1099. It mixes week-old and today's items, and two are about the same thing ("Friends at the bottom", "Friends… Tap Friends at the bottom"). Help has no link back to it. Fix: show only the items since that person's last update, keep 3–5 lines, and add "What's new" under Help.

**28. Nitpick. Me promises a daily reminder that isn't there.** "Reminders and sounds · Daily reminder, weigh-in pop-up, sounds" (Me). The page has no daily reminder (it's on an unmerged branch). Fix: "Weigh-in pop-up, sounds" until reminders ship.

### Copy and naming

**29. Annoying. "Next up" has five names.** Still open from REVIEW.md #2 and #108. The card says "Next assignment / ascent / route / patrol", while the tour (app.js:1018), the + sheet and Splits say "Next up" ([24](../shots/ux-24-plus-sheet.png), [25](../shots/ux-25-se-today-mono.png)). Fix: plain "Next up" on functional labels and theme voice on finish pages only. Or the tour uses the theme word.

**30. Annoying. Copy mentions Claude to real users.** app.js:4509: "In the Claude version, use Me → Export JSON." (any wrong backup file). app.js:2581 says "Sign in to Claude…" (offline mode). Also the Me button is called "Export backup (JSON)".

**31–37. Nitpicks.** "Done Stamp" (intro, What's new) vs "post" / "Finished a workout" (feed). Rep range "Auto" (intro) vs "Skipped means 6 to 9" (Me). "Start rest automatically" vs "Start rest after each set". "Daily weigh-in" vs "Morning weigh-in pop-up". "Rest finished" vs "Rest alerts". Steps empty state says "see Me → Apple Health", but the Me row is "Steps". Errors mix "Could not" / "Couldn't" and "Check your connection" / "Check your signal and try again". The intro bar note says "20 kg plates" in lb mode. "Clean exit. No witnesses." is still on a beginner's first finish page (still open from REVIEW.md #45).

---

## Copy fixes

| Where | Before | After |
|---|---|---|
| Intro, Training defaults (app.js:4605) | Not sure? Leave it on Auto and we'll use 6 to 9. | Not sure? Leave it on Auto and we'll use your plan's range. |
| Me → Workouts, rep range | Optional. Your desired rep range before moving up a weight. Skipped means 6 to 9 | Optional. Leave it on Auto to use each plan's range. |
| Tour step "Log the set" (app.js:1029) | Tap ✓ when the set is done, or swipe the row right. Tap Next and this one gets ticked for you. | Tap ✓ when the set is done, or swipe the row right. (Or make Next tick it: finding 3.) |
| Tour slide 2 mock (app.js:4551) | Strong set / Nearly time to add weight. | Strong set / Top of your range. |
| Set message (app.js:2970), r = lo−1 | Right in the range. | Below your rep range. |
| Intro step 3 error | Add your weight today so your charts have a starting point. | (make optional; no error) |
| Intro, Sounds and alerts heading over weigh-in | Notifications | Reminders |
| Me → Reminders and sounds subtitle | Daily reminder, weigh-in pop-up, sounds | Weigh-in pop-up, sounds |
| Finish review, first time | Compared with last time · top first time · vol | Your first Push |
| Share sheet, Agent Post | Up to 5 fit on this card. | Up to 3 fit on this card. |
| Agent share card header | TARGETS | LIFTS |
| Friends tab, empty | No friends yet. [Add a friend] + "Tell friends I'm at the gym" | Swap codes with a friend to see each other's workouts. Your code: JD-XXXXXX [Copy] [Add a friend] |
| Friend face status | Not yet | No workout yet |
| Post Time box | 1 h 12 min (cut to "1 h 12 …") | 1:12 |
| ID card help (app.js:1418) | Friends type this in Me → Friends to send you a request. | Friends type this in Friends → Add a friend to send you a request. |
| Backup import error (app.js:4509) | That file isn't a Job's Done backup. In the Claude version, use Me → Export JSON. | That file isn't a Job's Done backup. Use Me → Account and data → Export backup (JSON). |
| Offline note (app.js:2581) | Saved in this browser only. Sign in to Claude and open the link there to keep it in your account. | Saved on this phone only. Sign in to keep it in your account. |
| Steps empty state | …(see Me → Apple Health). | …(see Me → Steps). |
| Me → Workouts | Start rest after each set | Start rest automatically (same as intro) |
| Me → Reminders | Morning weigh-in pop-up | Daily weigh-in (same as intro) |
| Intro bar note, lb mode | Two 20 kg plates on a 20 kg bar logs as 60 kg. | Two 45 lb plates on a 45 lb bar logs as 135 lb. |
| Intro tour slide 5 / What's new | Your Done Stamp goes to them when you finish. | Your workout shows up in their feed when you finish. |
| Errors (all) | Could not reach… / Couldn't… Check your signal and try again. | Couldn't … Check your connection and try again. (one form) |
| Bro split, Chest/Shoulders (app.js:4532) | Chest Press · Reverse Pec Deck | (remove; foundation lifts only) |
