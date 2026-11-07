# Job's Done: expert panel review (v134, 7 Nov 2026)

Six expert groups covered 28 roles. Each one read the code, ran the app offline at 390×844 and 375×667 in all four themes, and wrote findings with file:line and proof. Full findings are in `findings/`, screenshots in `shots/`, redesigns in `mockups/`, and code drafts in `patches/`.

| Group | File | Broken | Bad | Annoying | Nitpick |
|---|---|---|---|---|---|
| Frontend, reliability, data, QA, architecture | findings/front.md | 4 | 9 | 9 | 4 |
| Backend, security, privacy, free tier | findings/back.md | 1 | 6 | 6 | 7 |
| Legal, copyright, safety, AI | findings/legal.md | 0 | 8 | 4 | 6 |
| UX, gym use, coaching, copy, growth | findings/ux.md | 2 | 7 | 16 | 12 |
| Visual, themes, motion, accessibility, AI slop, iPhone | findings/visual.md | 2 | 6 | 8 | 11 |
| Performance | findings/perf.md | 0 | 4 | 5 | 7 |
| **Total (166)** | | **9** | **40** | **48** | **47** |

Not covered: a real iPhone (Home Screen mode, camera, share sheet, Save Image, push, VoiceOver, real text sizes) and the live backend with real friends. Findings that depend on these are marked "from the code".

## Top 15

1. **Anyone with your friend code can friend you without your accept.** An old `jobdone_friend_add` function is still live in the database. Your code is on the ID picture. *Fix ready (back-01.sql). Needs Job's yes to run.*
2. **A workout finished offline is wiped when the phone reconnects.** The resume refresh overwrites unsent sets. *Confirmed. Patch front-01.*
3. **Sign out deletes unsynced sets.** *Patch front-02.*
4. **Double tap on ✓ logged then un-logged a set.** *Fixed in batch 1.*
5. **Restoring a bad backup blanks the app on every launch** and can upload the bad data. Restore also drops setup notes and measurements. *Patch front-05.*
6. **Workouts ignore the plan's rep range.** They always aim for 6–9, so a beginner on 8–12 gets 42.5×6 pre-filled after 40×12. *To fix next.*
7. **The app still nudges weight and reps.** Targets are on by default, heavier weights get pre-filled, a "Use 45 kg for your next sets?" pop-up appears, and the tour says "add weight". This clashes with Job's rule. *Job's call.*
8. **A friend could inject a link into your feed or crash your Today screen.** *Fixed in batch 1.*
9. **The gym scan sends photos to Gemini's free tier.** That tier isn't allowed for EU/UK users and shouldn't get personal data. The face blur is a selfie model, so it misses people across a gym. *Job's call: switch it off, or limit and preview it.*
10. **One account can fill the free 500 MB database in about two weeks** (20 MB of docs × 14 daily backups). Feedback has no rate limit. *back-02, back-04 SQL.*
11. **There's no block, comments can't be reported, and a report keeps no copy** of a post that deletes itself in 48 h. Job has no way to remove a post except raw SQL. *Needs building.*
12. **The privacy page doesn't match the app.** It says "only you can see your data" and "no location", but comments, the "At the gym" status and friend codes exist. There's no named contact, legal basis for health data, NPC complaint right or breach promise. *Draft text in patches/legal-privacy-additions.md.*
13. **The Friends tab re-downloads every photo on each tap** (about 5 MB with 10 friends), and each phone unlock reloads the whole history. The free tier covers about 20 daily users today and about 80–100 after the fixes. *perf-04, perf-06, perf-07.*
14. **Contrast failures:** the Summit-day PR pill is blank (1.5:1), Boulder friend avatars are white on cream (1.1:1), and the + on Summit at dusk/night is 2–2.5:1. *Small CSS fixes.*
15. **Logging a set covers half the screen** (rest sheet plus banner plus PR pill). A slim rest bar already exists in code. *Mockup vis-workout shows it as the default.*

## Decisions for Job

- **Weight and rep suggestions (#7):** remove targets, pre-fill and the "Use X kg?" pop-up, or keep them as an opt-in.
- **Gym scan (#9):** turn it off, or keep it with a preview before upload and hide it for EU/UK.
- **Minimum age:** 13 today. EU countries want 16, and the Philippines treats under-18s as minors. Confirm with the NPC.
- **Two theme rules pull against each other:** Boulder's boxed set cells make cards 16 px taller than other themes, which breaks "identical heights". Keep the boxes, or match the heights.
- **Service worker:** opening from the cache is faster, but a new version then shows on the second launch. The other option is a "new version, tap to reload" toast.

## Redesign proposals (drafts, all four themes)

Each mockup has before/after shots in `shots/vis-mock-<screen>[-before]-<theme>.png`.
- **Today** (`mockups/vis-today.html`): one clear Start, a shorter header, long split names no longer wrap.
- **Workout** (`mockups/vis-workout.html`): a slim rest bar replaces the half-screen rest sheet. The banner no longer covers the set.
- **Friends feed** (`mockups/vis-feed.html`): fewer boxes inside boxes, and the photo leads.
- **Finish page** (`mockups/vis-finish.html`): a shorter hero, and PRs read as was → now.
- **Exercise ⋯ menu** (`mockups/vis-exmenu.html`): a grouped list with icons instead of ten identical boxed buttons.

## Plan (ship order)

1. **Done, on branch `claude/expert-review`:** feed injection and crash, double tap, empty-set logging, Next set ticks, reps ignore ".", lighter rest-timer animation.
2. **Security, run on the live database with Job's yes:** back-01 (friend add) first and alone. Then back-02 (rate limits) and back-05 (social checks).
3. **Correctness:** plan rep range, plate loader for machines (no 20 kg bar), first-workout review wording, the intro's unclosed section, copy fixes (`findings/ux.md` table).
4. **Contrast and layout:** Summit/Boulder/Skyline contrast, long-name wrapping, a slim rest bar as the default.
5. **Speed:** perf-02 (set logging), perf-04 and perf-07 (feed), perf-05 (duplicate art), perf-06 (resume).
6. **Data safety, with a security check:** front-01, 02, 05, 06 and the new `tests/sync_check.js` (front-08).
7. **Legal:** privacy and Terms update, licence credits. Build block, comment reports and report snapshots first, since the new policy promises them.
8. **Bigger work:** the redesigns once Job picks, text that follows the phone's size, and sheet focus and accessibility.

Each batch gets its own version bump, a build, the checks, screenshots in all four themes, and Job's yes before it goes live.
