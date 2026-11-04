# My Gym (beta): plan

A new part of Job's Done, labelled **Beta**. You pick your gym, add the machines it has, and the app builds a workout from what's actually there. Gyms are shared, so a machine someone else adds shows up for you too.

Decided with Job (4 Nov 2026): pick the machine from a list (no AI in v1), photos aren't kept, gyms are found by typing name + area, and a machine shows for everyone after 2 people confirm. No code has been written yet.

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
- Find or add your gym.
- Add equipment: take a photo, then confirm or pick the machine's name from a short, searchable list. Photo-only, no forms.
- If the photo isn't recognised (or recognition is off), pick the name yourself. That always works.
- Choose today's muscle groups (or "my main lifts"). The app builds the session from the table above using only that gym's equipment, with sets, reps and rest taken from your existing settings.
- Sessions vary: when a movement has more than one way to do it at your gym, the pick rotates between sessions. Your main lifts stay so progress is tracked, and the variety comes from the variant and the extras.
- Logging, PRs, charts, rest timer and recaps are the ones already in Job's Done. A gym workout is a normal workout.
- Shared equipment list per gym, with confirmations (see moderation).
- Beta label on the My Gym tab/card, plus a way to turn it off in Me.

### Later
- Recognition improvements, equipment photos (if we keep photos at all), several gyms per person (home + travel), gym leaderboards or "busiest machine" stats. Money: none. Job's rule is nothing paid. If it ever earns, a subscription for extras would come with legal work (renewal terms, cancel instructions), so it isn't planned now.

### Not doing
Calorie or protein tracking, plateau advice, exercise pictures, a welcome screen, Google sign-in.

---

## 2. TRD

| Part | Choice | Why |
|---|---|---|
| App | Same vanilla JS PWA (app.js) | One app, one login, the existing logging and progress screens |
| Data | Supabase (current free project) | Tables below, with RLS |
| Photo recognition | Pick from list (decided) | Free, private, offline |
| Gym lookup | Typed name + area (decided) | No location permission, no map API |
| Face privacy | Photos aren't kept (decided) | Photos inside gyms show other people |

Recognition options (all free):
1. **Pick from a list (no AI).** The photo is just a reminder for you. Zero cost, nothing leaves the phone, works offline. You do one extra tap.
2. **On-phone AI guess** (CLIP model via transformers.js, vendored, no CDN). It guesses from our fixed list of machine names. The download is roughly 90 MB once and it's slower on older iPhones. Nothing leaves the phone.
3. **Free cloud AI** (Gemini free tier, called from an edge function). This is the most accurate. Photos go to Google, the free tier may use them for training, and it has daily limits. It also needs a key stored as a Supabase secret.

Recommendation: ship v1 with option 1, then try option 2 behind the beta.

Edge function `gym`: rate-limited writes (add gym, add equipment, confirm, flag), so nobody can spam a gym's list from the browser.

---

## 3. App flow

```
Today ─ "My Gym · Beta" card
  └─ no gym yet → Find your gym
        ├─ search results → tap a gym → Gym page
        └─ "Add it" → name + area → Gym page
Gym page
  ├─ Equipment list (confirmed · waiting for a 2nd person)
  │     ├─ tap a machine → name, who confirmed, "Not at this gym" (flag)
  │     └─ "Add a machine" → camera → "Is this a Leg Press?" [Yes] [Pick another]
  │                                        └─ Pick another → searchable list → saved
  ├─ "Build today's workout"
  │     ├─ "My main lifts" (default) or pick muscle groups
  │     ├─ preview: lifts chosen + the machine for each
  │     │     ├─ swap one (other ways to do it at this gym)
  │     │     └─ "Add more" → pick muscles → extra lifts added
  │     └─ Start → the normal workout screen
  └─ ⋯ → change gym · leave gym
Me → My Gym (beta): on/off
```

Empty gym (day one, nothing added): the builder still works. It says which main lifts it couldn't place and shows "Add a machine" right there. It also offers a **starter list** ("most gyms have these": cables, dumbbells, leg press, leg extension/curl, Smith). You tick what you see and that becomes your first equipment list in a few taps.

---

## 4. UI/UX brief

