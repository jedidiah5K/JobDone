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
- **Headline feature for marketing: your ID card in Apple Wallet / Google Wallet**, plus tap-to-add (NFC) in the native app. Lead launch posts and App Store screenshots with it. Details in the Wallet section below.

## Free vs Pro (Job, 12 Nov)
- One plan: **Job's Done Pro**, monthly or yearly (yearly suggested). Price set later with the founder-pricing skill.
- **Themes:** free = Agent, Boulder, Skyline, plus a new **pink theme** (to design). Pro = **Summit**, whose sky changes with the time of day. Decide whether people already using Summit keep it free.
- **Free:** logging, splits, plate loader, rest timer, Body/Strength/Volume/History, friends, feed, stories, joint sessions, basic ID card, gym features, recap cards, Wrapped, posters, data export.
- **Pro:** AI coach, Insights, Summit and future themes, card cosmetics (holo, black card, animated, custom colours), season card designs, custom icons, detailed gym stats, early access.

## Valentine's Day drop (14 Feb)
- Release the free pink theme on Valentine's Day as a launch moment. Drafts in docs/drafts/pink-*.jpg; Job leans pastel pink and white, with Valentine touches (single-line heart in the header, heart-shaped finished days, rose-red accent).
- **Chosen design (12 Nov): "Sweetheart"** = Strawberry milk base (blush #FFF1F4 page, white cards, pastel pink next-up card, rose #E05A82 buttons, deep-rose ink #3A1E28) + small-heart pattern background + heart day dots (trained = filled heart with cupid's arrow, today = rose outline, others faint outline). Draft: docs/drafts/pink-9-heart-pattern.jpg; mock-up script in the preview scratch folder (pink.js, key "sweethearts"). Still to build: theme entry, colours, voice lines (THEME_MSG, TIDY, HEAVY, NEXT_LBL, FIN_SEAL, INVITE, CAM_LINE), ID card look and levels, finish page, share cards, report card, chart art, picker preview. Free theme.
- Pair it with duo features: "Swole mates" duo streak, a shared couple/partner ID card, a co-op mission ("train together 3 times this week"), and a "Gym date" recap card made for Stories.
- Theme voice for Valentine's lines (finish page, "That's like…" comparisons).

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

## ID card in Apple Wallet / Google Wallet, and NFC (Job, 13 Nov: very marketable)
- Add your ID card to Apple Wallet or Google Wallet (Samsung phones use Google Wallet too). The pass shows your name, tier, streak and a QR to add you as a friend, and updates when your stats change.
- Apple Wallet: needs the Apple Developer Program ($99/year) for a Pass Type ID certificate. That breaks "nothing paid", so it waits for the App Store release, when that account is needed anyway.
- Google Wallet: free (Google Wallet API, Google Cloud project, issuer account), but Job has to sign up and get approved, then a Supabase function signs the pass. Can be done before release if Job wants to do the sign-up.
- Samsung Wallet: own partner program with review. Google Wallet covers Samsung phones in the meantime.
- NFC "tap phones to add a friend": iPhone websites can't use NFC. Android Chrome can read and write NFC tags (Web NFC), but phone-to-phone tapping isn't possible from a website. In a native app, iPhone and Android can both read tags. A cheap NFC sticker/keyring with your add-friend link works on any phone today (the phone opens the link). The QR code on the card does the same job now.

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
