# How I like my apps built

These come from building Job's Done. They should hold for any app I make.

## Cost and setup
- Free only. No paid plans, paid APIs or domains. If something needs money, tell me and find a free way.
- Keep the setup as simple as it can be. Do the chores for me rather than handing me a list of steps.
- Ask before installing new tools.
- Never put secrets in the repo or the frontend. Public keys that are meant to be public are fine.

## How we work
- Changes go on a branch. Pushing to main makes them live, so ask me first.
- I change my mind often. Show me a screenshot of every UI change before calling it done.
- If I send a design for one part, change only that part.
- I read replies on my phone. Keep them short and start with the result.
- If my request could mean two things, start on the likelier one and tell me which you picked.

## Writing in the app
- Plain, human words. Nothing that sounds like AI: no stock words, no "not X but Y", no forced lists of three, no filler.
- Write for any new user, not about me.
- Labels stay short. A bit of personality in small places (pop-ups, finish screens) is good if each line is short.

## Design
- Detailed but not busy.
- Themes keep the same layout and the same heights. Only the look changes.
- I keep a classic look I like. Don't "modernise" it into a generic iOS style.
- No lime green.
- Skip the generic AI look (purple gradients, three rounded cards).

## Behaviour I want
- Phone first. It should feel like an installed app.
- Stay signed in. Email and password only. No Google sign-in, no email codes.
- No welcome screen and no demo account. A short first-run setup for new accounts is fine.
- Sounds mix over my music and follow the silent switch. Nothing may pause my music.
- Fast input: the common action takes one or two taps.
- Show progress against last time (last session, personal bests) so I can see how I'm doing at a glance.
- Things that are easy to share: links, share cards in standard sizes.
- Data I can bring in and take out (CSV import, backups).

## Things to never add
- Nagging, reminders I didn't ask for, or advice telling me what to change.
- Features outside the app's job (for example, no calorie tracking in a workout app).
- Stock pictures where a simple diagram does the job.

## Security basics for any app with users
- HTTPS with HSTS, security headers, row-level security on the database.
- Rate limits on sign-in and sign-up, no user enumeration, limits on input size.
- Daily backups, and a privacy page that matches what the app actually does.
