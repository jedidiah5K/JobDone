// Receives daily step counts from an Apple Shortcut and merges them into the user's jd/steps doc.
// Auth is a per-user sync key (only its sha256 is stored in jobdone_sync_keys), so verify_jwt is off.
// Deployed as the Supabase edge function "steps" with verify_jwt = false.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, msg: string) => new Response(msg, { status, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });

async function sha256hex(s: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, 'Use POST');
  if (Number(req.headers.get('content-length') || 0) > 20000) return reply(413, 'Too much data');
  let body: any = {};
  try { body = JSON.parse((await req.text()) || '{}'); } catch { return reply(400, 'Body must be JSON'); }
  const key = ((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || String(body.key || '')).trim();
  if (key.length < 20) return reply(401, 'Missing sync key');
  const { data: row, error: kerr } = await db.from('jobdone_sync_keys').select('user_id').eq('key_hash', await sha256hex(key)).maybeSingle();
  if (kerr) return reply(500, 'Could not check key');
  if (!row) return reply(401, 'Sync key not recognised. Make a new one in JobDone: Me, Steps from QWatch.');

  // Lines like "2026-10-14 6,120" (same format the app's paste box takes), or { days: { date: n } }.
  const got: Record<string, number> = {};
  const add = (d: string, v: number) => { got[d] = (got[d] || 0) + v; };
  if (typeof body.text === 'string') {
    for (const line of body.text.split(/\r?\n/)) {
      const m = line.trim().match(/^(\d{4}-\d{2}-\d{2})\D+?([\d][\d,]*(?:\.\d+)?)\s*(steps?)?\s*$/i);
      if (m) add(m[1], parseFloat(m[2].replace(/,/g, '')));
    }
  }
  if (body.days && typeof body.days === 'object') for (const [d, v] of Object.entries(body.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) add(d, Number(v));
  const now = Date.now(), max = ymd(new Date(now + 36 * 3600e3)), min = ymd(new Date(now - 31 * 86400e3));
  const days: Record<string, number> = {};
  for (const [d, v] of Object.entries(got)) { const n = Math.round(v); if (d >= min && d <= max && n >= 0 && n <= 150000) days[d] = n; }
  const keys = Object.keys(days).sort();
  if (!keys.length) return reply(400, 'No valid days found. Send lines like: 2026-10-14 6120');

  const { data: doc, error: rerr } = await db.from('jobdone_docs').select('body').eq('user_id', row.user_id).eq('path', 'jd/steps').maybeSingle();
  if (rerr) return reply(500, 'Could not read steps');
  const e = { ...((doc?.body as any)?.e || {}), ...days };
  const { error: werr } = await db.from('jobdone_docs').upsert({ user_id: row.user_id, path: 'jd/steps', body: { ...((doc?.body as any) || {}), e }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,path' });
  if (werr) return reply(500, 'Could not save steps');
  const last = keys[keys.length - 1];
  return reply(200, `Saved ${keys.length} day${keys.length > 1 ? 's' : ''} · ${last} ${days[last].toLocaleString('en-US')} steps`);
});
