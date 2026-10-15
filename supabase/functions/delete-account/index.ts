// Deletes the signed-in user's account. Their rows in jobdone_docs and jobdone_sync_keys go with it
// (on delete cascade). Requires the user's own session token (verify_jwt on).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'Sign in again, then try.' });
  const id = data.user.id;
  await admin.from('jobdone_docs').delete().eq('user_id', id);
  await admin.from('jobdone_sync_keys').delete().eq('user_id', id);
  await admin.from('jobdone_feedback').delete().eq('user_id', id);
  const { error: derr } = await admin.auth.admin.deleteUser(id);
  if (derr) return json(500, { error: 'Could not delete the account. Try again.' });
  return json(200, { ok: true });
});
