// Rest-done notifications for the Home Screen app (Web Push).
// The app sends its push subscription and, when a rest timer starts, the time it ends.
// A pg_cron job (jobdone-rest-push, every 5 seconds) calls this function with x-cron-key when an alert is due,
// and the function sends the push. VAPID keys and the cron key live in public.jobdone_private (service role only).
// Deployed as the Supabase edge function "rest-push" with verify_jwt = false: it checks the user's token itself.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

let cfg: Record<string, string> | null = null;
async function conf() {
  if (cfg) return cfg;
  const { data } = await db.from('jobdone_private').select('k, v');
  cfg = Object.fromEntries((data || []).map((r: any) => [r.k, r.v]));
  webpush.setVapidDetails('https://jobdone-peach.vercel.app', cfg.vapid_public, cfg.vapid_private);
  return cfg;
}

async function sendTo(userId: string, payload: unknown) {
  const { data: subs } = await db.from('jobdone_push_subs').select('endpoint, p256dh, auth').eq('user_id', userId);
  let ok = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 120, urgency: 'high' });
      ok++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('jobdone_push_subs').delete().eq('endpoint', s.endpoint);
      else console.log('push failed', e?.statusCode, String(e?.body || e).slice(0, 200));
    }
  }
  return ok;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const c = await conf();

  // Cron: send every alert that is due.
  const ck = req.headers.get('x-cron-key');
  if (ck) {
    if (ck !== c.cron_key) return json(401, { error: 'bad key' });
    const { data: due } = await db.from('jobdone_rest_alerts').update({ sent: true }).eq('sent', false).lte('due_at', new Date(Date.now() + 2000).toISOString()).select('user_id, title, body, due_at');
    let n = 0;
    for (const a of due || []) {
      const wait = new Date(a.due_at).getTime() - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, Math.min(wait, 2000)));
      n += await sendTo(a.user_id, { title: a.title, body: a.body, tag: 'rest' });
    }
    return json(200, { sent: n });
  }

  // App calls: signed-in user only.
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = await db.auth.getUser(tok);
  const uid = u?.user?.id;
  if (!uid) return json(401, { error: 'Sign in first' });
  let b: any = {};
  try { b = await req.json(); } catch { return json(400, { error: 'Body must be JSON' }); }

  if (b.action === 'key') return json(200, { key: c.vapid_public });
  if (b.action === 'sub') {
    const s = b.sub || {};
    if (typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return json(400, { error: 'Bad subscription' });
    const { error } = await db.from('jobdone_push_subs').upsert({ endpoint: s.endpoint, user_id: uid, p256dh: s.keys.p256dh, auth: s.keys.auth });
    return error ? json(500, { error: 'Could not save' }) : json(200, { ok: true });
  }
  if (b.action === 'unsub') { await db.from('jobdone_push_subs').delete().eq('user_id', uid).eq('endpoint', String(b.endpoint || '')); return json(200, { ok: true }); }
  if (b.action === 'at') {
    const due = Number(b.due), now = Date.now();
    if (!(due > now - 5000 && due < now + 30 * 60e3)) return json(400, { error: 'Rest must end within 30 minutes' });
    const body = String(b.body || 'Time for your next set.').slice(0, 120), title = String(b.title || 'Rest done').slice(0, 60);
    const { error } = await db.from('jobdone_rest_alerts').upsert({ user_id: uid, due_at: new Date(due).toISOString(), title, body, sent: false });
    return error ? json(500, { error: 'Could not save' }) : json(200, { ok: true });
  }
  if (b.action === 'cancel') { await db.from('jobdone_rest_alerts').delete().eq('user_id', uid); return json(200, { ok: true }); }
  if (b.action === 'test') return json(200, { sent: await sendTo(uid, { title: 'JobDone', body: 'Rest alerts are on. You will get one when rest ends.', tag: 'rest' }) });
  return json(400, { error: 'Unknown action' });
});
