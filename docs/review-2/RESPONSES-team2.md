# Team 2 responses (correctness, copy, legal, safety)

Branch `worktree-agent-abbf0217e06069a84`, based on `claude/expert-review` (259404b). Nothing pushed, merged or deployed. No SQL was run. Service worker version not bumped. `NEWS` not touched.

Checks: all `node tests/*.js` pass, plus a new `tests/reprange_check.js`. Walked the intro and tour offline in Playwright at 390×844, and tested the owner path (`S.profile.owner = true`, every tab) with no console errors. Screenshots are in `after/t2-*.png` (Agent and Boulder).

| Finding | Status | Commit |
|---|---|---|
| ux 1: rep range ignored, fixed 6–9 | Done. Order is: range set in Me, then the split's range for that lift, then the intro experience, then 6–9. Covers targets, pre-fills, the target line and set messages. Checked: 40×12 on 8–12 pre-fills 42.5×8. The intro and Me text now say "Auto uses your plan's range". A range picked in the intro also goes into the new splits. | b765a04 |
| ux 8: set message one rep under the range | Done ("Below your rep range.") | b765a04 |
| ux 2 / lead: weight advice | Per-set targets kept. "Use X kg for your next sets?" pop-up removed. Tour mock "Nearly time to add weight" changed to "Top of your range". | b765a04 |
| ux 6: plate loader on machines | Done. Machines and cables start at 0 with plates only. Changing the bar there doesn't change the barbell setting. Smith lifts keep the bar. | 89ead30 |
| ux 19: first workout review | Done. Shows "Your first <split>" with no empty "vol". If only some lifts are new, those rows just say "first time". | d0389c4 |
| ux 14/15: intro | Done. 9 steps: "Moving from another app" is now a "Bring your history" link on the plan step. Body weight is optional (still checked if filled in). The Sound section is closed. Daily weigh-in sits under "Reminders". Notifications only shows when it has a switch. | d9405c8 |
| ux 14: 18-step tour | Done. Cut to 9 steps: Next up, Friends, Settings, Start, Your workout, Weight and reps, Log the set, Rest timer, Finish. Also fixed the Settings step, which was always skipped. | d9405c8, 330611f |
| ux copy table | Done for every row except the What's new line (NEWS belongs to the lead). Done Stamp → "Your workout shows up in their feed" on the intro slide. For "Post Time 1:12", new posts store "1:12" (postHTML untouched). The friends empty state shows your code with Copy, and the gym button only appears once you have a friend. | c4a5505 |
| Agent Post card "Up to 5 fit" | Done. The Post size limits picks to the 3 it draws. Story keeps 5. | c4a5505 |
| Bro split outside foundation lifts | Done. Chest = Chest Fly + Incline Press, Shoulders = Shoulder Press + Lateral Raise | c4a5505 |
| "In the Claude version" / "Sign in to Claude" | Removed | c4a5505 |
| Me promises a daily reminder | Removed ("Daily weigh-in, sounds") | c4a5505 |
| ID card help "Me → Friends" | Fixed in the help line and on the shared ID picture | c4a5505 |
| What's new can't be reopened | Me → Help and about → What's new | c4a5505 |
| legal L1/L2/L12: gym scan | Turned off (`GYM_SCAN_READY = false`). Privacy text about Gemini removed. The `gym-scan` edge function and the MediaPipe files are still deployed. Job can delete the function and the Gemini key later. | b68efd2 |
| back B8 / legal L4: reports | Post reports now carry the split, caption and line (no photo), and the inserted error is checked. Comments can be reported the same way. Offline, both show "Couldn't send the report". The `jobdone_reports` table, auto-hide after 2 reports and the owner moderation tools are **not done**: too big for this batch, and they need a security check. | fd9a811 |
| legal L3: block | Block is in a friend's post ⋯ menu and on their ID card. If the server function is missing, it shows "Couldn't block. Try again later." `supabase/block.sql` is written, **not run**. | fd9a811 |
| legal L5/L6/L7/L9/L10/L13: privacy, terms, about | Done, and they only promise what exists: who can see what, comments, at-the-gym status, blocks, reports with a text copy, legal basis, transfers, what stays on the phone, rights including an NPC complaint, and a breach notice. The Terms say "Early beta" and include posting rules, the right to remove content, and Philippine law. No log trims, no emails, no response-time promise. Contact is Me → Send feedback, with no bracket placeholders. | baff86b |
| legal L11: licence credits | Credits line on the about page (react-muscle-highlighter MIT, Permanent Marker and MediaPipe Apache 2.0, supabase-js MIT). **Not done:** full licence text files next to the font, the MediaPipe folder and body.json. | baff86b |
| legal L8: minimum age | Left at 13, as asked. | n/a |

## For Job

- **Run `supabase/block.sql`** in the SQL editor when you're happy with it. Until then, Block just shows the "try again later" toast. First check that `jobdone_friend_requests` has `from_id` and `to_id` columns (the query is at the top of the file). The live friend-request function isn't in the repo, so the file adds insert triggers that refuse blocked pairs instead of rewriting that function. Still missing: comments a blocked person left on a mutual friend's post still show, and there's no unblock button.
- **Add a public contact email** (a free Gmail is fine) to privacy.html and terms.html. Today the only contact is in-app feedback, which someone who is signed out or deleted can't reach.
- **Minimum age** is still 13. The review suggests 16 (EU) and asks you to check with the NPC about under-18s in the Philippines.
- **Your own targets may change:** with no range set in Me, targets now follow each split's rep range (often 6–10) instead of 6–9. Set a range in Me → Workouts to keep 6–9.
- New posts show time as 1:12. Older posts keep "1h 12m".
