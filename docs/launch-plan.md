# Job's Done launch plan: App Store + Play Store, 1 January 2027

Written 14 Nov 2026. Goal: live in both stores for New Year, Sweetheart theme for Valentine's,
₱1M/year (≈14,000 monthly active users at ~4% paying ₱149) by late 2027.

## The one deadline that decides everything
Google Play: new personal developer accounts must run a **closed test with at least 12 testers for 14 days**
before they can publish. To be live on 1 Jan, that test must start by **about 10 Dec**. Apple review is usually
1–3 days, but leave a week for a rejection and resubmit.

## Timing note (14 Nov)
Job wants the native build work (Android Studio, Capacitor) to wait for his Christmas break in December.
If the Android closed test can't start by ~10 Dec, Play Store slips to mid-January; the App Store can still make 1 Jan.

## Who does what
**Job (only you can):** pay and sign up for the developer accounts, sign up for free services in your name,
film videos, recruit 12+ Android testers, approve pushes and SQL.
**Claude:** all code, the native wrapper, store listings and screenshots, ASO keywords, privacy labels,
video scripts and captions, launch posts, the rejection checklist, server limits, weekly numbers check.

## Week by week
| Week | Job | Claude |
|---|---|---|
| 16–22 Nov | Apple Developer ($99/yr) + Google Play ($25 once). Free Resend account for emails. | Capacitor wrapper (free), app icon + splash, password-reset emails working, Pro decision doc |
| 23–29 Nov | Line up 12+ Android testers (gym, friends, family) | Native push (Android + iPhone), haptics, Restore Purchases groundwork, in-app account deletion check |
| 30 Nov–6 Dec | Free RevenueCat account | Pro paywall with in-app purchase (RevenueCat), Android build into internal testing |
| 7–13 Dec | Testers install the closed test (by ~10 Dec) | Store listings: copy, screenshots per theme, privacy labels, age rating 13+ |
| 14–20 Dec | Film launch videos (scripts ready) | iPhone build + App Store submission, demo login + reviewer notes |
| 21–27 Dec | Approve the final release | Google production request after day 14, fix anything review flags, schedule posts |
| 1 Jan | Post the launch video | Watch the Admin page and errors all day |
| 8 Jan ("Quitter's Day") | Post the "still going?" video | Streak/comeback push, check retention |
| 1 Feb | Tease Sweetheart | Ship Sweetheart theme + duo features for 14 Feb |

## iPhone builds without a Mac
Options, all free: Codemagic free plan (cloud Macs, 500 min/month), xtool via WSL on this PC, or a borrowed Mac.

## Server limits to fix before growth (nothing-paid rule)
- Rest alerts: one function call each; ~3,000 active users passes Supabase's free 500k calls/month. Batch them.
- Database: workout history nears the free 500 MB around a few thousand users. Trim or compress old data.
- Vercel Hobby is non-commercial. The store apps carry the app files themselves, so Vercel only serves the website.
- Password resets need an email sender (Resend free: 3,000/month).

## Decisions waiting on Job
1. ~~Developer fees~~ Approved 14 Nov. Paid services for security and the production stack start after release.
2. Pro price (suggest ₱149/month, ₱1,190/year) and launch date for Pro (at launch or later).
3. How iPhone builds get made (Codemagic, xtool, or a Mac).
