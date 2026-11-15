// Forgot password without email (v199): email + the account's recovery code + a new password.
// Guards: 5 tries per network and 5 per email every 15 minutes, the same answer for an unknown email or a wrong
// code, bots' hidden field, and every device signed out after a reset.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': 'https://jobdone-peach.vercel.app', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
async function sha256hex(s: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const NO = 'That email and recovery code don’t match.';

const handle = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (Number(req.headers.get('content-length') || 0) > 2000) return json(413, { error: 'Too much data' });
  let b: any = {};
  try { b = JSON.parse((await req.text()) || '{}'); } catch { return json(400, { error: 'Bad request' }); }
  if (b.website) return json(400, { error: NO });
  const email = String(b.email || '').trim().toLowerCase(), code = String(b.code || ''), password = String(b.password || '');
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email) || code.length > 20) return json(400, { error: NO });
  if (password.length < 8 || password.length > 72) return json(400, { error: 'Use a password of at least 8 characters.' });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const kIp = 'ip:' + await sha256hex('jd-recover:' + ip), kEm = 'em:' + await sha256hex('jd-recover:' + email);
  const since = new Date(Date.now() - 15 * 60e3).toISOString();
  const [a, e] = await Promise.all([kIp, kEm].map(k => db.from('jobdone_recover_tries').select('*', { count: 'exact', head: true }).eq('k', k).gte('at', since)));
  if ((a.count || 0) >= 5 || (e.count || 0) >= 5) return json(429, { error: 'Too many tries. Wait 15 minutes.' });
  await db.from('jobdone_recover_tries').insert([{ k: kIp }, { k: kEm }]);

  const { data: uid, error } = await db.rpc('jobdone_recovery_check', { p_email: email, p_code: code });
  if (error) return json(500, { error: 'Something went wrong. Try again.' });
  if (!uid) return json(400, { error: NO });
  const up = await db.auth.admin.updateUserById(uid, { password });
  if (up.error) return json(400, { error: /weak|pwned|leak/i.test(up.error.message) ? 'Pick a stronger password.' : 'Couldn’t change the password. Try again.' });
  await db.rpc('jobdone_recovery_used', { p_user: uid });
  return json(200, { ok: true });
};

// Browsers may only call this from the site itself (or local dev).
const ORIGINS = ['https://jobdone-peach.vercel.app', 'http://localhost:8000'];
Deno.serve(async req => {
  const res = await handle(req), o = req.headers.get('origin') || '';
  res.headers.set('Access-Control-Allow-Origin', ORIGINS.includes(o) ? o : ORIGINS[0]); res.headers.set('Vary', 'Origin');
  return res;
});
