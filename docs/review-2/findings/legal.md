# Legal, copyright, social safety, AI: findings

Experts: #7 Legal, #8 Copyright and licensing, #20 Social, safety and moderation, #26 AI / machine learning.
Checked against the current branch `claude/expert-review` (v134). Read: `web-src/privacy.html`, `terms.html`, `about.html`, `404.html`, `app.js` (sign-up, friends, posts, stories, comments, report, gym scan, face blur), `schema.sql`, `supabase/*.sql`, all edge functions, `sw.js`, vendor and licence files, `themes-art/`, git history. Friend-request functions aren't in the repo, so their definitions were read from `pg_proc` (structure only, no user rows).

Not a lawyer's opinion. Where it says "confirm", Job should check with the Philippine National Privacy Commission (privacy.gov.ph, free) or a lawyer.

REVIEW.md had almost nothing in this area. Its #146 (error notes in the privacy page) is fixed. Its #42 (15 MB model) is still open, see L12. Its #173 (subscription terms) is still open from REVIEW.md, and only matters if Job ever charges.

## Top 10

1. **Bad.** The gym scan sends photos to Gemini's free tier. Google's terms forbid the free tier for apps used by people in the EU, UK or Switzerland, and they say not to send personal data to it. Gym photos show other people. (L1)
2. **Bad.** The face blur uses BlazeFace short-range, a selfie model for faces within about 2 m. A back-camera shot of a gym corner misses most people in it, and the user never sees the photo before it leaves the phone. (L2)
3. **Bad.** No block. Someone you decline or remove can send a new request straight away, forever. You can't report a comment, and you can't stop nudges from one person without turning them off for everyone. (L3)
4. **Bad.** Reports go to the feedback inbox as one line of text. The post and its photo delete themselves within 48 hours. Job has no tool to remove a post or suspend an account short of raw SQL. (L4)
5. **Bad.** The privacy page says "Your data is only visible to your own account." The about page says "Only you can see your data." Both are false since friends, posts and comments. Comments show your name to people who aren't your friends. "At the gym" shares where you are, but the policy says no location. (L5)
6. **Bad.** Body weight, height, measurements and progress photos count as health data (sensitive personal information under the Philippine Data Privacy Act, special category under GDPR). The policy gives no legal basis, and the only consent is a single box that bundles age, privacy and terms together. (L6)
7. **Bad.** There's no name and no way to reach the person who runs the app except in-app feedback. That route fails when you're signed out, locked out (reset emails don't send) or after you delete your account. No data protection officer, no right to complain to the NPC, no breach promise. (L7)
8. **Bad.** The minimum age is 13. Many EU countries set 16, and the Philippines treats anyone under 18 as a minor. A 13-year-old can post photos and get comments from people who aren't their friends. (L8)
9. **Annoying.** Retention gaps. The sign-up IP log, friend-code tries and scan log are never trimmed and aren't in the policy. Feedback and reports are kept forever. Friends can save your story photo, so "deleted within 48 hours" isn't the whole story. Transfers outside the Philippines (Singapore, US) aren't described as transfers. (L9)
10. **Annoying.** The Terms are from 15 October. The first heading is "Soft launch" and it says "invite-only" while sign-up is open. There are no rules for posts, comments or photos of other people, no right to remove content, and no governing law. (L10)

**Count:** Broken 0 · Bad 8 · Annoying 4 · Nitpick 6 (18 findings).

---

## Legal (expert #7)

### L1. Bad: gym scan uses Gemini's free tier, which its terms don't allow for this
- Where: `supabase/functions/gym-scan/index.ts:3-4,43-52`, `app.js:741` (`GYM_SCAN_READY = true`), `web-src/privacy.html:27`. Live for anyone in My Gym.
- What's wrong: the function calls the Gemini API with a no-billing AI Studio key. [Google's Gemini API terms](https://ai.google.dev/gemini-api/terms) say you may only use Paid Services when your app is available to users in the EEA, Switzerland or the UK. They also say unpaid input can be read by human reviewers and ask you not to send personal information. A gym corner photo has strangers in it, so it holds other people's personal data even after blur (bodies, tattoos, mirrors, name tags). Under the Philippine Data Privacy Act those strangers are data subjects too, and they never agreed. Many gyms also ban photos of other members.
- Why it matters: Job breaks Google's terms the first time an EU friend uses it, and the free key can be cut off. Paying for Gemini breaks Job's "nothing paid" rule, so the fix can't be "turn on billing".
- Fix, in order of preference:
  1. Turn the scan off (`GYM_SCAN_READY = false`). "Pick from the list" already does the job. Drop the Gemini paragraph from the privacy page.
  2. If Job wants to keep it: hide it when the phone's time zone is in Europe (`Intl.DateTimeFormat().resolvedOptions().timeZone` starts with `Europe/`, a rough but free check), show the blurred photo first with a "Send to Google" button (see L2), and change the sheet copy to "Take it when nobody's in the shot."
- Confirmed from the code and Google's published terms.

### L5. Bad: privacy and about pages say nobody else sees your data
- Where: `web-src/privacy.html:9` ("Your data is only visible to your own account"), `privacy.html:25` ("Only friends can see it"), `privacy.html:28` ("We don't collect your location"), `web-src/about.html:44` ("Only you can see your data"). `supabase/friends_social.sql:56-57`, `supabase/at_gym.sql:1-4`.
- What's wrong:
  - Comments: `jobdone_feed` returns every comment on a post with the commenter's card name to everyone who can see the post. If Ana comments on Ben's stamp, Ben's other friends see Ana's name and words even if they aren't Ana's friends.
  - Friend requests: anyone with your code sees your first name before you accept (`jobdone_friend_request` returns `n`). ID card share images carry the code by default (`app.js:1810`).
  - "Tell friends I'm at the gym" sends your gym's name for up to 3 hours. That's location.
  - Friends can "Save photo" and "Share" your posts (`app.js:1792`).
  - The policy doesn't mention comments, the at-the-gym status, the sign-up IP log or the scan counter.
- Fix: change the short version to "Your log is private. What you choose to share goes to friends you accept." Add the missing items. Ready text in `../patches/legal-privacy-additions.md`. Same line on the about page.

### L6. Bad: health data has no legal basis and no separate consent
- Where: `app.js:5199` (one checkbox: "I'm 13 or older and I agree to the Privacy Policy and Terms"), `privacy.html:30-31`.
- What's wrong: body weight, height, measurements and progress photos are health data. The Philippine DPA (RA 10173, sec. 3(l) and 13) and GDPR (art. 9) both need explicit consent or another listed reason for it. A consent buried in "I agree to the Terms" isn't explicit, and agreeing to Terms isn't consent under either law. "Why we store it" doesn't name a basis at all.
- Fix: split the sign-up box in two. Box 1: "I'm 16 or older and I agree to the Terms." Box 2: "I agree that Job's Done stores my training and body data, like body weight, to run the app for me. I can delete it any time." Both required to make an account (the app can't work without storing a log). Add a "Why we're allowed to" section (in the patch file). Confirm with the NPC.

### L7. Bad: no controller identity, no contact that always works, no breach promise
- Where: `privacy.html:13-14`, `terms.html:30-31`.
- What's wrong: both laws need the name of whoever decides what happens to the data (the "personal information controller") and a way to reach them. The only route is Me → Send feedback, which needs you signed in. People who forgot their password can't get in (reset emails don't send), and deleted users can't ask what's left. Also missing: a named data protection officer (the DPA's rules ask every controller to name one; a solo developer can name themself), the right to complain to the NPC, and what happens after a breach (the NPC wants affected people told within 72 hours of finding out when sensitive data is involved).
- Fix: put a name (or "the developer of Job's Done") and a free email address (a new Gmail is fine) at the top of the policy and Terms. Add sections for rights, complaints and breaches (in the patch file). Registering with the NPC is only required past set thresholds (1,000+ people's sensitive data); note it for later and confirm.

### L8. Bad: 13 is too young for this app's social side
- Where: `app.js:5199,5217`, `supabase/functions/signup/index.ts:25`, `privacy.html:45-46`, `terms.html:11`.
- What's wrong: GDPR lets each country set the age of digital consent between 13 and 16. Germany, the Netherlands, Ireland and others use 16. The Philippines treats under-18s as minors and NPC guidance expects a parent's consent for them. Singapore's PDPC guidance treats 13 as the floor and wants extra care below 18. Meanwhile a 13-year-old can post photos and stories, take comments from friends-of-friends (L5), and share an ID card with a friend code.
- Fix: raise the minimum to 16 in the checkbox, the signup function message and both pages. It's the simplest single rule that covers most EU countries. Don't add a birthday field (more data to protect). Confirm with the NPC whether 16 is enough for Filipino users, or 18.

### L9. Annoying: retention and transfers are incomplete
- Where: `schema.sql:43-49` (`jobdone_signup_log`, no trim job), `jobdone_friend_tries`, `jobdone_scan_log` (no trim job found in the repo), `schema.sql:31-41` (feedback and reports kept until the sender deletes their account), `privacy.html:33-37`.
- What's wrong:
  - The sign-up log keeps a hash of your IP address with no end date. A plain SHA-256 of an IPv4 address with a fixed prefix can be reversed by trying all 4 billion, so it is still personal data.
  - Reports hold the reported person's account id and name with no end date, even after that person deletes their account.
  - The policy calls Singapore "where it lives" but doesn't say this is a transfer out of the Philippines. Vercel is a US company. Push messages go through Apple or Google. Gemini (if kept) is Google, US.
  - Friends can save or share your story photo and stamp, so a copy can outlive the 48-hour delete.
- Fix: add one pg_cron line that trims `jobdone_signup_log`, `jobdone_friend_tries` and `jobdone_scan_log` after 7 days, and feedback after 12 months. Write it down as SQL in the patch batch, don't run it without Job's yes. Add the transfer and copies text (patch file).

### L10. Annoying: Terms are behind the app
- Where: `web-src/terms.html:5-8,15-19,24-25`.
- What's wrong:
  - "Soft launch" heading (Job's banned phrase) and "invite-only" while anyone can sign up.
  - "We don't use it for anything else" is untrue now that posts and comments are shown to friends. There's no licence to show your posts to friends.
  - No rules for comments, harassment, nudity, or photos of other people (stories come from a gym floor).
  - No right to remove posts or suspend accounts, which Job needs before he can act on a report.
  - No governing law. For a solo developer in the Philippines, Philippine law is the natural choice. Consumer protection in the user's own country still applies, and the Terms should say so instead of pretending it doesn't.
  - Injury wording is fine ("as far as the law allows"). Keep it. Under Philippine law a waiver can't cover gross negligence, which that phrase already respects.
- Fix: new Terms text in `../patches/legal-privacy-additions.md` (last section). Bump "Last updated" and show a one-line notice in What's new, since the policy promises to tell people.

### L13. Nitpick: local storage isn't described
- Where: `privacy.html:28`. `app.js:169,190,657,743,1791`.
- What's wrong: the policy says no tracking cookies, which is true. It doesn't say the phone keeps your sign-in session, a full copy of your log, the hidden-posts list, your gym list and screen position. On a shared phone that matters. These are strictly needed for the app to work, so no cookie banner is needed (ePrivacy art. 5(3) exemption), but they should be listed.
- Fix: one short "On your phone" section (patch file).

### L14. Nitpick: future paid tier
- Still open from REVIEW.md #173. Only matters if Job ever charges. Nothing to do now.

### L15. Nitpick: App Store, if it's ever wrapped
- Apple guideline 1.2 needs, for any app with user content: a way to report (exists for posts only), a way to block (missing, L3), a filter for objectionable content, and published contact info (L7). Account deletion (5.1.1(v)) exists. No native app is planned, so this only says L3 and L7 also clear the way if that ever changes.

---

## Copyright and licensing (expert #8)

### L11. Annoying: three licences are credited without the text they require
| Item | Licence | Shipped notice | Verdict |
|---|---|---|---|
| `web-src/vendor/supabase.js` 2.45.4 | MIT | `supabase-js-LICENSE` (full text) | Fine |
| `web-src/vendor/mediapipe/*` (tasks-vision 1.2.2, wasm, BlazeFace model) | Apache 2.0 | `LICENSE.txt` is 3 lines with a URL | **Needs the full licence text.** Apache 2.0 sec. 4(a) says to give recipients a copy. |
| `web-src/fonts/permanent-marker.woff2` (Font Diner, via Google Fonts) | Apache 2.0 | none | **Needs the licence text** next to the font. |
| `web-src/ex/body.json` from react-muscle-highlighter | MIT | `CREDITS.txt` names it, no copyright line, no MIT text | **Needs the copyright line and MIT text.** MIT's one condition is keeping both. |
| `web-src/ex/index.json` how-to steps | own work | CREDITS says so | Fine |
| Sounds | made in code (`app.js:2827`, WAV built at run time) | n/a | Fine |
| `themes-art/agent.svg`, `skyline.svg`, inline SVGs in CSS | drawn for the app | n/a | Fine |
| `themes-art/climbing.webp` (Boulder chalk wall, the only webp still shipped, in `styles.css` as `--chalkwall` and `.thp-climb`) | Job's own photo per commit 0b5409c | n/a | Fine if Job took it. Confirm. |
| App icon, splash, og.jpg, about screenshots | made for the app | n/a | Fine |
| Exercise names | not protectable (names of movements) | n/a | Fine |
| CSV import of Strong / Hevy formats, naming them in the intro (`app.js:4608,4702`) | file formats aren't protected; naming them to say "import from" is fair nominative use | n/a | Fine. Don't use their logos. |
- Fix: copy the full Apache 2.0 text into `vendor/mediapipe/LICENSE.txt` and `fonts/LICENSE-PermanentMarker.txt`, add the MIT block to `ex/CREDITS.txt`, and add a small "Credits" line under Privacy and Terms on the about page and in Me, linking a plain `credits.html` that lists the four.

### L16. Nitpick: theme names and lines that lean on famous brands
- Where: `app.js:3084` ("Shaken, not stirred.", "Aston Martins"), `app.js:3085` ("villains webbed up"), internal theme key `spidey` (in code only, never shown), Skyline's red-and-web look.
- What's wrong: short phrases aren't protected by copyright, and the themes don't use names, logos or characters, so the risk today is low. "Shaken, not stirred" is the one line that is plainly a Bond catchphrase. "Webbed up" plus red, webs and a city points at Spider-Man. Marvel and Eon enforce hard if a product makes money or ends up in an app store.
- Fix: no change needed for a free friends beta. Before any paid tier or store listing, swap "Shaken, not stirred" and "webbed up" for the theme's own words. "Aston Martins" is fine as a car brand used for a size comparison.

### L17. Nitpick: unused art of unknown origin sits in the repo
- Where: `themes-art/spider-day.webp`, `spider-night.webp`, `hitman.webp` (commit 0b5409c, "Spider Night and Daylight Verse", "Hitman obsidian"). None of them is in `styles.css` or `app.js` any more.
- What's wrong: no source is recorded. The "Verse" name hints they may come from Spider-Verse imagery. If the repo is public, that's distributing it.
- Fix: delete the three files, or add a line in `themes-art/` saying where each came from.

### L18. Nitpick: the name
- "Job's done!" is a well-known Warcraft voice line. Trademark law protects brands, not quotes, and nothing suggests Blizzard registered it for software. Search IPOPHL and USPTO before putting the name on a store listing. Nothing to do now.

---

## Social, safety and moderation (expert #20)

### L3. Bad: no block, and decline doesn't stop anyone
- Where: `pg_proc` `jobdone_friend_answer` (decline just deletes the request row), `jobdone_friend_remove` (deletes the friendship only), `jobdone_friend_request` (10 tries an hour, no memory of "declined"). `app.js:1584` (nudges off for everyone), `app.js:1591` (comments: only Delete, and only for the writer or the post's owner).
- How to see it: A declines B. B types A's code again. A gets a new request. B can repeat it every time A declines. Same after A removes B. If B shared nasty comments under a mutual friend's post, A can't report them, only the post owner can delete them.
- Why it matters: this is the harassment path. With a 13-year-old minimum (L8) it's worse.
- Fix (small, one table):
  - `jobdone_blocks (user_id, blocked_id)` with RLS on, no policies, reached through `jobdone_block(p_user)` and `jobdone_unblock(p_user)`.
  - Blocking removes the friendship and any requests both ways.
  - `jobdone_friend_request` returns `none` (same as a wrong code, so nobody learns they're blocked) when either side has blocked the other.
  - `jobdone_feed` hides posts and comments from blocked accounts. `jobdone_nudge` returns `off`.
  - UI: "Block" in the friend's ⋯ menu, on an incoming request ("Decline and block"), and on a comment's ⋯. A "Blocked" list in Me → Friends to undo it.
  - Add "Report" to comments, same path as posts.
  - Needs a line in What's new, the intro and the tour (only the tour, really: one sentence).

### L4. Bad: reports can't be acted on
- Where: `app.js:1802-1803`, `supabase/friends_today.sql:113` (posts deleted after 48 hours).
- What's wrong: a report inserts `Report: snap post 123 by Sam (uuid)` into `jobdone_feedback`. No photo, caption or comment text is kept. If Job reads the inbox two days later the post is gone, so he can't judge it. If it's still there, he can only delete it through the Supabase dashboard. There's no way to suspend an account. The reporter is told "sent to Job's Done to look at" and never hears back.
- Fix:
  - A `jobdone_reports` table (service role only) that stores a copy of the reported post's kind, caption, photo and comment text at report time, kept 30 days, then trimmed.
  - Hide a post from everyone once 2 different friends report it, until Job looks.
  - An owner-only "Reports" list next to the feedback inbox with "Remove post" and "Suspend account" (sets a `banned_until` through `auth.admin.updateUserById`, done in an edge function with an owner email check like the feedback policy).
  - Say in the Terms what happens to a report (patch file).
  - Write it as `docs/review-2/patches/NN-reports.sql`, needs a security check before it ships because it touches user data.

### Smaller safety notes (folded into L3/L4, not counted)
- Friend codes: custom codes of 4 to 12 letters (like a first name) are easy to guess. With 10 tries an hour, a stranger can test names and learn the first name behind any hit. Fine for a friends beta; the block above covers the follow-up. Keep the default random 6-character code for new accounts.
- Story camera has no face blur, but the user picks the photo and sees it first. That's normal for a story. The Terms line about photos of other people covers it.
- Nudges: 1 per friend per 20 hours, 20 a day, opt-out. Fine. The block covers per-person muting.
- Comment limits: 200 characters, 40 a day, only on visible posts. Fine.

---

## AI and machine learning (expert #26)

### L2. Bad: the face blur misses most faces in a gym photo, and the user can't check
- Where: `app.js:1004-1006` (`blaze_face_short_range.tflite`, `minDetectionConfidence: .35`), `app.js:989-999`, sheet copy `app.js:967` ("Faces are blurred on your phone first"), `privacy.html:27`.
- What's wrong:
  - Google's own model card says BlazeFace short-range is built for faces within about 2 m of a front camera, like a selfie. A gym corner taken with the back camera puts people 3 to 10 m away, side-on or from behind, often small. After shrinking to 1024 px a face 6 m away is about 20 px wide, below what the short-range model finds reliably.
  - The photo is sent the moment it's taken. Nobody sees what Google will get.
  - Only faces are covered. Bodies, tattoos, phone screens, name tags and mirrors are not.
  - Failure mode is good: if the model can't load, nothing is sent (`app.js:993`). Keep that.
- Why it matters: the copy promises something the model can't deliver, and the people in the shot never agreed.
- Fix (if the scan stays, see L1):
  - Show the blurred photo with "Send" and "Retake" before upload. This is the real safety net.
  - Change the copy to "Take it when nobody's in the shot. We blur any faces we find, but we can miss some."
  - Optional, still free and on-device: swap or add MediaPipe's Object Detector (EfficientDet-Lite0, Apache 2.0, about 4 to 7 MB). It finds whole people at a distance, so the app can blur every person box, or refuse to send when it sees someone. That beats faces-only.

### L12. Annoying: a 15 MB download starts without warning
- Where: `web-src/vendor/mediapipe/wasm/vision_wasm_internal.wasm` (14.6 MB) plus 0.7 MB of other files, `sw.js:3,20`.
- What's wrong: tapping "Take a photo" the first time downloads about 15 MB, then caches it. On mobile data in the Philippines that's real money, and the sheet just shows "Looking for machines…". Still open from REVIEW.md #42.
- Fix: if the scan stays, the first time show "The first scan downloads about 15 MB. Use Wi-Fi if you can." with Continue. If the scan goes (L1), delete `web-src/vendor/mediapipe/` and the `MP` cache line in `sw.js`, and the whole problem goes with it.

### Where on-device AI could help, and where it shouldn't (notes, not counted)
- Prompt injection on the scan is handled well: the answer is forced into a fixed list of machine keys and the prompt says to ignore writing in the photo. Keep that pattern for anything similar.
- Don't add an LLM coach, form checker or "smart" suggestions. They'd either cost money, send data away, or break the rule against telling people to change weight or reps.
- Don't use AI to moderate comments. A friends-only feed with 200-character comments needs block and report (L3, L4), not a model.
- Fine to keep doing without AI: CSV column matching for Strong/Hevy (plain rules work), plate maths, PR rules.
- One free, on-device idea with no data leaving the phone: none worth the weight right now. The person detector in L2 is the only one that earns its download, and only if the scan stays.
