// Creates an account that is ready to use straight away (no confirmation email), so friends can sign up
// without custom email set up. Guards: honeypot field, minimum fill time, 5 sign-ups per IP per hour,
// and the same answer whether or not the email already has an account.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
async function sha256hex(s: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (Number(req.headers.get('content-length') || 0) > 4000) return json(413, { error: 'Too much data' });
  let b: any = {};
  try { b = JSON.parse((await req.text()) || '{}'); } catch { return json(400, { error: 'Bad request' }); }
  const email = String(b.email || '').trim().toLowerCase(), password = String(b.password || ''), name = String(b.name || '').trim().slice(0, 40);
  // Bots fill the hidden "website" field and submit instantly.
  if (b.website || Number(b.ms || 0) < 1500) return json(200, { ok: true });
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return json(400, { error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 72) return json(400, { error: 'Use a password of at least 8 characters.' });
  if (!b.age) return json(400, { error: 'Please confirm you are 13 or older.' });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256hex('jd-signup:' + ip);
  const since = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await db.from('jobdone_signup_log').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('at', since);
  if ((count || 0) >= 5) return json(429, { error: 'Too many sign-ups from this network. Try again in an hour.' });
  await db.from('jobdone_signup_log').insert({ ip_hash: ipHash });

  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: name ? { name } : {} });
  // An existing email gets the same reply; signing in afterwards simply fails with "wrong email or password".
  if (error && !/already|registered|exists/i.test(error.message)) return json(500, { error: 'Could not create the account. Try again.' });
  return json(200, { ok: true });
});
