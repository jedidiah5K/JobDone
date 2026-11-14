# Free services: how to set them up (Job, 14 Nov 2026)

Sign up with your own email. Never paste a **secret** key into chat; public keys are fine to send.

## 1. GitHub secret scanning + Dependabot (5 min)
Your repo is public, so these are free.
1. github.com/jedidiah5K/JobDone → **Settings** (top tab) → left menu **Advanced Security** (on some accounts it's called **Code security**).
2. Turn on, top to bottom:
   - **Dependency graph**
   - **Dependabot alerts**
   - **Dependabot security updates**
   - **Secret scanning** → also turn on **Push protection** (blocks a push that contains a key)
3. Done. GitHub emails you if something leaks or a dependency has a hole.
   The repo now has `.github/dependabot.yml`, which checks the workflow tools weekly.

## 2. Sentry: crash reports from real phones (5 min)
Worth having now, but it matters most once the native app exists.
1. sentry.io → **Start for free** → sign up.
2. Create a project → platform **Browser JavaScript** → name it `jobdone`.
3. Copy the **DSN** (looks like `https://abc123@o12345.ingest.sentry.io/678`). It's public, so you can send it to me.
4. I'll add it to the app. Settings I'll use: errors only, no session replay, no personal data.

## 3. Cloudflare Turnstile: stops bots signing up (10 min)
1. dash.cloudflare.com → sign up (free) → left menu **Turnstile** → **Add widget**.
2. Widget name `Job's Done sign-up`. Hostnames: `jobdone-peach.vercel.app` and `localhost`.
3. Widget mode **Managed** → Create.
4. You get two keys:
   - **Site key** (public): send it to me.
   - **Secret key**: don't send it. Supabase dashboard → project jobdone → **Edge Functions** → **Secrets** → Add `TURNSTILE_SECRET` = the secret key.
5. I'll add the check to the sign-up screen and the `signup` function.

## 4. Resend: password-reset emails (needs a domain)
Resend only sends to other people from a domain you own. `jobdone-peach.vercel.app` can't be used, because you can't change its DNS records.
- **Now:** sign up at resend.com anyway (free, 3,000 emails/month). It can send test emails to your own address.
- **To make resets work for everyone:** a domain like `jobsdone.app` or `getjobsdone.com`, about ₱600–1,000 a year.
  It also gives you a real support email and website link for the App Store and Play Store listings.
  This is a paid item, so it's your call (fits "pay for essentials at release").
- Once there's a domain: Resend → **Domains** → add it → copy the DNS records it shows into the domain's settings → verify.
  Then Resend → **API Keys** → create one. Don't send it to me: Supabase → **Project Settings** → **Authentication** → **SMTP** → host `smtp.resend.com`, port 465, user `resend`, password = the API key.

## UptimeRobot
Already done. Check it monitors `https://jobdone-peach.vercel.app` every 5 minutes, with alerts to your email.
