# Saved for the official release

Things Job wants added when the App Store release is near. Nothing here is built unless marked.

## Paid features
- **AI coach** (paid users): Claude Haiku via a Supabase function, prepaid Anthropic credits with a spend cap. Job helps write its rulebook (rules, theme voice, his training beliefs, example answers). Decide first: explain-only or allowed to advise. Needs a per-user daily limit, a guard against tricks, and a privacy policy line. *A "Coming soon" card is already in Insights.*
- **Deeper analytics becomes paid**: Insights is free for now (v158).

## Main selling point: knows your gym, built to be social
- Pick-your-gym step in onboarding. Members tick the machines their gym has; photo scan later.
- Plans and the exercise picker only show lifts your gym can do.
- **Taken?** button on every lift: swaps to a matching free option at your gym.
- Weight and seat memory per machine, per gym.
- Gym page: who's training today, busy hours, regulars, popular machines, gym leaderboard.
- Pitch: "The gym app you do with your people, at your gym." ID cards, stories, recap cards and joint sessions are the social side.

## Free vs Pro (Job, 12 Nov)
- One plan: **Job's Done Pro**, monthly or yearly (yearly suggested). Price set later with the founder-pricing skill.
- **Themes:** free = Agent, Boulder, Skyline, plus a new **pink theme** (to design). Pro = **Summit**, whose sky changes with the time of day. Decide whether people already using Summit keep it free.
- **Free:** logging, splits, plate loader, rest timer, Body/Strength/Volume/History, friends, feed, stories, joint sessions, basic ID card, gym features, recap cards, Wrapped, posters, data export.
- **Pro:** AI coach, Insights, Summit and future themes, card cosmetics (holo, black card, animated, custom colours), season card designs, custom icons, detailed gym stats, early access.

## Game layer (Job likes all of these; ★ = top picks)
- ★ **Seasons** (Job especially likes): 8-week seasons with a theme ("Winter Arc"), a season card design, ranks reset so everyone restarts together.
- XP and ranks on the ID card, named in each theme's voice.
- Card tiers: bronze, silver, gold, holo, black card. Streak edge on the card.
- Passport stamps on the back of the card (first PR, 100 workouts, 5 AM club, 3 gyms…).
- Weekly missions (Agent dossiers), codenames after a month.
- Theme worlds: Summit climbs a real mountain by kg lifted, Boulder builds a wall of holds, Skyline lights a city.
- Trading cards for each main lift; card face-off between friends.
- Co-op missions, duo streaks, spotter points, gym crews.
- Ghost race against your last session.
- Gym king or queen of the week, Regular and Local Legend, "machine owner", gym vs gym.
- Golden set, comeback bonus, rest-day tokens, 8-week seasons.
- Year-in-review Wrapped, milestone posters, before-and-after card.
- Leaderboards ranked by XP so beginners can win.

## Borrowed from Strava, Spotify and Apple Music (self-promoting features)
- Strava-style: one-tap "respect" on friends' workouts in each theme's voice; machine leaderboards per gym (like segments); "trained at the same time" at your gym (like flybys); stat stickers to lay over a gym selfie for Stories; monthly challenges with a trophy on the card; auto "best lifts of the year" cards.
- Spotify-style: **Training Match**, a % match with a friend plus a joint plan made from both of you (like Blend); Wrapped compared with friends; time-of-day workout titles in the theme's voice, e.g. "Tuesday night iron mission" (like daylist); a live shared workout list in joint sessions (like Jam); a scannable code on the ID card to add friends (like Spotify Codes); animated card loops (like Canvas).
- Apple Music-style: a year-so-far recap that updates every week instead of only in December (like Replay); crew splits everyone can edit and react to (like collaborative playlists); train together from different gyms with each other's sets live (like SharePlay).
- Keep Wrapped free: Strava put its Year in Sport recap behind an $80-a-year paywall, which cuts the free advertising it brings.

## More social ideas
- Live cheers between sets (sound plays over music), spot requests to friends at your gym, opt-in gym buddy finder, workout invites, "do my workout" challenge, beat-my-PR challenges, voice-note cheers, crew chat, mentor mode, gym meetups, rep-for-rep joint sessions, weekly crew recap card.

## Easier logging
- Shake to log the next set; shake again to undo.
- Say it: "60 for 8" with the mic.
- Same as last time: one tap fills the whole lift.
- Text that grows with the iPhone text-size setting (clashes with the identical-heights rule; Job to decide).

## Notifications
- Constant reminder notifications to keep people coming back (more than today's single daily workout reminder). Decide how often and which kinds; keep within the no-nagging-about-measurements/photos rule. Native app makes this easier.

## How-to videos
- Trainer films each lift against a plain wall, side-on.
- Free motion capture (Rokoko Video or DeepMotion) turns it into a faceless 3D figure.
- Blender renders it on a plain background with the worked muscles lit in the theme colour. One template, no hand editing per video.
- Replaces the current "no exercise pictures" rule.

## App Store release checklist (from earlier notes)
- In-app purchases for paid features (no web checkout), Restore Purchases, trial timeline on the paywall with the day-5 reminder actually sent.
- Native app wrapper, Sign in with Apple if any social login, demo login for reviewers, works on iPad.
- Run the app-store-review skill before submitting.
