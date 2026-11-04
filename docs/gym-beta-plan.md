# My Gym (beta): plan

A new part of Job's Done, labelled **Beta**. You pick your gym branch, photograph its corners, and AI lists the machines it sees. The app then builds a workout from what's actually there. Gyms are shared, so a machine someone else adds shows up for you too.

Decided with Job (4 Nov 2026):
- **AI scan:** take a photo of each corner of the gym and the app names every machine in it. You confirm the list. Picking from a list is the fallback when the AI misses one.
- **Photos aren't kept** by Job's Done. Faces are blurred on the phone before the photo goes to the AI.
- **Gyms are found by typing.** Chains like Anytime Fitness have one entry per branch.
- **A machine shows for everyone** once 2 people confirm it.
- **One fixed name per machine.**

No gym code has been written yet.

---

## 1. PRD

### The problem
People repeat the same workout because they don't know what else the gym's equipment can do. The routine gets stale and progress stalls.

### Who it's for
Friends on the early beta who train at a regular gym and want a session built from that gym's machines, without planning it themselves.

### Core idea
Every workout is built around **the main lifts** first. The machine or attachment doesn't matter, only the movement:

| Movement | Fills it (examples) |
|---|---|
| Incline press (upper chest) | Incline machine, Smith incline, incline dumbbells |
| Pec dec fly (rest of chest) | Pec dec, cable fly, dumbbell fly |
| Shoulder press | Machine, dumbbells, Smith |
| Lateral raise | Machine, cable, dumbbells |
| Preacher curl | Preacher machine, preacher bench + EZ bar or dumbbell |
| Tricep pushdown | Cable with rope, bar or V-handle |
| Leg extension | Leg extension machine |
| Leg curl | Seated or lying leg curl |
| Squat pattern | Leg press, hack squat, pendulum, Smith squat |
| Hip hinge | SLDL, RDL, back extension, cable pull-through |
| Calf raise | Standing, seated, leg-press calf raise |

**Extras:** after the main lifts, you can say "add more" and pick the muscle groups you want. The app adds lifts for those muscles from the gym's equipment list.

### v1 (first beta)
- **Find your branch:** type the chain or gym name ("anytime"), then pick the branch by area ("Tampines Central"). If it isn't there, add it.
- **Scan the gym:** take a photo of each corner. The AI lists every machine it can see (e.g. "Leg Press, Leg Curl, Cable Stack"). You untick anything wrong and tap Add. One photo can add several machines.
- **Fallback:** if the AI misses a machine, or the scan limit is used up, you pick its name from the list. That always works, even offline.
- **Build today:** choose "my main lifts" or muscle groups. The app builds the session from the table above using only that branch's equipment, with sets, reps and rest from your existing settings.
- **Sessions vary:** when a movement has more than one way to do it at your gym, the pick rotates between sessions. Your main lifts stay so progress is tracked, and the variety comes from the variant and the extras.
- **Logging is unchanged:** PRs, charts, rest timer and recaps are the ones already in Job's Done. A gym workout is a normal workout.
- **Shared equipment** per branch, with confirmations (see moderation).
- **Several branches per person.** Chains like Anytime Fitness let you train at any branch, so you have a home branch plus others. "Where are you training today?" defaults to the last one you used.
- **Beta label** on the My Gym card, plus a switch to turn it off in Me.

### Gym chains and branches
- A **brand** (Anytime Fitness, Fitness First, ActiveSG, Gymm Boxx…) has many **branches**. Equipment always belongs to a branch, because two Anytime Fitness clubs rarely have the same machines.
- Searching "anytime" shows the brand once, with its branches listed under it by area. That stops five people adding "Anytime Fitness Tampines" five different ways.
- **Starter list from the brand:** a new branch with nothing added yet starts with the machines that most of the brand's other branches have, shown as "Usually at Anytime Fitness, tick what you see". They don't count as real until someone at that branch confirms them.
- Independent gyms are a brand with one branch.
- Brand names come from a short list we keep (the same fixed-name rule as machines). A new chain goes through "Can't find it" to the feedback inbox.

