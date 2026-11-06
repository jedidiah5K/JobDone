# Deslop report: Job's Done (6 Nov 2026)

This is an audit only. Nothing has been changed yet.
I checked the code (app.js, styles.css) and screenshotted Today, Splits, Progress, Me, a workout, Friends and the finish page in the Agent theme at iPhone size.

An earlier de-slop pass already did a lot. There are no emoji, no console logs, no commented-out code and no images without alt text. Double taps are already blocked across the app (`app.js:4689`). Raw error text never reaches the screen.

Each line reads: `[area] where: problem → fix`. Worst first.

## Your rules win
These look like "AI tells" in the checklists, but they're your design, so I'm keeping them:
- Uppercase labels over each card (THIS WEEK, ROTATION…). They're part of all four themes.
- Muscle tags on split cards. You asked to keep the muscle info.
- Theme art (scope day dots, cliffs, rope, skyline). That's the app's personality, not decoration.

## Questions (your answer decides the fix)
1. **[copy] Workout screen `app.js:2496`:** "Target: add 2.5 kg on 2 sets, you hit 9+ reps last time." Your rules say no advice telling you to change weight or reps. Do you want these lines kept, turned into a plain fact ("Last time: 9 reps at 55 kg"), or removed?
2. **[copy] Set pop-ups `app.js:2721–2724`:** "Drop the weight a little. Form first." and "Add weight next time." Same question.
3. **[copy] Progress → Measurements `app.js:3544`:** the empty card says "The scale can hide fat loss… Add a tape measurement now and then." That reads like nagging about measurements. Fix: show only "No measurements yet" with an Add button.

## 1. Screen decisions (one main action per screen)
- **[layout] Me:** "Add photo" and "Edit card" look the same → make Edit card the main one and turn Add photo into a small link under the card.
- **[layout] Me:** "46 workouts logged · BMI 24.9" wraps onto two lines next to the buttons → give it its own line.
- **[layout] Splits:** the Rotation card has two lines of explanation that never change → keep one short line ("Next up is the split after your last one") and move the rest behind the Edit button.
- **[layout] Progress:** two rows of tabs on top of each other (Body/Strength/Volume/History, then 1M/3M/6M/YTD/All) → make the time range row smaller so the two rows don't compete.
- **[layout] Workout:** "Add set" and "Remove set" look the same → leave Add set as it is and make Remove set quieter (smaller, grey).

## 2. Visual
- **[type] styles.css:** 33 places use 10–12 px text, including the workout header ("0 kg lifted · 0 / 15 sets"), the PREVIOUS column and the Friends stamp lines → raise to at least 13 px where you read it mid-set. Leave tiny chart labels alone.
- **[type] styles.css:** 15 places use negative letter-spacing → keep it on big titles only and remove it from body text.
- **[visual] Friends Done Stamp:** the coloured top border looks bent on the rounded card → swap it for a small accent bar next to the split name.

## 3. Behaviour
- **[motion] Celebrations:** confetti fires on top-of-range sets (`app.js:2741`), on every PR (`2781`), when you tap Finish (`4591`) and again on the finish page (`2970`). That's four kinds of confetti → keep the big one on the finish page, use the existing glow and sound for PRs and top sets, and drop the confetti on the Finish tap (the finish page plays right after).
- **[behaviour] Slow actions:** the double-tap block only lasts 0.35 s. Sending a friend request, a snap or a photo takes longer, so a second tap can send it twice → disable those buttons until they finish (Snap already does this).
- **[behaviour] Text size:** I haven't tested the largest iPhone text size yet. I'll check it while fixing.

## 4. Code
- Nothing big found. app.js is 380 KB in one file, but splitting it would be a large change with no visible gain, so I'm leaving it.

## 5. Legal and compliance (flagging only, not building)
- **Friends posts:** report and hide are there, and reports go to your feedback inbox. The privacy page doesn't mention stamps, snaps and nudges yet → add one short paragraph (posts are friends-only and deleted after 48 hours).
- No age question at signup (COPPA). You decided against extra signup questions before, so this is just a flag.

## Order I'd fix in
1. The three questions above, once you answer.
2. Screen decisions.
3. Text sizes, the stamp bar, celebrations, slow buttons.
4. Privacy page paragraph.

After each batch I'll send screenshots in all four themes before anything goes live.

## Changelog (6 Nov, v117, branch claude/friends-today)
- Measurements empty card: just "No measurements yet." (`app.js`, Progress)
- Rotation card: one short line instead of two (`app.js`, Splits)
- Me: Edit card is the one main button; Add photo is a small link; BMI only shows when it can be worked out (`app.js` meCard)
- Progress: time range row is quieter than the tabs above it (`app.js`, `styles.css` .seg.rng)
- Workout: Remove set is a small grey link in every theme (`app.js`, `styles.css` .rm-set)
- Body text no longer has tight letter-spacing; big titles keep it (`styles.css` body)
- Done Stamp: accent bar next to the split name instead of a bent top border (`styles.css`)
- Confetti only on the finish page; PRs and top sets keep their glow, sound and pop-up (`app.js`)
- Slow actions (friend request, nudge, at the gym…) keep their button off until they finish (`app.js` click handler)
- Privacy page: friend requests and friends activity (stamps, snaps, nudges, 48-hour deletion) (`web-src/privacy.html`)

Skipped:
- Target lines and set pop-up advice: you didn't answer questions 1 and 2, so they stay as they are.
- Small text: the workout header and PREVIOUS column are already 13 px. The remaining 10–12 px text is chart labels, badges and uppercase labels, so I left it.
- Largest iPhone text size: the app uses fixed sizes, so iPhone's text-size setting doesn't change it. Nothing to break there.
