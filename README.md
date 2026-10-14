# JobDone

A personal strength and body tracker, built for iPhone: custom splits, two-tap set logging with last-session comparisons and PR detection, daily weigh-ins, steps, and progress charts. It installs to the home screen as an app and saves to your account (Supabase), with email and password sign-in.

- **Live site:** the `web/` folder, served as-is by Vercel (see `vercel.json`).
- **Set it up:** follow [SETUP.md](SETUP.md) (Supabase, then Vercel or Netlify).
- **Database:** [schema.sql](schema.sql), one table with per-user row-level security.

## Source
| Path | What it is |
|---|---|
| `app.js`, `styles.css` | The whole app (vanilla JS, no framework) |
| `web-src/` | Website shell, manifest, offline worker, icons, vendored supabase-js 2.45.4 |
| `web/config.js` | Your Supabase URL and anon key (never overwritten by the build) |
| `build.py` | `python3 build.py` rebuilds `web/index.html` from the source |

No personal training data is stored in this repository. Your log lives in your own Supabase account; bring it in with **Me → Restore from a backup**.

## Design
Five themes under Me → Theme, saved to the account. **Cliffs** is the default: an outdoor crag with mountains and water whose sky follows the phone's clock (sunrise, day, sunset, night with stars and moon; cards go dark at night). **Climbing** is a chalk gym wall covered in rock-shaped holds. **Venom** is symbiote black with dripping goo. **Spider** is deep blue and hero red with web lines. **Miles** is black and red with comic halftone and flickering venom-blast lightning. None use official logos. Type is Nunito (SIL Open Font License, inlined from `fonts/`). Buttons press in, finished sets pop, and PRs throw confetti in the theme's colours. Motion turns off when the phone asks for reduced motion.