### Later
- Equipment photos for others to see (only if we start keeping photos), leaderboards per branch, "busiest machine" stats. Money: none. Job's rule is nothing paid. If it ever earns, a subscription would come with legal work (renewal terms, cancel instructions), so it isn't planned.

### Not doing
Calorie or protein tracking, plateau advice, exercise pictures, a welcome screen, Google sign-in.

---

## 2. TRD

| Part | Choice | Why |
|---|---|---|
| App | Same vanilla JS PWA (app.js) | One app, one login, the existing logging and progress screens |
| Data | Supabase (current free project) | Tables below, with RLS |
| Machine recognition | Google Gemini (free tier) through an edge function `gym-scan` | The only free option that can find several machines in one wide photo |
| Face blur | MediaPipe face detector, run on the phone, files vendored (no CDN) | Other people's faces never leave the phone |
| Gym lookup | Typed brand + branch area | No location permission, no map API |
| Photos | Not stored by us | Nothing to moderate, nothing to leak |

**How a scan works:**
1. You take a photo. The phone shrinks it (about 1024 px wide) and blurs any faces it finds.
2. The phone sends it to our edge function `gym-scan`. The function checks you're signed in and a member of that branch, and that you're under the daily limit.
3. The function asks Gemini to pick machines **only from our fixed list of machine keys** and to answer as JSON (`["leg_press","leg_curl"]`). Anything not on the list is dropped, so the AI can't invent names, and text in the photo can't steer it (a prompt-injection guard).
4. The phone shows the results as a tick list. You confirm, and they're saved as "waiting" until a second person confirms.
5. The photo is thrown away. We never store it.

**Limits and cost:**
- The free tier has a daily cap across the whole app. We cap each person at **20 scans a day**. When the cap is reached, the app says so and falls back to picking from the list.
- The Gemini key lives in Supabase secrets (never in the app or git). It comes from a Google AI Studio project with **no billing attached**, so it can't charge anything.
- **Privacy trade-off:** on the free tier, Google may use what we send to improve its products. That's why faces are blurred first. The privacy page must say photos are sent to Google for recognition.

**Ruled out:**
- **On-phone AI (CLIP):** it can only label a whole photo, so one wide shot of a corner would give one guess, not five machines. It's also about a 90 MB download.
- **Paid vision APIs:** nothing paid.

**Edge function `gym`:** rate-limited writes (add gym/branch, add equipment, confirm, flag), so nobody can spam a branch's list from the browser.

---

## 3. App flow

```
Today ─ "My Gym · Beta" card
  └─ no gym yet → Find your gym
        ├─ type "anytime" → Anytime Fitness · 6 branches
        │     ├─ tap a branch → join it → Gym page
        │     └─ "My branch isn't here" → area → new branch (starter list from the brand)
        └─ no brand match → "Add an independent gym" or "Can't find your chain?"
Gym page (one branch)
  ├─ "Training at: Tampines Central ▾" → switch branch · add another branch
  ├─ "Build today's workout" (main button)
  ├─ "Scan a corner" → camera → faces blurred → "Found 4 machines" tick list → Add
  │     └─ "Missed one?" → searchable list → saved
  ├─ Equipment list (confirmed · waiting for a 2nd person)
  │     └─ tap a machine → "It's here" / "Not at this gym"
  └─ ⋯ → leave this branch
Build today
  ├─ "My main lifts" (default) or pick muscle groups
  ├─ preview: lift + machine for each → swap one · "Add more" → muscles → extras
  └─ Start → the normal workout screen
Me → My Gym (beta): on/off · your branches
```

Empty branch (day one): the builder still works. It says which main lifts it couldn't place yet and shows "Scan a corner" right there. It also offers the brand's starter list ("Usually at Anytime Fitness"), or a general one for independent gyms.

---

## 4. UI/UX brief

- Same four themes, components and type as the rest of Job's Done. No new palette. Signed-out screens stay Agent.
- **Beta** tag: the existing small uppercase pill style.
- Gym page: one main button ("Build today's workout"). "Scan a corner" is secondary.
- Scan results: the photo at the top with a small label on each machine found, then the tick list with everything ticked and one "Add 4 machines" button.
- Branch picker: brand name once, branches as rows with area, machine count and number of people.
- Confirmations show as a small count ("2 people"). A machine waiting for a second person has a dotted outline and still works for whoever added it.
- Copy: plain and short. "Not at this gym", not "Report".

