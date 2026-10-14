# Put JobDone on your own website

About 20 minutes, all free. You need two free accounts: **Supabase** (sign-in and saving) and **Vercel or Netlify** (the website).

## 1. Make the database (Supabase)
1. Go to https://supabase.com, sign up, and click **New project**. Name it `jobdone`, pick a strong database password, and choose the region nearest you.
2. When it's ready, open **SQL Editor → New query**, paste everything from `schema.sql` (in your JobDone repository on GitHub), and click **Run**. This creates one table where each person can only ever see their own data.
3. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
4. On GitHub, open `web/config.js` in your JobDone repository, click the pencil icon to edit, paste them between the quotes, and click **Commit changes**:
   ```js
   supabaseUrl: 'https://abcdefghijkl.supabase.co',
   supabaseAnonKey: 'eyJhbGciOi...',
   ```
   The anon key is meant to be public. Your data is protected by the rule from step 2.

## 2. Turn on email codes
1. In Supabase, open **Authentication → Emails → Templates → Magic Link**.
2. Set the subject to `Your JobDone code` and replace the body with:
   ```html
   <h2>Your JobDone sign-in code</h2>
   <p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p>
   <p>It expires in one hour. If you didn't ask for it, ignore this email.</p>
   ```
3. Save. Supabase's built-in mailer only sends a few emails an hour. To send from your own address with no limit, add an email service such as Resend under **Authentication → Emails → SMTP Settings** (optional).

## 3. Put the site online (Vercel or Netlify)
Pick one. Both are free and both give you an https link that works for the home-screen app.

**Option A: Vercel (recommended, your code is already on GitHub)**
1. Sign up at https://vercel.com with your GitHub account.
2. Click **Add New → Project**, find **JobDone**, and click **Import**. Leave every setting as it is (the included `vercel.json` tells Vercel to serve the `web` folder) and click **Deploy**.
3. You get a link like `https://jobdone-xyz.vercel.app`. You can rename it under **Project → Settings → Domains**.
4. Every time the repository changes (for example when you edit `web/config.js`, or when Claude pushes an update), Vercel redeploys on its own.

**Option B: Netlify (simplest, no GitHub)**
1. Go to https://app.netlify.com/drop and sign up.
2. Download `jobdone-web.zip` from the project, unzip it, put your keys in its `config.js`, and drag the unzipped folder onto the page. You get a link like `https://random-name-123.netlify.app`.
3. Optional: **Site configuration → Change site name** to something like `jobdone-job`.
4. To update later, open your site in Netlify → **Deploys** and drag the folder in again.

## 4. Tell Supabase your website address
In Supabase, open **Authentication → URL Configuration**:
- **Site URL:** your site link, e.g. `https://jobdone-job.vercel.app` or `https://jobdone-job.netlify.app`
- **Redirect URLs:** add the same link. If you move hosts later, update both.

## 5. Sign-in
JobDone signs in with email and password. Supabase's **Email** provider (on by default) covers this.
New accounts get one confirmation email; tap its link, then sign in. "Forgot password?" emails a
link that opens JobDone to set a new one.

## 6. Install it on your iPhone
1. Open your site link in **Safari**.
2. Tap **Share → Add to Home Screen → Add**. JobDone opens full screen with its own icon, like a normal app.
3. Sign in with your email and password.
4. Bring your data over: in the Claude version of JobDone, go to **Me → Export JSON** and save the file (to iCloud Drive or Files). On the website's welcome screen, tap **Choose backup or CSV file** and pick it. Your workouts, weights, steps and splits all come across.

The website itself contains none of your training data. It only lives in your Supabase account, which only you can sign in to.
