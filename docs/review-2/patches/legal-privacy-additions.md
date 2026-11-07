# Privacy policy and Terms: text to add

Draft wording for `web-src/privacy.html` and `web-src/terms.html`. Fill in the parts in [brackets]. Each block says where it goes and what it replaces. Match the existing `<div class="card"><h2>…</h2>…</div>` markup. Bump "Last updated" on both pages and add one line to What's new ("We updated the Privacy Policy and Terms"), because the policy promises to say so.

Have the Philippine National Privacy Commission (privacy.gov.ph) or a lawyer look it over before calling it final. Choices still open for Job: the minimum age (16 is used below), and whether the gym scan stays (the text below assumes it's switched off; an alternative paragraph is at the end).

---

## Privacy policy

### Replace "The short version" list

- Job's Done stores what you log so you can see it on any device you sign in on.
- Your log is private. What you choose to share goes only to friends you accept, and a little of it (your first name, your comments) can be seen by their friends too.
- No ads, no analytics trackers, and your data is never sold or shared for marketing.
- You can export everything or delete your account in the app at any time.

### Replace "Who runs Job's Done"

**Who runs Job's Done**

Job's Done is run by [full name], an independent developer in the Philippines. It isn't a company. For privacy questions, requests or complaints, email [privacy email]. You can also use Me → Send feedback in the app. [Full name] is also the data protection officer and can be reached at the same address.

### Add to "What we store" (new list items)

- **Comments and reactions** you leave on friends' posts. Comments are deleted with the post.
- **At the gym:** if you tap "Tell friends I'm at the gym", your friends see the name of your gym until you finish or for up to 3 hours.
- **Sign-up check:** to stop bots, we keep a scrambled copy of the network address you signed up from for 7 days.
- **Limits:** we count how many friend codes you try and, for My Gym, how many scans you run, so nobody can guess codes or overuse the service. These counts are deleted after 7 days.
- **Reports:** if you report a post or comment, we keep a copy of it, who posted it and who reported it for 30 days so we can look at it.

### Replace the last sentence of "What we store"

We don't collect your contacts or your phone's location. The only place information we keep comes from is the gym you choose to show your friends.

### Replace "Why we store it"

**Why we're allowed to**

- **To run the app you signed up for:** your account, your log, syncing between devices, friends and posts. Without this the app can't work.
- **Your consent, for body and health data:** body weight, height, measurements and progress photos count as health information. We store them only because you agreed to it when you signed up, and only when you enter them. You can take that back by deleting them or your account.
- **Keeping the service safe:** sign-up checks, limits, error notes and reports. We need these to stop abuse and fix problems, and we keep them short.

We never use your data for ads, never sell it, and never use it to train AI.

### Replace "Where it lives"

**Where it lives and who handles it**

Your data is stored with [Supabase](https://supabase.com/privacy) on servers in Singapore. The website is served by [Vercel](https://vercel.com/legal/privacy-policy), a US company, through servers around the world. If you turn on notifications, Apple or Google deliver them to your phone. These companies only handle data to provide their service to us.

This means your data leaves the country you live in. We picked providers that protect it with encryption in transit, strict access rules, and contracts that limit what they can do with it. Database rules stop any account from reading another account's data.

### Add after "Where it lives": "Who can see what"

**Who can see what**

- **Only you:** your workouts, sets, notes, body weight, measurements, progress photos, steps and everything on Today and Progress.
- **Friends you accept:** your ID card (only the parts you leave on), whether you trained today, your Done Stamps and stories, and the gym you're at if you choose to show it.
- **Friends of your friends:** your first name and what you wrote, when you comment on a post they can also see.
- **Anyone with your friend code:** your first name, when they send you a request. They see nothing else unless you accept.

Friends can save or share a photo you post. Once they have, deleting the post doesn't remove their copy.

### Replace "How long we keep it"

**How long we keep it**

- Your log, ID card and settings: until you delete them or your account.
- Done Stamps, stories, comments and reactions: shown for 24 hours, deleted within 48.
- Nudges: 3 days.
- Error notes: 30 days.
- Sign-up checks and limit counts: 7 days.
- Reports: 30 days.
- Feedback you send: 12 months, or until you delete your account.
- Daily safety copies of your data: 14 days. They may still hold things you deleted in that time.

Deleting your account (Me → Delete account) removes your account and everything above straight away, safety copies included. Our providers may keep their own encrypted backups for a short time before those expire.

### Add "On your phone"

**On your phone**

The app keeps a few things on your phone so it opens fast and works without signal: your sign-in, a copy of your log, which screen you were on, posts you hid, and your gym list. They're needed for the app to work, so there's no cookie banner. Nothing on your phone is used to track you. Signing out removes your sign-in. On a shared phone, sign out when you're done.

### Replace "Your choices" with "Your rights"

**Your rights**

You can:

- **See and export** your data: Me → Your data → Export backup (JSON) or spreadsheet (CSV).
- **Correct** it: edit or delete anything you've logged.
- **Delete** it: Me → Delete account.
- **Take back consent** for body and health data: delete those entries, or your account.
- **Object or ask questions** about how we use your data: email [privacy email].
- **Complain** to a privacy regulator. In the Philippines that's the National Privacy Commission (privacy.gov.ph). In the EU or UK it's your local data protection authority. Please tell us first if you can, so we can try to fix it.

We answer requests within 15 working days.

### Add "If something goes wrong"

**If something goes wrong**

If your data is ever exposed by mistake or by an attack, we'll tell you by email and in the app, and report it to the National Privacy Commission, within 72 hours of finding out. We'll say what happened, what data was involved and what you can do.

### Replace "Age"

**Age**

Job's Done is for people aged 16 and over. If you're younger, please don't create an account. If we learn that someone under 16 has signed up, we'll delete the account and everything in it.

### Replace the My Gym (beta) item in "What we store" (scan switched off)

- **My Gym (beta):** if you turn it on, we store which gyms you joined, the machines you added and your "it's here" / "not here" answers. Other members of that gym see the machines and how many people confirmed each one, never your name or email. Leaving a gym or deleting your account removes your membership and answers. Machines you added stay on that gym's list without your name.

**Only if the scan is kept** (and hidden for people in Europe), add this sentence instead of removing the scan:

When you scan a corner, the app shrinks the photo and blurs any faces it finds, then shows it to you. Only if you tap Send does it go to Google's Gemini service to name the machines. We don't keep the photo. Google may keep it and have people review it to improve its services, so take the photo when nobody's in the shot.

---

## Terms of Use

### Replace "Soft launch"

**Early beta**

Job's Done is free and still being built. Features may change, break or be removed. Export a backup now and then (Me → Your data) if your log matters to you.

### Replace the first item under "Your account"

- You must be 16 or older.

### Replace "Your content"

**Your content**

What you log and post is yours. You let Job's Done store it and show it back to you, and show what you choose to share to your friends. We don't use it for anything else. See the [Privacy Policy](privacy.html).

### Replace "Fair use" with "Posting and friends"

**Posting and friends**

- Only post photos you took or have the right to share. Don't post photos of other people without asking them. Many gyms don't allow photos of other members, so check your gym's rules.
- No nudity, hate, threats, harassment, or anything illegal.
- Don't keep sending requests or nudges to someone who doesn't want them.
- Don't try to break, overload or get into parts of the service that aren't yours.

You can hide or report any post or comment, and block anyone. We look at every report. We can remove a post or comment, and suspend or close an account, if it breaks these rules. We'll tell the account owner why when we can.

### Add "Law"

**Law**

These terms are governed by the laws of the Philippines. If you live somewhere else, you keep any rights your local consumer law gives you.

### Replace "Contact"

**Contact**

Email [privacy email], or use Me → Send feedback in the app.

---

## Sign-up checkbox (app.js:5199)

Two boxes instead of one, both needed to sign up:

- I'm 16 or older and I agree to the [Terms](terms.html).
- I agree that Job's Done stores my training and body data, like body weight, to run the app for me. [Privacy Policy](privacy.html)

Error message (app.js:5217 and supabase/functions/signup/index.ts:25): "Tick both boxes to create your account."