---

## 5. Backend schema (Supabase)

```
jobdone_gym_brands             -- fixed list we keep (Anytime Fitness, Fitness First, ...)
  id uuid pk, name text unique, independent bool default false

jobdone_gyms                   -- one row per branch
  id uuid pk, brand_id → jobdone_gym_brands, branch text (≤60, e.g. "Tampines Central"),
  created_by uuid, created_at, hidden bool default false,
  unique (brand_id, lower(branch))            -- no duplicate branches

jobdone_gym_members            -- several branches per person
  user_id uuid → auth.users, gym_id → jobdone_gyms, is_home bool, last_used timestamptz,
  pk (user_id, gym_id)

jobdone_equipment_types        -- the one fixed machine list (uniform names)
  key text pk, name text, nicknames text[], movements text[]   -- e.g. {'squat','calf'}

jobdone_gym_equipment
  id uuid pk, gym_id → jobdone_gyms, type_key → jobdone_equipment_types,
  added_by uuid, added_at, via text check (via in ('scan','list','starter')),
  unique (gym_id, type_key)

jobdone_equipment_votes
  equipment_id → jobdone_gym_equipment, user_id uuid, vote smallint (1 here, -1 not here),
  at timestamptz, pk (equipment_id, user_id)

jobdone_scan_log               -- for the per-person daily limit only (no images)
  user_id uuid, at timestamptz, found smallint
```

**Brand starter list:** a view that counts, per brand, the share of its branches where each machine is confirmed. Machines at half or more of the branches go on that brand's starter list.

**Moderation (so one bad upload can't ruin a branch's list):**
- Machines come from our fixed list only, whether from the AI or from the picker, so there are no spam names and no duplicates per branch.
- **Uniform names:** every machine has exactly one name, e.g. "Pec Dec". Typing "chest pec dec fly machine", "butterfly" or "pec deck" finds that same entry through nicknames. The AI answers with list keys too. If a machine really isn't on the list, "Can't find it" sends the name to the feedback inbox and it's added for everyone under one proper name.
- A new machine is "waiting" and only shows for whoever added it until **one other member** confirms it. It's real once it has at least 2 "here" votes and more "here" than "not here".
- Each "not at this gym" is a −1. A machine with more −1 than +1 hides itself.
- No photos are stored, so there are no images to moderate.
- Rate limits: 20 scans, 30 machine adds and 3 new branches per person per day.
- A branch with no members for 30 days is hidden by a cron job.

**RLS:** members read their branches' equipment and vote counts. All writes go through the edge functions (service role), which check membership and limits. Nobody sees other users' ids.

**Auth:** the existing email + password sign-in.

**Privacy page:** add a "My Gym (beta)" section covering:
- The branches you joined, the machines you added and your votes are shared with other members, without your name.
- Scan photos are sent to Google's Gemini to name the machines, with faces blurred first.
- Job's Done doesn't keep the photos.

---

## 6. Implementation plan

1. Schema + RLS + the fixed machine list (seeded from the existing exercise library and nicknames) + the brand list. Test with rolled-back SQL first.
2. `gym` edge function: brands/branches, join, add equipment, vote, with rate limits and the CORS allowlist.
3. Workout builder (pure function, no UI): movements × branch equipment × your history → lifts. Ships with a small self-check script.
4. Find-your-branch, Gym page, brand starter list (behind a beta switch, on only for Job at first).
5. Pick-from-list adding (the fallback, works offline).
6. **Job's step:** create a free Gemini API key in Google AI Studio (no billing), and paste it into Supabase → Edge Functions → Secrets as `GEMINI_KEY`. Claude can't enter keys.
7. Face blur on the phone (vendored MediaPipe) + `gym-scan` edge function + the scan results screen.
8. Build-today screen + "Add more" extras → hands off to the normal workout screen.
9. Privacy page update, security pass (limits, RLS, input sizes, prompt-injection guard), screenshots in all four themes.
10. Job tests on iPhone at a real gym, then it opens to friends with the Beta label.