- Same four themes, components and type as the rest of Job's Done. No new palette. Signed-out screens stay Agent.
- **Beta** tag: the existing small uppercase pill style.
- Gym page: one main button ("Build today's workout"), with the equipment list below it. Adding a machine is a secondary button.
- Camera step: full-width photo, one question, two buttons. Yes is the main one.
- Machine picker: search box + list grouped by muscle, using the existing exercise picker style and the nickname search that just shipped.
- Confirmations show as a small count ("2 people"). A machine waiting for a second person has a dotted outline and still works for whoever added it.
- Copy: plain and short. "Not at this gym" is the wording, not "Report".

Rough sketch (Gym page):
```
┌───────────────────────────┐
│ ANYTIME FITNESS · BETA    │
│ Tampines                  │
│ [ Build today's workout ] │
│ EQUIPMENT · 14            │
│ Leg Press        2 people │
│ Cable stack      3 people │
│ Pec Dec          you ···  │
│ + Add a machine           │
└───────────────────────────┘
```

---

## 5. Backend schema (Supabase)

```
jobdone_gyms
  id uuid pk, name text (≤60), area text (≤60), osm_id text null unique,
  created_by uuid → auth.users, created_at, hidden bool default false

jobdone_gym_members            -- who trains where (one gym per person in v1)
  user_id uuid pk → auth.users, gym_id uuid → jobdone_gyms, joined_at

jobdone_equipment_types        -- fixed list we control (Leg Press, Cable stack, Pec Dec...)
  key text pk, name text, movements text[]   -- e.g. {'squat','calf'}

jobdone_gym_equipment
  id uuid pk, gym_id → jobdone_gyms, type_key → jobdone_equipment_types,
  added_by uuid, added_at, unique (gym_id, type_key)   -- no duplicates

jobdone_equipment_votes
  equipment_id → jobdone_gym_equipment, user_id uuid, vote smallint (1 = it's here, -1 = not here),
  at timestamptz, pk (equipment_id, user_id)          -- one vote each
```

**Moderation (so one bad upload can't ruin a gym's list):**
- People pick from **our** fixed equipment list, never free text, so there's no spam names and no duplicates (unique per gym).
- **Uniform names (Job, 4 Nov):** every machine has exactly one name in that list, e.g. "Pec Dec". Typing "chest pec dec fly machine", "butterfly" or "pec deck" finds the same "Pec Dec" entry through nicknames, and it's saved under that one name. Nobody can type a name of their own. If a machine really isn't on the list, "Can't find it" sends the name to the feedback inbox, and it gets added to the list for everyone with one proper name.
- A new machine is "waiting" and only shows for the person who added it until **one other member** confirms it. It counts as real once it has at least 2 "here" votes and more "here" than "not here".
- Each "not at this gym" is a −1. A machine with more −1 than +1 hides itself.
- Photos aren't stored in v1, so there's nothing to moderate on images.
- Rate limits in the `gym` edge function: e.g. 30 equipment adds and 5 new gyms per person per day.
- Gyms with no members after 30 days are hidden by a cron job.

**RLS:** members read their gym's equipment and votes. Writes only go through the edge function (service role), which checks membership and rate limits. People see vote counts, never other users' ids.

**Auth:** the existing email + password sign-in. Nothing new.

**Privacy page:** add a short "My Gym (beta)" section: which gym you picked, the machines you added and your votes are shared with other members of that gym, without your name.

---

## 6. Implementation plan

1. Schema + RLS + equipment type list (seeded from the existing exercise library) on a Supabase branch-free migration. Test with rolled-back SQL first.
2. `gym` edge function: join/create gym, add equipment, vote, with rate limits and the CORS allowlist.
3. Workout builder (pure function, no UI): movements × gym equipment × your history → list of lifts. Includes a small self-check script.
4. Gym page + find/add gym + starter list (behind a beta switch, off by default for everyone but Job).
5. Add-a-machine: camera → pick-from-list (recognition option 1).
6. Build-today screen + "Add more" extras → hands off to the normal workout screen.
7. Privacy page update, security pass (rate limits, RLS, input sizes), screenshots in all four themes.
8. Job tests on iPhone → open to friends with the Beta label.
9. Later: on-phone recognition (option 2) as an experiment.
