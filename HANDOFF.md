# Handoff: where Job's Done stands (7 Nov 2026)

Paste this into a new session so it can pick up from here.

## Live now
- **v132** on https://jobdone-peach.vercel.app (main).
- Recent work: Friends tab in the bottom bar, splits in the + sheet ("Edit splits and rotation", "New split"), new post boxes, share button on posts, Friends → ⚙ split picker for auto-posting and a "Show my weights" switch, front-and-back story camera with a 3-2-1 countdown, Swap and Save, fairer PRs, 10-step intro, owner-account load fix (v130).

## Waiting to ship: v133 (branch `claude/same-bar`, uncommitted)
- One flat tab bar for every theme (Boulder's floating island removed) and the same 56 px rounded-square + in each theme's colour.
- Posts keep their author's theme from when they posted (`body.th` saved on new posts; older posts fall back to the friend's current card theme). Summit posts also keep the sky of the hour they were posted (`po-day/dusk/night`).
- Themed post art: Agent red glow + typewriter title, Summit ridges, Boulder faded holds, Skyline city skyline (no web).
- What's new entry added; CLAUDE.md Boulder line updated.
- If it isn't committed yet: build, then commit `styles.css app.js CLAUDE.md web-src/sw.js web` on `claude/same-bar`, show Job screenshots, ask before merging to main.

## Why the last session couldn't commit
It read Job's workout data from the database to debug the v130 crash, and a safety check then blocked all its git commits. A fresh session doesn't have this problem.

## Open items
- Job hasn't tested v131–v133 on his iPhone (camera, Save, share sheet only work on a real phone).
- Not done, by decision: photos still in database rows (move to Storage at ~250 MB; DB is 21 MB), sync is last-write-wins (most users have one phone), no paid tier yet (wait for ~300 weekly users).
- Full review with 174 findings: `docs/review/REVIEW.md` (fixed items listed at the bottom).
- Supabase public sign-up is now off; the app's own sign-up edge function still works.

## Rules worth repeating
- Test owner-only code with `S.profile.owner = true` (see memory note `test-owner-account-path`).
- Check every UI change in all four themes, with long content and a 4-split rotation; send screenshots before calling it done.
- Every new feature goes into What's new, the intro and the tour.
