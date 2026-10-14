# JobDone

A personal strength and body tracker, built for iPhone: custom splits, two-tap set logging with last-session comparisons and PR detection, daily weigh-ins, steps, and progress charts. It installs to the home screen as an app and saves to your account (Supabase), with Google or email-code sign-in.

- **Live site:** the `web/` folder, served as-is by Vercel (see `vercel.json`).
- **Set it up:** follow [SETUP.md](SETUP.md) (Supabase, Vercel or Netlify, Google sign-in).
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
The look is a dark "night-session HUD": a still background: a soft volt and cool-blue glow on black with an X-ray skeleton (drawn by `tools/skeleton.py`), frosted-glass panels, a floating glass tab bar, condensed uppercase display type, monospace labels, and motion (panels rise in, numbers count up, charts draw in, the Start button breathes). Motion turns off when the phone asks for reduced motion. The display font is Bebas Neue (SIL Open Font License), inlined at build time from `fonts/`.
