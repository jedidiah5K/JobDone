'use strict';
/* JobDone: single-user strength + body tracker. Vanilla JS, no build step.
   Data lives in the artifact's db (synced to Job's claude.ai account) with a localStorage cache. */

// ---------- utils ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const ts = s => parseYmd(s).getTime();
const DAY = 864e5;
const daysBetween = (a, b) => Math.round((ts(b) - ts(a)) / DAY);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDate = (s, o = {}) => { const d = parseYmd(s); return (o.wd ? WD[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MON[d.getMonth()] + (o.y ? ' ' + d.getFullYear() : ''); };
const mondayOf = s => { const d = parseYmd(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return ymd(d); };
const relDay = s => { const n = daysBetween(s, today()); return n === 0 ? 'today' : n === 1 ? 'yesterday' : n < 7 ? n + ' days ago' : fmtDate(s, { wd: true }); };
const fmtDur = ms => { const m = Math.max(0, Math.floor(ms / 6e4)); if (m < 1) return 'under 1 min'; return m >= 60 ? Math.floor(m / 60) + 'h ' + pad2(m % 60) + 'm' : m + ' min'; };
const clock = s => Math.floor(s / 60) + ':' + pad2(Math.floor(s % 60));
// Wall-clock time like 3:00 pm (start of a workout, end of a rest).
const hm = t => { const d = new Date(t); let h = d.getHours(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + ':' + pad2(d.getMinutes()) + ' ' + ap; };
const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
const fmtRest = v => Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
const REST_OPTS_X = v => v && ![60, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600].includes(v) ? [v] : [];
const n0 = v => Math.round(v).toLocaleString('en-US');
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let hapEl = null;
// Android vibrates; iPhone (iOS 18+) gives a light tap when a hidden switch is toggled.
const buzz = ms => {
  try {
    if (navigator.vibrate) { navigator.vibrate(ms); return; }
    if (!IOS) return;
    if (!hapEl) { hapEl = document.createElement('label'); hapEl.setAttribute('aria-hidden', 'true'); hapEl.style.cssText = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none'; hapEl.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(hapEl); }
    hapEl.click();
  } catch (e) {}
};

// ---------- exercise library ----------
const LIB_RAW = `Chest Fly|Chest|machine;Incline Press|Chest|machine;Bench Press|Chest|barbell;Incline Bench Press|Chest|barbell;Decline Bench Press|Chest|barbell;Dumbbell Bench Press|Chest|dumbbell;Incline Dumbbell Press|Chest|dumbbell;Chest Press|Chest|machine;Smith Bench Press|Chest|smith;Cable Crossover|Chest|cable;Low-to-High Cable Fly|Chest|cable;Dumbbell Fly|Chest|dumbbell;Pec Deck|Chest|machine;Push-Up|Chest|bodyweight;Dip|Chest|bodyweight;
Lat Pulldown|Back|cable;Wide-Grip Row|Back|cable;Close-Grip Row|Back|cable;Seated Cable Row|Back|cable;Barbell Row|Back|barbell;Pendlay Row|Back|barbell;Dumbbell Row|Back|dumbbell;Chest-Supported Row|Back|machine;T-Bar Row|Back|machine;Machine Row|Back|machine;Pull-Up|Back|bodyweight;Chin-Up|Back|bodyweight;Assisted Pull-Up|Back|machine;Straight-Arm Pulldown|Back|cable;Single-Arm Pulldown|Back|cable;Deadlift|Back|barbell;Rack Pull|Back|barbell;Back Extension|Back|bodyweight;Shrug|Back|dumbbell;Face Pull|Shoulders|cable;
Shoulder Press|Shoulders|machine;Overhead Press|Shoulders|barbell;Dumbbell Shoulder Press|Shoulders|dumbbell;Arnold Press|Shoulders|dumbbell;Lateral Raise|Shoulders|cable;Dumbbell Lateral Raise|Shoulders|dumbbell;Machine Lateral Raise|Shoulders|machine;Front Raise|Shoulders|dumbbell;Rear Delt Fly|Shoulders|machine;Reverse Pec Deck|Shoulders|machine;Upright Row|Shoulders|cable;
Preacher Curl|Biceps|machine;Hammer Curl|Biceps|dumbbell;Barbell Curl|Biceps|barbell;EZ-Bar Curl|Biceps|barbell;Dumbbell Curl|Biceps|dumbbell;Incline Dumbbell Curl|Biceps|dumbbell;Cable Curl|Biceps|cable;Bayesian Curl|Biceps|cable;Concentration Curl|Biceps|dumbbell;Spider Curl|Biceps|dumbbell;Forearm Curl|Forearms|cable;Reverse Curl|Forearms|barbell;Wrist Curl|Forearms|dumbbell;Farmer's Carry|Forearms|dumbbell;
Single-Arm Tricep|Triceps|cable;Tricep Bar|Triceps|cable;Tricep Pushdown|Triceps|cable;Rope Pushdown|Triceps|cable;Overhead Tricep Extension|Triceps|cable;Skull Crusher|Triceps|barbell;Close-Grip Bench Press|Triceps|barbell;Dumbbell Kickback|Triceps|dumbbell;Tricep Dip Machine|Triceps|machine;
Cable Crunch|Abs|cable;Oblique Crunch|Abs|cable;Hanging Leg Raise|Abs|bodyweight;Ab Wheel|Abs|bodyweight;Crunch Machine|Abs|machine;Plank|Abs|bodyweight;Russian Twist|Abs|bodyweight;Pallof Press|Abs|cable;Woodchopper|Abs|cable;
Leg Press|Quads|machine;Leg Extension|Quads|machine;Back Squat|Quads|barbell;Front Squat|Quads|barbell;Hack Squat|Quads|machine;Smith Squat|Quads|smith;Goblet Squat|Quads|dumbbell;Bulgarian Split Squat|Quads|dumbbell;Walking Lunge|Quads|dumbbell;Pendulum Squat|Quads|machine;Step-Up|Quads|dumbbell;Sissy Squat|Quads|bodyweight;
Stiff-Leg Deadlift|Hamstrings|barbell;Romanian Deadlift|Hamstrings|barbell;Dumbbell RDL|Hamstrings|dumbbell;Leg Curl|Hamstrings|machine;Seated Leg Curl|Hamstrings|machine;Lying Leg Curl|Hamstrings|machine;Nordic Curl|Hamstrings|bodyweight;Good Morning|Hamstrings|barbell;
Hip Thrust|Glutes|barbell;Glute Bridge|Glutes|barbell;Cable Kickback|Glutes|cable;Abductor|Glutes|machine;Glute Drive|Glutes|machine;Adductor|Adductors|machine;Copenhagen Plank|Adductors|bodyweight;
Calf Raise|Calves|machine;Seated Calf Raise|Calves|machine;Standing Calf Raise|Calves|machine;Leg Press Calf Raise|Calves|machine;Donkey Calf Raise|Calves|machine`;
const LIB = LIB_RAW.split(';').map(s => s.trim()).filter(Boolean).map(s => { const [name, muscle, equip] = s.split('|'); return { name, muscle, equip }; });
// Equipment each built-in lift can really be done with (b barbell, d dumbbell, m machine, c cable, s smith, w bodyweight, n band, k kettlebell).
// Built-in lifts keep their muscle group; only custom exercises can be re-grouped (Job, 16 Oct).
const EQ_CODE = { b: 'barbell', d: 'dumbbell', m: 'machine', c: 'cable', s: 'smith', w: 'bodyweight', n: 'band', k: 'kettlebell' };
const EQ_OK = Object.fromEntries(`Chest Fly:mcd;Incline Press:mbds;Bench Press:bs;Incline Bench Press:bs;Decline Bench Press:bs;Dumbbell Bench Press:d;Incline Dumbbell Press:d;Chest Press:m;Smith Bench Press:s;Cable Crossover:c;Low-to-High Cable Fly:c;Dumbbell Fly:d;Pec Deck:m;Push-Up:w;Dip:wm;
Lat Pulldown:cm;Wide-Grip Row:cm;Close-Grip Row:cm;Seated Cable Row:c;Barbell Row:b;Pendlay Row:b;Dumbbell Row:dk;Chest-Supported Row:md;T-Bar Row:mb;Machine Row:m;Pull-Up:w;Chin-Up:w;Assisted Pull-Up:mn;Straight-Arm Pulldown:c;Single-Arm Pulldown:cm;Deadlift:b;Rack Pull:b;Back Extension:wm;Shrug:dbsm;Face Pull:cn;
Shoulder Press:ms;Overhead Press:bs;Dumbbell Shoulder Press:d;Arnold Press:d;Lateral Raise:cdmn;Dumbbell Lateral Raise:d;Machine Lateral Raise:m;Front Raise:dcbn;Rear Delt Fly:mcd;Reverse Pec Deck:m;Upright Row:cbds;
Preacher Curl:mbd;Hammer Curl:dc;Barbell Curl:b;EZ-Bar Curl:b;Dumbbell Curl:d;Incline Dumbbell Curl:d;Cable Curl:c;Bayesian Curl:c;Concentration Curl:d;Spider Curl:db;Forearm Curl:cdb;Reverse Curl:bdc;Wrist Curl:dbc;Farmer's Carry:dk;
Single-Arm Tricep:c;Tricep Bar:c;Tricep Pushdown:c;Rope Pushdown:c;Overhead Tricep Extension:cd;Skull Crusher:bd;Close-Grip Bench Press:bs;Dumbbell Kickback:d;Tricep Dip Machine:m;
Cable Crunch:c;Oblique Crunch:cw;Hanging Leg Raise:w;Ab Wheel:w;Crunch Machine:m;Plank:w;Russian Twist:wdk;Pallof Press:cn;Woodchopper:cn;
Leg Press:m;Leg Extension:m;Back Squat:b;Front Squat:b;Hack Squat:m;Smith Squat:s;Goblet Squat:dk;Bulgarian Split Squat:dbsw;Walking Lunge:dbw;Pendulum Squat:m;Step-Up:dbw;Sissy Squat:wm;
Stiff-Leg Deadlift:bd;Romanian Deadlift:b;Dumbbell RDL:d;Leg Curl:m;Seated Leg Curl:m;Lying Leg Curl:m;Nordic Curl:w;Good Morning:bs;
Hip Thrust:bms;Glute Bridge:bwd;Cable Kickback:c;Abductor:m;Glute Drive:m;Adductor:m;Copenhagen Plank:w;
Calf Raise:msdw;Seated Calf Raise:m;Standing Calf Raise:ms;Leg Press Calf Raise:m;Donkey Calf Raise:mw`.split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.lastIndexOf(':'); return [s.slice(0, i), [...s.slice(i + 1)].map(c => EQ_CODE[c])]; }));
const libEx = n => LIB.find(e => e.name === n);
const eqOptions = n => libEx(n) ? (EQ_OK[n] || [libEx(n).equip]) : EQUIP;
const EQUIP = ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'bodyweight', 'band', 'kettlebell', 'other'];
const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves', 'Other'];
const baseName = n => n.replace(/\s*\((L|R)\)$/, '');
// Left and right versions of one lift (unilateral) are shown together as one row (Job, 15 Oct).
// rows: [{ name, sets: [...] }] -> [{ name, txt }] where txt joins both sides.
function mergeLR(rows, fmt) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], nx = rows[i + 1];
    if (sideOf(r.name) === 'L' && nx && sideOf(nx.name) === 'R' && baseName(nx.name) === baseName(r.name)) {
      const a = fmt(r), b = fmt(nx);
      out.push({ name: baseName(r.name), txt: a === b ? a + ' each side' : 'L ' + a + ' · R ' + b, uni: true }); i++;
    } else out.push({ name: r.name, txt: fmt(r) });
  }
  return out;
}
const sideOf = n => (n.match(/\((L|R)\)$/) || [])[1] || null;
// The plate loader only makes sense where you slide plates onto a bar.
// Plate loader opens first for anything loaded with plates (Job's machines are plate-loaded); dumbbells, cables and bodyweight go straight to the dial.
// Job's existing Shortcut is called JobDone steps; everyone else gets the app's real name.
const SC_NAME = () => S && S.profile && S.profile.owner ? 'JobDone steps' : 'Job’s Done steps';
// Rest: one default in Me, with an optional override per exercise (from its ⋯ menu).
const restFor = name => ((S.profile.restBy || {})[baseName(name)]) || S.profile.defaultRest || 120;
const usesPlates = name => !['dumbbell', 'cable', 'bodyweight', 'kettlebell', 'band'].includes(exInfo(name).equip);
function exInfo(name) {
  const b = baseName(name);
  const c = (S.customEx || []).find(e => e.name === b), l = libEx(b);
  if (l) return c && eqOptions(b).includes(c.equip) ? { name: b, muscle: l.muscle, equip: c.equip } : l;
  return c || { name: b, muscle: 'Other', equip: 'other' };
}

// ---------- seed data (section 4 + section 10 of the build prompt) ----------
// Personal seed (Job’s log and profile notes) is injected only into the Claude version at build time.
const SEED = /*SEED*/{ log: [], weights: [], moved: [], noname: null, assumptions: [], today: null, profile: {} };
const SEED_LOG = SEED.log;
// The public website build ships without Job's personal log; data arrives by restoring a backup instead.
const PUBLIC = SEED_LOG.length === 0;
const SPLIT_COLORS = { Push: '#FF8A5C', Pull: '#5CB8FF', Upper: '#B38CFF', Legs: '#3DDC97', Anterior: '#FFC94D', Posterior: '#FF6FA8' };
const PALETTE = ['#FF8A5C', '#5CB8FF', '#B38CFF', '#3DDC97', '#FFC94D', '#FF6FA8', '#7EE0E0', '#A1A1AA'];
const SEED_WEIGHTS = SEED.weights, MOVED = SEED.moved, NONAME = SEED.noname, ASSUMPTIONS = SEED.assumptions;

// ---------- state ----------
let LS_KEY = 'jobdone.v1';
// Hosted version (own website): config.js sets window.JOBDONE_CONFIG with Supabase keys.
const CFG = window.JOBDONE_CONFIG || null;
const APP_VER = '2026.10.17';
const HOSTED = !!(CFG && CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
let SB = null, USER = null;
// Rest-done notifications (Web Push, Home Screen app only). The server sends the push when rest ends, even with the phone locked.
const pushReady = () => HOSTED && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:';
async function restFn(body) {
  try {
    const { data } = await SB.auth.getSession(); const tok = data && data.session && data.session.access_token; if (!tok) return null;
    const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/rest-push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: CFG.supabaseAnonKey }, body: JSON.stringify(body) });
    return await r.json().catch(() => null);
  } catch (e) { return null; }
}
const b64u = s => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushOn() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications are off for Job’s Done. Turn them on in Settings, Notifications, Job’s Done.'); return false; }
    const reg = await navigator.serviceWorker.ready;
    const k = await restFn({ action: 'key' }); if (!k || !k.key) { toast('Could not reach the server. Try again.'); return false; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.key) });
    const r = await restFn({ action: 'sub', sub: sub.toJSON() }); return !!(r && r.ok);
  } catch (e) { toast('Could not turn on notifications on this phone.'); return false; }
}
async function pushOff() { try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { restFn({ action: 'unsub', endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch (e) {} }
let restPushSent = 0;
function syncRestPush() {
  if (!HOSTED || !S || !S.profile || !S.profile.restPush) return;
  const due = A && REST && !REST.paused ? Math.round(REST.end / 1000) * 1000 : 0;
  if (due === restPushSent) return;
  const was = restPushSent; restPushSent = due;
  if (due) { const ex = A.ex && A.ex.find(e => e.sets && e.sets.some(x => !x.done)); restFn({ action: 'at', due, title: 'Rest done', body: ex ? 'Next set: ' + ex.name : 'Time for your next set.' }); }
  else if (was && Date.now() < was - 1500) restFn({ action: 'cancel' });
}
let S = null;        // persisted app state
let A = null;        // active workout in progress
let UI = { lastPrompt: null };
let NAV = { tab: 'today', stack: [], prog: 'body', range: '6M' };
let IX = null;
let DB = null, DL = null;
let mode = 'pending'; // cloud | local
let syncState = 'ok';
let ready = false;
let REST = null;      // {end, total}
let welcomeOv = {};
let DEMO = false;     // sample account in memory for screenshots only (no button since Job removed it 15 Oct), nothing saved   // assumption overrides on the welcome screen

function freshState() {
  return {
    v: 1,
    profile: Object.assign({ name: firstName(), heightCm: null, unit: 'kg', stepGoal: 10000, weeklyTarget: 4, defaultRest: 300, sound: true }, SEED.profile),
    splits: [], rotation: [], customEx: [], setup: {}, weights: {}, steps: {}, workouts: {}, imported: false, created: Date.now(),
  };
}
const invalidate = () => { IX = null; };

// ---------- storage ----------
function lsLoad() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function lsSave() { if (DEMO) return; try { localStorage.setItem(LS_KEY, JSON.stringify({ S, A, UI })); } catch (e) {} }
const dirty = new Set(), inflight = new Set();
let flushT = null, retryT = null;
// Paths saved on this phone but not yet in the account. Kept in localStorage so they survive closing the app.
function pend() {
  if (pend.k !== LS_KEY) { pend.k = LS_KEY; try { pend.s = new Set(JSON.parse(localStorage.getItem(LS_KEY + ':pending') || '[]')); } catch (e) { pend.s = new Set(); } }
  return pend.s;
}
function pendSave() { try { localStorage.setItem(LS_KEY + ':pending', JSON.stringify([...pend()])); } catch (e) {} }
function persist(...paths) {
  if (DEMO) return;
  paths.forEach(p => pend().add(p)); pendSave();
  lsSave();
  if (!DB || !S) return;
  paths.forEach(p => dirty.add(p));
  clearTimeout(flushT); flushT = setTimeout(flush, 450);
}
function retrySoon(ms = 15000) { clearTimeout(retryT); retryT = setTimeout(() => { if (DB && S) { pend().forEach(p => dirty.add(p)); flush(); } }, ms); }
addEventListener('online', () => retrySoon(300));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && pend().size) retrySoon(500); });
const monthPath = date => 'months/' + date.slice(0, 7);
function flush() {
  for (const p of [...dirty]) {
    if (inflight.has(p)) continue;
    dirty.delete(p); inflight.add(p);
    writeDoc(p).finally(() => { inflight.delete(p); if (dirty.has(p)) { clearTimeout(flushT); flushT = setTimeout(flush, 250); } });
  }
}
async function flushNow() { clearTimeout(flushT); for (const p of [...dirty]) { dirty.delete(p); try { await writeDoc(p); } catch (e) {} } }
function docBody(p) {
  if (p === 'jd/meta') return { v: S.v, profile: S.profile, splits: S.splits, rotation: S.rotation, customEx: S.customEx, setup: S.setup || {}, meas: S.meas || {}, imported: S.imported, created: S.created, updated: Date.now() };
  if (p === 'jd/weights') return { e: S.weights };
  if (p === 'jd/steps') return { e: S.steps };
  if (p === 'jd/active') return { a: A || null, t: Date.now() };
  if (p.startsWith('months/')) {
    const m = p.slice(7), w = {};
    for (const x of Object.values(S.workouts)) if (x.date.slice(0, 7) === m) w[x.id] = x;
    return Object.keys(w).length ? { w } : null;
  }
  return null;
}
async function writeDoc(p, attempt = 0) {
  try {
    const body = docBody(p);
    if (body) await DB.doc(p).set(body); else await DB.doc(p).delete();
    if (!dirty.has(p)) { pend().delete(p); pendSave(); }
    if (!dirty.size) setSync('ok');
  } catch (e) {
    const code = e && e.code;
    if (code !== 'quota_exceeded' && navigator.onLine !== false && attempt < 3) { await sleep(700 * 2 ** attempt + Math.random() * 400); return writeDoc(p, attempt + 1); }
    retrySoon();
    setSync(code === 'quota_exceeded' ? 'err' : 'offline', code);
  }
}
function setSync(s, code) {
  const was = syncState; syncState = s;
  if (s === 'offline') { if (was !== 'offline') toast('No signal. Your sets are saved on this phone and will sync when you’re back online.', 3500); return; }
  if (s === 'ok' && was === 'offline') toast('Back online. Everything is synced.');
  if (s === 'err') toast(code === 'quota_exceeded' ? 'Storage is full. Export your data, then delete old workouts.' : 'Couldn’t save to your account. Your data is kept on this device and will retry.');
}
function allPaths() {
  const months = new Set(Object.values(S.workouts).map(w => monthPath(w.date)));
  return ['jd/meta', 'jd/weights', 'jd/steps', 'jd/active', ...months];
}
async function loadCloud() {
  const [m, w, s, a, months] = await Promise.all([DB.doc('jd/meta').get(), DB.doc('jd/weights').get(), DB.doc('jd/steps').get(), DB.doc('jd/active').get(), DB.collection('months').get()]);
  if (!m.exists) return false;
  const md = clone(m.data());
  const ns = Object.assign(freshState(), { v: md.v, profile: Object.assign(freshState().profile, md.profile), splits: md.splits || [], rotation: md.rotation || [], customEx: md.customEx || [], setup: md.setup || {}, meas: md.meas || {}, imported: md.imported, created: md.created });
  ns.weights = w.exists ? clone(w.data().e || {}) : {};
  ns.steps = s.exists ? clone(s.data().e || {}) : {};
  ns.workouts = {};
  for (const d of months.docs) Object.assign(ns.workouts, clone(d.data().w || {}));
  const ca = a.exists ? clone(a.data().a || null) : null;
  // keep whichever in-progress workout was touched last
  if (!A || (ca && (ca.touched || 0) > (A.touched || 0))) A = ca;
  else if (A && !ca && a.exists && (a.data().t || 0) > (A.touched || 0)) A = null;
  S = ns; if (renameLifts(S, A)) { invalidate(); persist(...allPaths()); }
  invalidate();
  return true;
}

// Lifts that were renamed or merged (Job, 16 Oct: Tricep Vulken is the same lift as Single-Arm Tricep, the one-arm cable pushdown).
// Runs on every load; the old name is kept on the entry as "was".
const RENAMED = { 'Tricep Vulken': 'Single-Arm Tricep' };
function renameLifts(st, act) {
  if (!st) return false; let n = 0;
  const fix = e => { if (!e || !e.name) return; const b = baseName(e.name), to = RENAMED[b]; if (!to) return; e.was = e.was || b; e.name = to + e.name.slice(b.length); n++; };
  for (const w of Object.values(st.workouts || {})) (w.ex || []).forEach(fix);
  for (const sp of st.splits || []) { const c = n; (sp.ex || []).forEach(fix); if (n > c) { const seen = new Set(); sp.ex = sp.ex.filter(e => !seen.has(e.name) && seen.add(e.name)); } }
  if (act) (act.ex || []).forEach(fix);
  for (const [from, to] of Object.entries(RENAMED)) {
    if (st.customEx) st.customEx = st.customEx.filter(e => e.name !== from);
    for (const k of ['setup']) if (st[k] && st[k][from] && !st[k][to]) { st[k][to] = st[k][from]; delete st[k][from]; n++; }
    const rb = st.profile && st.profile.restBy; if (rb && rb[from] != null) { if (rb[to] == null) rb[to] = rb[from]; delete rb[from]; n++; }
  }
  return n > 0;
}
// ---------- derived index ----------
const e1 = s => s.w * (1 + s.r / 30);
const validSet = s => s && s.w != null && s.r != null && s.r > 0 && s.t !== 'warm';
const setVol = s => (s.w != null && s.r != null && s.t !== 'warm') ? s.w * s.r : 0;
const exVol = sets => sets.reduce((a, s) => a + setVol(s), 0);
function topSet(sets) { let b = null; for (const s of sets) if (validSet(s) && (!b || s.w > b.w || (s.w === b.w && s.r > b.r))) b = s; return b; }
function maxE1(sets) { let m = 0; for (const s of sets) if (validSet(s)) m = Math.max(m, e1(s)); return m; }
const emptyBest = () => ({ maxW: 0, e1: 0, vol: 0, rep: {}, n: 0 });
function prTypes(s, b) {
  if (!validSet(s) || !b || b.n === 0) return [];
  const t = [];
  if (s.w > b.maxW + 1e-9) t.push('Heaviest');
  if (e1(s) > b.e1 + 0.05) t.push('e1RM');
  if (b.rep[s.w] != null && s.r > b.rep[s.w]) t.push('Reps');
  return t;
}
function applyBest(s, b) {
  if (!validSet(s)) return;
  b.maxW = Math.max(b.maxW, s.w); b.e1 = Math.max(b.e1, e1(s)); b.vol = Math.max(b.vol, s.w * s.r);
  b.rep[s.w] = Math.max(b.rep[s.w] || 0, s.r);
}
const sortW = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0);
function ix() {
  if (IX) return IX;
  const ws = Object.values(S.workouts).sort(sortW);
  const hist = {}, best = {}, prs = [];
  // One PR per exercise per session: left and right sides count as one lift, and only the strongest kind is kept.
  const RANK = { Heaviest: 3, e1RM: 2, Reps: 1 };
  for (const w of ws) {
    if (w.skipped) continue;
    const cand = {};
    for (const e of w.ex) {
      const b = best[e.name] || (best[e.name] = emptyBest());
      (hist[e.name] || (hist[e.name] = [])).push({ date: w.date, wid: w.id, sets: e.sets, note: e.note, top: topSet(e.sets), vol: exVol(e.sets), e1: maxE1(e.sets) });
      const types = new Set(); let star = null;
      for (const s of e.sets) { const t = prTypes(s, b); if (t.length) { t.forEach(x => types.add(x)); if (!star || e1(s) > e1(star)) star = s; } }
      if (types.size) {
        const top = [...types].sort((x, y) => RANK[y] - RANK[x])[0], k = baseName(e.name), c = cand[k];
        if (!c || RANK[top] > RANK[c.types[0]] || (RANK[top] === RANK[c.types[0]] && e1(star) > e1(c.set))) cand[k] = { date: w.date, wid: w.id, ex: e.name, set: star, types: [top] };
      }
      e.sets.forEach(s => applyBest(s, b));
      b.n++;
    }
    prs.push(...Object.values(cand));
  }
  IX = { ws, hist, best, prs };
  return IX;
}
const lastSession = name => { const h = ix().hist[name]; return h && h.length ? h[h.length - 1] : null; };
const splitById = id => S.splits.find(s => s.id === id);
const wSplit = w => (w.splitId && splitById(w.splitId)) || S.splits.find(s => s.name === w.splitName);
function lastOfSplit(sp) { const ws = ix().ws; for (let i = ws.length - 1; i >= 0; i--) { const w = ws[i]; if (!w.skipped && (w.splitId === sp.id || (!w.splitId && w.splitName === sp.name))) return w; } return null; }
const wVol = w => w.ex.reduce((a, e) => a + exVol(e.sets), 0);
const wSets = w => w.ex.reduce((a, e) => a + e.sets.filter(s => s.t !== 'warm').length, 0);
function nextSplit() {
  const order = S.rotation.map(splitById).filter(s => s && !s.archived);
  if (!order.length) return S.splits.find(s => !s.archived) || null;
  const ws = ix().ws, reset = S.profile.rotReset;
  for (let i = ws.length - 1; i >= 0; i--) {
    const w = ws[i]; if (w.skipped) continue;
    if (reset && w.id === reset) return order[0]; // rotation was re-ordered after this workout (Job, 19 Oct): start from the top
    const k = order.findIndex(s => s.id === w.splitId || (!w.splitId && s.name === w.splitName));
    if (k >= 0) return order[(k + 1) % order.length];
  }
  return order[0];
}

// ---------- weights ----------
const weightList = () => Object.entries(S.weights).map(([d, e]) => ({ d, w: e.w, src: e.src })).sort((a, b) => a.d < b.d ? -1 : 1);
const bwRaw = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
function firstWeight() { const l = weightList(); return l.length ? l[0] : null; }
function latestWeight() { const l = weightList(); return l.length ? l[l.length - 1] : null; }
function weightOn(date) { let r = null; for (const e of weightList()) { if (e.d <= date) r = e; else break; } return r; }
function avg7(date = today()) {
  const l = weightList().filter(e => e.d <= date && daysBetween(e.d, date) < 7);
  return l.length ? l.reduce((a, e) => a + e.w, 0) / l.length : null;
}
function trendSeries(list) {
  const out = []; let t = null, pd = null;
  for (const e of list) {
    if (t == null) t = e.w; else { const k = 1 - Math.exp(-Math.max(1, daysBetween(pd, e.d)) / 10); t = t + k * (e.w - t); }
    pd = e.d; out.push({ x: ts(e.d), y: t });
  }
  return out;
}

// ---------- units ----------
const LB = 2.20462;
const U = () => S.profile.unit;
const trim = v => String(+(+v).toFixed(2));
function dw(kg) { if (kg == null) return '?'; return U() === 'lb' ? trim(Math.round(kg * LB * 10) / 10) : trim(Math.round(kg * 100) / 100); }
const toKg = v => U() === 'lb' ? v / LB : v;
const dvol = kg => n0(U() === 'lb' ? kg * LB : kg);
const setStr = s => s ? dw(s.w) + '×' + (s.r == null ? '?' : s.r) : '—';
function delta(a, b, fmt = v => trim(v), unit = '') {
  if (a == null || b == null) return '';
  const d = a - b;
  if (Math.abs(d) < 1e-6) return `<span class="neu">same</span>`;
  return `<span class="${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${unit}</span>`;
}
const fmtW = v => dw(v);
// body weight: always one decimal, real minus sign
function bw(kg, signed) { if (kg == null) return '—'; const v = U() === 'lb' ? kg * LB : kg; const t = Math.abs(v).toFixed(1); return (v < -0.05 ? '−' : signed && v > 0.05 ? '+' : '') + t; }
const e1f = kg => kg ? trim(Math.round((U() === 'lb' ? kg * LB : kg) * 10) / 10) : '—';
function wdelta(a, b) { if (a == null || b == null) return ''; const d = a - b; if (Math.abs(d) < 0.05) return '<span class="neu">= 0.0</span>'; return `<span class="sec">${d > 0 ? '▲' : '▼'} ${bw(Math.abs(d))}</span>`; }

// ---------- icons ----------
const I = {
  swap: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  wrench: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  splits: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  right: '<svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  grip: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8h14M5 12h14M5 16h14"/></svg>',
  up1: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>',
  dn1: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

// ---------- charts ----------
let chartSeq = 0;
const CH = {};
const chartW = () => Math.max(260, Math.min(528, ($('#screen') || document.body).clientWidth - 2 * 16 - 34));
function niceTicks(lo, hi, n = 3) {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
function lineChart({ series, h = 170, yfmt = v => trim(v), xfmt = t => fmtDate(ymd(new Date(t))), area = true, w }) {
  const W = w || chartW(), id = 'c' + (++chartSeq);
  const all = series.flatMap(s => s.pts);
  if (all.length === 0) return '<div class="empty">No data yet.</div>';
  let x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x));
  let y0 = Math.min(...all.map(p => p.y)), y1 = Math.max(...all.map(p => p.y));
  if (x1 === x0) { x0 -= DAY; x1 += DAY; }
  const yp = (y1 - y0) * 0.12 || Math.max(1, y1 * 0.05); y0 -= yp; y1 += yp;
  const pl = 4, pr = 34, pt = 10, pb = 22;
  const X = t => pl + (t - x0) / (x1 - x0) * (W - pl - pr), Y = v => pt + (1 - (v - y0) / (y1 - y0)) * (h - pt - pb);
  let g = '';
  for (const v of niceTicks(y0, y1)) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 4"/><text x="${W - pr + 6}" y="${Y(v) + 3}">${esc(yfmt(v))}</text>`;
  const xt = [x0, (x0 + x1) / 2, x1];
  xt.forEach((t, i) => { g += `<text x="${X(t)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${esc(xfmt(t))}</text>`; });
  let body = '', defs = '';
  const mapped = series.map((s, si) => {
    const pts = s.pts.slice().sort((a, b) => a.x - b.x).map(p => ({ ...p, px: X(p.x), py: Y(p.y) }));
    if (!pts.length) return { ...s, pts };
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p.px.toFixed(1) + ' ' + p.py.toFixed(1)).join(' ');
    if (area && si === 0 && !s.noArea) {
      defs += `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
      body += `<path d="${d} L${pts[pts.length - 1].px} ${h - pb} L${pts[0].px} ${h - pb} Z" fill="url(#${id}g)" stroke="none"/>`;
    }
    if (!s.dotsOnly) body += `<path ${s.dash ? '' : 'class="draw" pathLength="1"'} d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="4 4"' : ''} opacity="${s.opacity || 1}"/>`;
    if (s.dots) for (const p of pts) body += p.hollow ? `<circle cx="${p.px}" cy="${p.py}" r="3" fill="var(--surface)" stroke="${s.color}" stroke-width="1.5"/>` : `<circle cx="${p.px}" cy="${p.py}" r="2.6" fill="${s.color}" stroke="none"/>`;
    const L = pts[pts.length - 1];
    if (!s.noEnd) body += `<circle cx="${L.px}" cy="${L.py}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    return { ...s, pts };
  });
  CH[id] = { W, h, pt, pb, series: mapped, yfmt, xfmt };
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${h}" height="${h}" role="img" aria-label="Chart"><defs>${defs}</defs>${g}${body}<line class="scrub" x1="0" x2="0" y1="${pt}" y2="${h - pb}" stroke="var(--text2)" stroke-width="1" opacity="0"/></svg><div class="tip" hidden></div></div>`;
}
function barChart({ bars, h = 150, yfmt = v => n0(v), line, color = 'var(--text2)', hiColor = 'var(--text)', w }) {
  const W = w || chartW(), id = 'c' + (++chartSeq);
  if (!bars.length) return '<div class="empty">No data yet.</div>';
  const max = Math.max(1, ...bars.map(b => b.v), ...(line || []).filter(v => v != null)) * 1.1;
  const pl = 2, pr = 34, pt = 10, pb = 22, bw = (W - pl - pr) / bars.length;
  const Y = v => pt + (1 - v / max) * (h - pt - pb);
  let g = '';
  for (const v of niceTicks(0, max)) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--border)" stroke-dasharray="2 4"/><text x="${W - pr + 6}" y="${Y(v) + 3}">${esc(yfmt(v))}</text>`;
  let body = '';
  const pts = bars.map((b, i) => {
    const x = pl + i * bw + bw * 0.18, wd = Math.max(2, bw * 0.64), y = Y(b.v);
    body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${wd.toFixed(1)}" height="${Math.max(0, h - pb - y).toFixed(1)}" rx="${Math.min(4, wd / 2)}" fill="${b.hi ? hiColor : color}" opacity="${b.hi ? 1 : .55}"/>`;
    return { px: x + wd / 2, py: y, x: i, y: b.v, label: b.label, tip: b.tip };
  });
  const step = Math.ceil(bars.length / 4);
  bars.forEach((b, i) => { if (b.label && (i % step === 0 || i === bars.length - 1) && (i === bars.length - 1 || bars.length - 1 - i >= step / 2 || i % step === 0)) g += `<text x="${pts[i].px}" y="${h - 6}" text-anchor="middle">${esc(b.label)}</text>`; });
  if (line) {
    const lp = line.map((v, i) => v == null ? null : [pts[i].px, Y(v)]).filter(Boolean);
    if (lp.length > 1) body += `<path d="${lp.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  }
  CH[id] = { W, h, pt, pb, bars: pts, yfmt };
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${h}" height="${h}" role="img" aria-label="Bar chart">${g}${body}<line class="scrub" x1="0" x2="0" y1="${pt}" y2="${h - pb}" stroke="var(--text2)" stroke-width="1" opacity="0"/></svg><div class="tip" hidden></div></div>`;
}
function sparkline(vals, color) {
  if (vals.length < 2) return '<svg class="spark"></svg>';
  const mx = Math.max(...vals), mn = Math.min(...vals), W = 72, H = 28;
  const p = vals.map((v, i) => [(i / (vals.length - 1)) * (W - 4) + 2, H - 3 - ((v - mn) / ((mx - mn) || 1)) * (H - 6)]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}"><path d="${p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${p[p.length - 1][0]}" cy="${p[p.length - 1][1]}" r="2.4" fill="${color}"/></svg>`;
}
let lastScrubIdx = null;
function scrub(el, clientX) {
  const c = CH[el.dataset.chart]; if (!c) return;
  const r = el.getBoundingClientRect(); const x = (clientX - r.left) / r.width * c.W;
  let best = null, html = '';
  if (c.bars) {
    for (const p of c.bars) if (!best || Math.abs(p.px - x) < Math.abs(best.px - x)) best = p;
    html = esc(best.tip || ((best.label ? best.label + ' · ' : '') + c.yfmt(best.y)));
  } else {
    for (const s of c.series) for (const p of s.pts) if (!best || Math.abs(p.px - x) < Math.abs(best.px - x)) best = p;
    if (!best) return;
    html = esc(c.xfmt(best.x)) + c.series.filter(s => !s.noTip).map(s => {
      let q = null; for (const p of s.pts) if (!q || Math.abs(p.px - best.px) < Math.abs(q.px - best.px)) q = p;
      return q && Math.abs(q.px - best.px) < 6 ? ` · <span style="color:${s.color}">${esc(c.yfmt(q.y))}${q.hollow ? ' est.' : ''}</span>` : '';
    }).join('');
  }
  const ln = el.querySelector('.scrub'); ln.setAttribute('x1', best.px); ln.setAttribute('x2', best.px); ln.setAttribute('opacity', '.6');
  const tip = el.querySelector('.tip'); tip.hidden = false; tip.innerHTML = html;
  const pct = best.px / c.W * 100; tip.style.left = Math.min(82, Math.max(18, pct)) + '%';
  const key = el.dataset.chart + ':' + best.px; if (key !== lastScrubIdx) { lastScrubIdx = key; buzz(4); }
}
function endScrub(el) { const ln = el.querySelector('.scrub'); if (ln) ln.setAttribute('opacity', '0'); const t = el.querySelector('.tip'); if (t) t.hidden = true; }

// ---------- toast & sheets ----------
let toastT = null;
let SCR_KEY = '';
function screenChanged() { const top = NAV.stack[NAV.stack.length - 1], k = (top ? top.v : NAV.tab) + '|' + (A && A.open ? (A.view || 'log') : ''); if (k !== SCR_KEY) { SCR_KEY = k; document.querySelectorAll('.toast').forEach(t => t.remove()); } }
// undo: optional function; adds an Undo button and keeps the toast up longer (deleting is forgiving, like Mail and Photos)
function toast(html, ms = 2600, undo) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (undo ? ' has-undo' : ''); t.setAttribute('role', 'status'); t.innerHTML = html;
  if (undo) { ms = Math.max(ms, 6000); const b = document.createElement('button'); b.className = 'toast-undo'; b.textContent = 'Undo'; b.onclick = () => { t.remove(); undo(); }; t.appendChild(b); }
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), ms);
}
const SHEETS = [];
// Screen readers: every on/off switch is named after the text in its row (22 Oct a11y pass), wherever it is drawn
function nameSwitches(root) { root.querySelectorAll && root.querySelectorAll('[role="switch"]:not([aria-label])').forEach(b => { const r = b.closest('.xr, .row, label, li'); const g = r && r.querySelector('.grow'); const t = g ? (g.firstChild && g.firstChild.nodeType === 3 ? g.firstChild.textContent : g.textContent) : ''; if (t.trim()) b.setAttribute('aria-label', t.trim()); }); }
try { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) nameSwitches(n.parentNode || n); }))).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
// One-tap Update (Job, 23 Oct): when a newer version has installed in the background, a small bar offers to load it.
// The open workout is saved locally, so reloading never loses sets. Checks again whenever the app comes back to the front.
let SW_REG = null;
function swRegister() {
  if (SW_REG) return; const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(r => { SW_REG = r; document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update().catch(() => {}); }); setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000); }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) showUpdateBar(); });
}
function showUpdateBar() {
  if (document.getElementById('upd')) return;
  const el = document.createElement('div'); el.id = 'upd'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>A new version of Job’s Done is ready.</span><button class="upd-go">Update</button><button class="upd-x" aria-label="Later">${I.x}</button>`;
  document.body.appendChild(el);
  el.querySelector('.upd-go').onclick = () => { try { lsSave(); } catch (e) {} location.reload(); };
  el.querySelector('.upd-x').onclick = () => el.remove();
}
function openSheet(html, opts = {}) {
  const root = $('#sheets');
  const wrap = document.createElement('div'); wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="scrim" data-a="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(opts.label || 'Sheet')}"><div class="grab"></div><div class="sheet-body">${html}</div></div>`;
  root.appendChild(wrap);
  const sh = { el: wrap, opts }; SHEETS.push(sh);
  dragToDismiss(sh);
  if (opts.mount) opts.mount(wrap.querySelector('.sheet-body'), sh);
  return sh;
}
// Pull a sheet down to close it, like iOS sheets.
function dragToDismiss(sh) {
  const el = sh.el.querySelector('.sheet'); let y0 = null, x0 = 0, dy = 0, on = false;
  el.addEventListener('touchstart', e => { if (el.scrollTop > 0 || e.target.closest('.ruler, textarea, input, .plate-tray, .bar-wrap')) { y0 = null; return; } y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; on = false; }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (y0 == null) return; const t = e.touches[0]; dy = t.clientY - y0;
    if (!on && (dy < 8 || Math.abs(t.clientX - x0) > dy)) { if (dy < -4) y0 = null; return; }
    on = true; el.style.transition = 'none'; el.style.transform = `translateY(${Math.max(0, dy)}px)`; if (e.cancelable) e.preventDefault();
  }, { passive: false });
  el.addEventListener('touchend', () => {
    if (!on) { y0 = null; return; }
    el.style.transition = 'transform .25s cubic-bezier(.2,.9,.25,1)';
    if (dy > 110) { el.style.transform = 'translateY(100%)'; setTimeout(() => closeSheet(sh), 200); } else el.style.transform = '';
    y0 = null; on = false;
  });
}
function closeSheet(sh) {
  sh = sh || SHEETS[SHEETS.length - 1]; if (!sh) return;
  SHEETS.splice(SHEETS.indexOf(sh), 1); sh.el.remove();
  if (sh.opts.onClose) sh.opts.onClose();
}
function setSheet(sh, html) { const b = sh.el.querySelector('.sheet-body'); b.innerHTML = html; if (sh.opts.mount) sh.opts.mount(b, sh); }
// Swipe a split card left to reveal Delete (Job, 15 Oct)
function wireSwipe() {
  document.querySelectorAll('.swipe:not([data-w])').forEach(w => {
    w.dataset.w = 1; const c = w.querySelector('.card'); let x0 = null, y0 = 0, dx = 0, open = false, moved = false;
    c.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = open ? -96 : 0; moved = false; c.style.transition = 'none'; }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (x0 == null) return; const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!moved && Math.abs(my) > Math.abs(mx) && Math.abs(my) > 6) { x0 = null; c.style.transition = ''; return; }
      if (Math.abs(mx) > 6) { moved = true; w.classList.add('sw'); }
      if (moved) { dx = Math.min(0, Math.max(-140, (open ? -96 : 0) + mx)); c.style.transform = `translateX(${dx}px)`; }
    }, { passive: true });
    c.addEventListener('touchend', () => { x0 = null; c.style.transition = ''; if (!moved) return; open = dx < -48; c.style.transform = open ? 'translateX(-96px)' : ''; w.classList.toggle('sw', open); });
    c.addEventListener('click', e => { if (moved || open) { e.stopPropagation(); e.preventDefault(); if (!moved) { open = false; c.style.transform = ''; w.classList.remove('sw'); } moved = false; } }, true);
  });
}
// Share a split by link (Job, 15 Oct): the split rides in the link itself, nothing is uploaded.
const toB64u = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = t => new TextDecoder().decode(b64u(t));
function shareSplit(sp) {
  if (!sp) return;
  const tok = toB64u(JSON.stringify({ n: sp.name, c: sp.color, x: sp.ex.map(e => [e.name, e.sets, e.repMin, e.repMax, e.rest]) }));
  const url = location.origin + location.pathname + '#split=' + tok;
  if (navigator.share) return navigator.share({ title: sp.name + ' on Job’s Done', text: sp.name + ': ' + sp.ex.map(e => baseName(e.name)).join(', '), url }).catch(() => {});
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied. Anyone with Job’s Done can add ' + esc(sp.name) + ' from it.'), () => openSheet(`<div class="stack"><h2>Share ${esc(sp.name)}</h2><p class="cap">Copy this link and send it.</p><textarea class="input" rows="4" readonly>${esc(url)}</textarea><button class="btn block" data-a="closeSheet">Done</button></div>`, { label: 'Share split' }));
}
const SHARED_SPLIT = (() => { try { const m = location.hash.match(/^#split=([\w-]{4,6000})$/); if (m) { sessionStorage.setItem('jd-split', m[1]); history.replaceState(null, '', location.pathname + location.search); } return sessionStorage.getItem('jd-split'); } catch (e) { return null; } })();
function maybeImportSplit() {
  const tok = (() => { try { return sessionStorage.getItem('jd-split'); } catch (e) { return SHARED_SPLIT; } })();
  if (!tok || !S) return false;
  try { sessionStorage.removeItem('jd-split'); } catch (e) {}
  let d; try { d = JSON.parse(fromB64u(tok)); } catch (e) { toast('That split link is broken.'); return false; }
  if (!d || typeof d.n !== 'string' || !Array.isArray(d.x) || !d.x.length) return false;
  const name = d.n.slice(0, 40), clamp = (v, lo, hi, df) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : df;
  const ex = d.x.slice(0, 30).filter(r => Array.isArray(r) && typeof r[0] === 'string').map(r => ({ name: r[0].slice(0, 60), sets: clamp(r[1], 1, 10, 3), repMin: clamp(r[2], 1, 50, 6), repMax: clamp(r[3], 1, 50, 10), rest: clamp(r[4], 15, 900, 120), note: '' }));
  if (!ex.length) return false;
  const color = /^#[0-9a-fA-F]{6}$/.test(d.c) ? d.c : PALETTE[S.splits.length % PALETTE.length];
  setTimeout(() => confirmSheet({ title: 'Add ' + name + ' to your splits?', body: 'Someone shared this split with you: ' + esc(ex.map(e => baseName(e.name)).join(', ')) + '.', ok: 'Add split', onOk: () => { const id = 'sp-' + uid(); S.splits.push({ id, name, color, archived: false, ex }); S.rotation.push(id); persist('jd/meta'); NAV.tab = 'splits'; NAV.stack = []; render(); toast(esc(name) + ' added to your splits'); } }), 400);
  return true;
}
function openNewSplit() {
  const seen = new Set(), one = [];
  for (const t of Object.values(TEMPLATES)) for (const [n, ex] of t.s) if (!seen.has(n)) { seen.add(n); one.push([n, ex]); }
  const sh = openSheet(`<div class="stack"><h2>New split</h2>
    <button class="btn block primary" data-a="newBlankSplit">Start from blank</button>
    <section><div class="sgh">Add a ready-made plan</div><div class="tmpl">${Object.entries(TEMPLATES).filter(([, t]) => t.s.length).map(([k, t]) => `<button data-np="${k}"><b>${esc(t.n)}</b><span>${esc(t.d)}</span></button>`).join('')}</div></section>
    <section><div class="sgh">Or one preset split</div><div class="tmpl">${one.map(([n, ex], i) => `<button data-ns="${i}"><b>${esc(n)}</b><span>${esc(ex.join(', '))}</span></button>`).join('')}</div></section></div>`, { label: 'New split' });
  const add = list => { const ids = []; for (const [name, ex] of list) { const id = 'sp-' + uid(); const r = S.profile.exp && OB_EXP[S.profile.exp] ? OB_EXP[S.profile.exp] : [0, 0, 6, 10]; S.splits.push({ id, name, color: SPLIT_COLORS[name] || PALETTE[S.splits.length % PALETTE.length], archived: false, ex: ex.map(n => ({ name: n, sets: 3, repMin: r[2], repMax: r[3], rest: S.profile.defaultRest || 120, note: '' })) }); S.rotation.push(id); ids.push(id); } persist('jd/meta'); closeSheet(sh); NAV.tab = 'splits'; NAV.stack = []; render(); toast(list.length > 1 ? list.length + ' splits added to your rotation' : list[0][0] + ' added to your rotation'); };
  sh.el.querySelectorAll('[data-np]').forEach(b => b.onclick = () => add(TEMPLATES[b.dataset.np].s));
  sh.el.querySelectorAll('[data-ns]').forEach(b => b.onclick = () => add([one[+b.dataset.ns]]));
}
function confirmSheet({ title, body = '', ok = 'Confirm', danger = false, onOk }) {
  const sh = openSheet(`<div class="stack"><h2>${esc(title)}</h2>${body ? `<p class="m0 sec">${body}</p>` : ''}
    <button class="btn block ${danger ? 'danger-fill' : 'primary'}" id="cf-ok">${esc(ok)}</button><button class="btn block ghost" data-a="closeSheet">Cancel</button></div>`, { label: title });
  sh.el.querySelector('#cf-ok').onclick = () => { closeSheet(sh); onOk(); };
}

// ---------- render shell ----------
function render() {
  if (!ready) return;
  syncRestPush();
  // Oct 2026: Job made Cliffs the default look; switch everyone over once, then their own pick sticks.
  // Oct 2026: Job removed the Miles theme; anyone on it moves to Cliffs.
  if (S && S.profile && S.profile.theme === 'miles') { S.profile.theme = 'cliffs'; persist('jd/meta'); }
  if (S && S.profile && !S.profile.cliffs1) { S.profile.theme = S.profile.theme || 'mono'; S.profile.cliffs1 = true; persist('jd/meta'); }
  if ((document.documentElement.dataset.theme || 'climb') !== theme()) applyTheme();
  // Oct 2026: rest timer default went from 2 to 5 minutes (Job's ask); move the old default over once.
  // Accounts from before the friends launch (Oct 15 2026) keep their owner's setup: QWatch steps, plates-only loading.
  if (S && S.profile && S.profile.legacy == null) { const old = (S.created || Date.now()) < Date.UTC(2026, 9, 15, 6); S.profile.legacy = old ? 1 : 0; if (old) { if (S.profile.barW == null) S.profile.barW = 0; if (!S.profile.stepSrc) S.profile.stepSrc = 'QWatch Pro'; S.profile.owner = true; } persist('jd/meta'); }
  // Job's own Home Screen icon (Skyline blazer, 16 Oct): only on the owner account; iOS reads it when Add to Home Screen is tapped.
  if (S && S.profile && S.profile.owner) { const ic = document.querySelector('link[rel="apple-touch-icon"]'); if (ic && !/job-skyline/.test(ic.href)) ic.href = 'icons/job-skyline-180.png?v=2'; try { localStorage.setItem('jd-owner-icon', '1'); } catch (e) {} }
  // Job (15 Oct): sounds AND music together, like Jedris. 'Play when on silent' paused music, so it is retired for everyone.
  if (S && S.profile && (!S.profile.musicOk || !S.profile.music2)) { S.profile.soundSilent = false; S.profile.musicOk = true; S.profile.music2 = true; persist('jd/meta'); }
  if (S && S.profile && !S.profile.rest5) { if (!S.profile.defaultRest || S.profile.defaultRest === 120) S.profile.defaultRest = 300; S.profile.rest5 = true; persist('jd/meta'); }
  const app = $('#app');
  if (!S || !S.imported && !S.splits.length) { renderWelcome(); return; }
  if (!$('#screen') || !$('#tabs')) {
    app.innerHTML = `<main id="screen" tabindex="-1"></main><nav id="tabs" aria-label="Tabs"></nav>`;
  }
  const top = NAV.stack[NAV.stack.length - 1];
  const scr = $('#screen'); const keep = scr.scrollTop;
  let html;
  if (top) html = ({ split: viewSplit, splitEdit: viewSplitEdit, exercise: viewExercise, workout: viewWorkout, weights: viewWeights })[top.v](top);
  else html = ({ today: viewToday, splits: viewSplits, progress: viewProgress, me: viewMe })[NAV.tab]();
  scr.innerHTML = resolveVars(html);
  if (!NAV.keepScroll) enter(scr);
  if (NAV.keepScroll) scr.scrollTop = keep; else scr.scrollTop = 0;
  NAV.keepScroll = false;
  const tab = (k, label, ic) => `<button class="tab ${NAV.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}" aria-label="${label}" ${NAV.tab === k ? 'aria-current="page"' : ''}>${ic}<span>${label}</span></button>`;
  $('#tabs').innerHTML = tab('today', 'Today', I.today) + tab('splits', 'Splits', I.splits) +
    `<button class="tab-start ${A ? 'live' : ''}" data-a="start" aria-label="${A ? 'Resume workout' : 'Start workout'}">${A ? I.play : I.plus}<span>${A ? 'Resume' : 'Start'}</span></button>` +
    tab('progress', 'Progress', I.progress) + tab('me', 'Me', I.me);
  renderWorkout();
  screenChanged(); wireSwipe(); coach();
}
// First-run hint (Job, 23 Oct): a brand-new account sees one bubble pointing at Start until they start or close it.
function coach() {
  const old = document.getElementById('coach'); if (old) old.remove();
  const p = S && S.profile; if (!p || p.hint1 || !p.onboarded || A || DEMO || NAV.tab !== 'today' || NAV.stack.length || ix().ws.length || SHEETS.length) return;
  const st = document.querySelector('.tab-start'); if (!st) return;
  const el = document.createElement('div'); el.id = 'coach'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="grow"><b>Start here</b><span>Tap Start to open your first workout. Log each set as you go.</span></div><button class="coach-x" aria-label="Got it">${I.x || '×'}</button>`;
  document.body.appendChild(el);
  const r = st.getBoundingClientRect(); el.style.setProperty('--ax', Math.round(r.left + r.width / 2) + 'px'); el.style.bottom = Math.round(innerHeight - r.top + 10) + 'px';
  el.querySelector('.coach-x').onclick = () => { p.hint1 = true; persist('jd/meta'); el.remove(); };
}
// Screen entrance: panels rise in, charts draw, headline numbers count up.
// Looks Job can pick under Me. The choice is saved with the profile (so it follows the account)
// and in localStorage (so the right colours show before the data loads).
const THEMES = [
  { k: 'mono', name: 'Agent', desc: 'Dark and sharp with a red glow, and spy-style messages.', bar: '#121216', sw: 'linear-gradient(180deg, #121216 0.0% 33.3%, #F2F2F4 33.3% 66.7%, #C8102E 66.7% 100.0%)' },
  { k: 'cliffs', name: 'Summit', desc: 'A mountain sky that changes with the time of day.', bar: '#6FB3E6', sw: 'linear-gradient(180deg, #6FB3E6 0.0% 33.3%, #8A5A40 33.3% 66.7%, #1F7A99 66.7% 100.0%)' },
  { k: 'climb', name: 'Boulder', desc: 'A light look on a chalky climbing wall.', bar: '#EFEBE5', sw: 'linear-gradient(180deg, #EFEBE5 0.0% 33.3%, #6C3FD6 33.3% 66.7%, #F4B728 66.7% 100.0%)' },
  { k: 'spidey', name: 'Skyline', desc: 'A city at night, with webs and comic-book wins.', bar: '#0D1A45', sw: 'linear-gradient(180deg, #0D1A45 0.0% 33.3%, #E2231A 33.3% 66.7%, #FFFFFF 66.7% 100.0%)' },
];
const theme = () => (S && S.profile && S.profile.theme) || (() => { try { return localStorage.getItem('jobdone-theme'); } catch (e) { return null; } })() || 'mono';
// Cliffs sky follows the local clock: night, sunrise, day, sunset. Colours blend between these stops.
const SKY = [
  [0, '#070B1E', '#121A3A', '#1E2A50', [10, 16, 48, .62], 1],
  [5, '#1B1F4A', '#5B4F7E', '#E59A7A', [60, 40, 110, .35], .4],
  [6.5, '#7FB2DE', '#F6C9A8', '#F7A982', [255, 150, 90, .14], 0],
  [9, '#6FB3E6', '#A9D4EE', '#DCEEF6', [255, 255, 255, 0], 0],
  [16.5, '#6FB3E6', '#A9D4EE', '#E7F0EE', [255, 255, 255, 0], 0],
  [18, '#3E5C9A', '#F08E5C', '#FBC47A', [230, 110, 60, .22], 0],
  [19.5, '#1A2152', '#6A3E78', '#C0607A', [50, 25, 85, .42], .3],
  [21, '#070B1E', '#121A3A', '#1E2A50', [10, 16, 48, .62], 1],
  [24, '#070B1E', '#121A3A', '#1E2A50', [10, 16, 48, .62], 1],
];
function skyNow(h) {
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], f = (h - a[0]) / (b[0] - a[0]);
  const hx = x => [1, 3, 5].map(j => parseInt(x.substr(j, 2), 16));
  const mix = (p, q) => p.map((v, j) => v + (q[j] - v) * f);
  const col = (p, q) => '#' + mix(hx(p), hx(q)).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const t = mix(a[4], b[4]);
  return { s1: col(a[1], b[1]), s2: col(a[2], b[2]), s3: col(a[3], b[3]), tint: `rgba(${t.slice(0, 3).map(Math.round).join(',')},${t[3].toFixed(2)})`, stars: a[5] + (b[5] - a[5]) * f };
}
// The sky at the hour a workout finished (Job, 16 Oct: Summit finish page and card follow when you trained, not now).
const todOf = h => h >= 19.5 || h < 5.5 ? 'night' : h < 8 || h >= 17 ? 'dusk' : 'day';
function skyOfW(w) { const t = new Date(w && (w.end || w.start) || Date.now()), h = t.getHours() + t.getMinutes() / 60; return Object.assign(skyNow(h), { tod: todOf(h) }); }
function applySky() {
  const R = document.documentElement;
  if (R.dataset.theme !== 'cliffs') { delete R.dataset.tod; return; }
  const n = new Date(), h = n.getHours() + n.getMinutes() / 60, k = skyNow(h), st = R.style;
  st.setProperty('--sky1', k.s1); st.setProperty('--sky2', k.s2); st.setProperty('--sky3', k.s3); st.setProperty('--tint', k.tint); st.setProperty('--stars', k.stars.toFixed(2));
  const day = h >= 6 && h < 19, p = day ? (h - 6) / 13 : ((h + 24 - 19) % 24) / 11;
  st.setProperty('--sunx', (10 + p * 80).toFixed(1) + '%'); st.setProperty('--suny', (58 - Math.sin(Math.PI * p) * 46).toFixed(1) + '%');
  const sun = document.querySelector('#bg .sky-sun'); if (sun) sun.classList.toggle('moon', !day);
  // Cards follow the sky (Job, 16 Oct): dusky glass at sunrise and sunset, sky-tinted light by day, dark at night.
  R.dataset.tod = todOf(h);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = k.s1;
  clearTimeout(applySky.t); applySky.t = setTimeout(applySky, 5 * 60e3);
}
function applyTheme(k = theme()) {
  const t = THEMES.find(x => x.k === k) || THEMES[0];
  if (t.k === 'climb') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t.k;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t.bar;
  applySky();
  try { localStorage.setItem('jobdone-theme', t.k); } catch (e) {}
  for (const v in VARC) delete VARC[v];
}
// Dark or white text, whichever reads better on a split's colour.
function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff';
  const n = parseInt(m[1], 16), lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const L = .2126 * lin(n >> 16 & 255) + .7152 * lin(n >> 8 & 255) + .0722 * lin(n & 255);
  return L > .36 ? '#221E2B' : '#fff';
}
// A burst of hold-coloured confetti for PRs and finished workouts.
function confetti(n = 60) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || S.profile.noConfetti) return;
  n = Math.min(40, Math.round(n * .4)); // brief and subtle since the Oct 2026 redesign
  const cols = ({ mono: ['#F4F5FA', '#C8102E', '#1C1D26'], spidey: ['#E2231A', '#FFFFFF', '#5B8CFF'], miles: ['#E3262E', '#FFE94D', '#FFFFFF', '#7FD8FF'], cliffs: ['#1F7A99', '#F2A93B', '#D2553A', '#3F8F5A', '#FFFFFF'] })[document.documentElement.dataset.theme] || ['#6C3FD6', '#F4B728', '#2E8B4E', '#E0412F', '#4A78E0'], box = document.createElement('div'); box.className = 'confetti';
  for (let i = 0; i < n; i++) { const e = document.createElement('i'); e.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--x:${(Math.random() - .5) * 160}px;--r:${(Math.random() - .5) * 900}deg;--d:${1.1 + Math.random() * .9}s;animation-delay:${Math.random() * .25}s;transform:scale(${.7 + Math.random() * .8})`; box.appendChild(e); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
}
function enter(scr) {
  scr.classList.remove('enter'); void scr.offsetWidth; scr.classList.add('enter');
  clearTimeout(enter.t); enter.t = setTimeout(() => scr.classList.remove('enter'), 700);
}
const VARC = {};
function resolveVars(html) {
  return html.replace(/(fill|stroke|stop-color)="var\((--[a-z0-9-]+)\)"/g, (m, a, v) => {
    if (!(v in VARC)) VARC[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    return VARC[v] ? `${a}="${VARC[v]}"` : m;
  });
}
const rerender = () => { NAV.keepScroll = true; render(); };
function go(v) { NAV.stack.push(v); render(); }
function back() { NAV.stack.pop(); render(); }
const backBtn = (label = 'Back') => `<button class="back" data-a="back">${I.left}${esc(label)}</button>`;

// ---------- Today ----------
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
// The Today screen can show any past day (Job: tap a day and see it like a normal day). null = today.
let VIEWDAY = null;
function setViewDay(d) {
  const t = today();
  if (d && d > t) { toast('That day hasn’t happened yet'); return; }
  VIEWDAY = d && d !== t ? d : null; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
const longDay = d => fmtDate(d, { wd: true }).replace(/^(\w+) /, (m, x) => ({ Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }[x] + ', '));
const datePick = d => `<label class="cap datepick">${esc(d === today() ? 'Today, ' + fmtDate(d) : fmtDate(d, { wd: true }))} ▾<input type="date" data-in="viewDay" value="${d}" max="${today()}" aria-label="Pick a day"></label>`;
// What was trained on a past day, or buttons to log it.
// Exercise lists on Today fold away so the cards stay short (Job, 15 Oct).
const foldList = (n, inner) => `<details class="fold"><summary class="fold-s"><span>${n === 1 ? 'Show 1 exercise' : `Show ${n} exercises`}</span><svg viewBox="0 0 12 12" width="12" height="12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></summary><div class="list nextlist">${inner}</div></details>`;
function dayWorkoutCard(d, label) {
  const ws = Object.values(S.workouts).filter(w => w.date === d && !w.skipped), sk = Object.values(S.workouts).some(w => w.date === d && w.skipped);
  const log = A ? `<div class="mt3 cap">Finish the workout in progress to log another one.</div>` : `<div class="mt4 cap">${ws.length ? 'Log another workout' : 'Log a workout for this day'}</div><div class="mt2 chips wrap">${S.splits.filter(x => !x.archived).map(sp => `<button class="chip" data-a="logDay" data-id="${sp.id}" data-k="${d}"><i class="sdot" style="background:${sp.color}"></i>${esc(sp.name)}</button>`).join('')}<button class="chip" data-a="logDay" data-id="" data-k="${d}">Empty</button></div>`;
  if (!ws.length) return `<div class="card"><div class="card-h"><span class="eyebrow">Workout</span></div><div class="mt2 mid">${sk ? 'Skipped' : 'Rest day'}</div><div class="cap">Nothing logged ${esc(relDay(d))}.</div>${log}</div>`;
  return ws.map(w => { const sp = wSplit(w), c = sp ? sp.color : 'var(--accent)', sets = w.ex.reduce((a, e) => a + e.sets.filter(x => x.done !== false && x.t !== 'warm').length, 0);
    return `<div class="card nextup" style="--split:${c};--ink:${sp ? inkOn(sp.color) : '#fff'}">
    <div class="card-h"><span class="eyebrow">${esc(label || 'Workout')}</span><span class="cap">${w.end && w.start && w.end - w.start >= 6e4 ? fmtDur(w.end - w.start) : ''}</span></div>
    <div class="hero"><i class="sdot" style="background:${c}"></i>${esc(w.splitName)}</div>
    <div class="mt3 cap">${plural(w.ex.length, 'exercise')} · ${plural(sets, 'set')} · ${n0(wVol(w))} ${U()} lifted</div>
    <div class="mt4 g2 row"><button class="btn primary grow" data-a="openW" data-id="${w.id}">Open and edit</button><button class="btn" data-a="recap" data-id="${w.id}">Recap</button></div>
    ${(() => { const m = mergeLR(w.ex, e => e.sets.filter(x => x.w != null || x.r != null).map(setStr).join(', ') || '—'); return foldList(m.length, m.map(r => `<div class="row between"><span class="sec">${esc(r.name)}</span><span class="num muted">${esc(r.txt)}</span></div>`).join('')); })()}</div>`; }).join('');
}
function viewToday() {
  if (VIEWDAY && VIEWDAY >= today()) VIEWDAY = null;
  const T = today(), t = VIEWDAY || T, past = !!VIEWDAY, lw = past ? weightOn(t) : latestWeight(), a7 = avg7(t);
  const p = S.profile, fw = firstWeight(), since = lw && fw ? lw.w - fw.w : null;
  const loggedToday = S.weights[t];
  const recent = weightList().filter(e => e.d <= t && daysBetween(e.d, t) <= 120);
  const wchart = recent.length > 1 ? lineChart({ series: [{ pts: recent.map(e => ({ x: ts(e.d), y: e.w, hollow: e.src === 'estimated' })), color: 'var(--accent)', dots: true, width: 2.4 }], h: 96, yfmt: v => bw(v), area: true }) : '';
  const nx = nextSplit();
  const lastNx = nx && lastOfSplit(nx);
  const steps = S.steps[t] || 0, goal = p.stepGoal || 10000, frac = Math.min(1, steps / goal);
  const ws = mondayOf(t); let done = 0;
  const strip = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = addDays(ws, i); const wk = Object.values(S.workouts).filter(w => w.date === d);
    const trained = wk.some(w => !w.skipped), skipped = wk.some(w => w.skipped);
    if (trained) done++;
    const cls = (trained ? 'done' : skipped ? 'miss' : d > T ? 'future' : d === T ? 'today' : '') + (past && d === t ? ' sel' : '');
    const sp = wk.find(w => !w.skipped);
    return `<button class="d" data-a="day" data-k="${d}" aria-label="${esc(fmtDate(d, { wd: true }))}"><span>${WD[parseYmd(d).getDay()].slice(0, 1)}</span><span class="dot ${cls}" ${sp && wSplit(sp) ? `style="background:${wSplit(sp).color};border-color:${wSplit(sp).color}"` : ''} title="${esc(fmtDate(d, { wd: true }))}${sp ? ': ' + esc(sp.splitName) : skipped ? ': skipped' : ''}">${sp ? esc(splitTag(sp.splitName)) : skipped ? '×' : ''}</span></button>`;
  }).join('');
  const prs = past ? ix().prs.filter(x => x.date === t) : ix().prs.slice(-3).reverse();
  return `<div class="stack">
  ${past ? `<div class="top"><div><div class="eyebrow">${esc(longDay(t).split(',')[0])} · ${esc((n => n === 1 ? 'Yesterday' : n + ' days ago')(daysBetween(t, T)))}</div><h1>${esc(fmtDate(t))}</h1></div><button class="btn sm" data-a="viewDay" data-k="">Today</button></div>` : `<div class="top"><div><div class="eyebrow">${esc(longDay(t))}</div><h1>${greeting()}, ${esc(p.name)}</h1></div></div>`}
  ${A ? `<button class="tl card row between" data-a="resume" style="border-color:var(--text2)"><div><div class="eyebrow">In progress</div><h3 class="mt1">${esc(A.splitName)} · started ${hm(A.start)} · <span class="num" data-elapsed>${fmtDur(Date.now() - A.start)}</span></h3></div><span class="btn sm primary">Resume</span></button>` : ''}
  <div class="card"><div class="card-h"><span class="eyebrow">${ws === mondayOf(T) ? 'This week' : 'That week'}</span>${datePick(t)}</div>
    <div class="row between mt1"><div><span class="mid">${done}</span><span class="unit">/ ${p.weeklyTarget} workouts</span></div><span class="cap">${past ? 'week of ' + esc(fmtDate(ws)) : esc(streakText())}</span></div>
    <div class="week">${strip}</div>${past ? '' : restWeekLine(ws, done)}</div>
  <button class="tl full card" data-a="weigh" data-k="${t}">
    <div class="card-h"><span class="eyebrow">Body weight</span><span class="cap">${past ? (loggedToday ? 'Weighed in that day' : lw ? 'Last ' + esc(fmtDate(lw.d)) + ' · tap to add' : 'Tap to add') : loggedToday ? 'Logged today' : lw ? 'Last ' + relDay(lw.d) + ' · tap to weigh in' : 'Tap to weigh in'}</span></div>
    <div class="row between" style="align-items:flex-end"><div class="big">${lw ? bw(lw.w) : '—'}<span class="unit">${U()}</span></div>
    <div class="tr cap">${loggedToday && weightOn(addDays(t, -1)) && lw ? 'vs last ' + wdelta(lw.w, weightOn(addDays(t, -1)).w) : ''}</div></div>
    <div class="mt4 kpis"><div class="kpi"><b>${a7 ? bw(a7) : '—'}</b><span>7-day avg</span></div><div class="kpi"><b>${since == null ? '—' : bw(since, true)}</b><span>since ${fw ? esc(fmtDate(fw.d)) + (fw.src === 'estimated' ? ' (est.)' : '') : 'start'}</span></div><div class="kpi"><b>${(() => { const r = ratePerMonth(); return r == null ? '—' : bw(r, true); })()}</b><span>per month</span></div></div>
    <div class="mt3">${wchart}</div>
  </button>
  <button class="tl card row g4 steps-row" data-a="steps" data-k="${t}">
    <div class="ring sm"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="36" fill="none" stroke="var(--raised)" stroke-width="9"/>${frac > 0 ? `<circle cx="42" cy="42" r="36" fill="none" stroke="${frac >= 1 ? 'var(--pos)' : 'var(--text)'}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 36 * frac).toFixed(1)} 999"/>` : ''}</svg><div class="c">${Math.round(frac * 100)}%</div></div>
    <div class="grow"><div class="eyebrow">Steps</div><div class="mt1 f22 mid">${n0(steps)}</div><div class="cap">of ${n0(goal)} · tap to ${steps ? 'edit' : 'add'}</div></div>
  </button>
  ${past ? dayWorkoutCard(t) : `<div class="card nextup" style="--split:${nx ? nx.color : 'var(--accent)'};--ink:${nx ? inkOn(nx.color) : '#fff'}">
    <div class="card-h"><span class="eyebrow">Next up ${infoBtn('rotation')}</span><button class="mh32 cap" data-a="tab" data-k="splits">Rotation: ${esc(S.rotation.map(splitById).filter(Boolean).map(s => s.name).join(' → ') || 'not set')}</button></div>
    ${nx ? `<div class="hero"><i class="sdot" style="background:${nx.color}"></i>${esc(nx.name)}</div><div class="mt3 cap">${plural(nx.ex.length, 'exercise')} · ${lastNx ? 'last done ' + relDay(lastNx.date) : 'not done yet'}</div>
      ${A && A.splitId === nx.id ? `<button class="mt5 btn primary block" data-a="resume">Resume ${esc(nx.name)}</button>` : `<button class="mt5 btn primary block" data-a="startSplit" data-id="${nx.id}" ${A ? 'disabled' : ''}>Start ${esc(nx.name)}</button>`}
      ${(() => { const m = mergeLR(nx.ex, e => { const l = lastSession(e.name); return l ? l.sets.map(setStr).join(', ') : '—'; }); return foldList(m.length, m.map(r => `<div class="row between"><span class="sec">${esc(r.name)}</span><span class="num muted">${esc(r.txt)}</span></div>`).join('')); })()}`
      : `<div class="empty">Create a split to get started.</div>`}
  </div>`}
  ${past ? '' : (() => { const tw = Object.values(S.workouts).some(w => w.date === T && !w.skipped); if (tw) return dayWorkoutCard(T, 'Today\'s session'); const lw2 = Object.values(S.workouts).filter(w => !w.skipped && w.date < T).sort(sortW).pop(); return lw2 ? dayWorkoutCard(lw2.date, 'Last session · ' + relDay(lw2.date)) : ''; })()}
  ${past ? '' : goalsCard() + reportCard() + plateauCard()}
  ${prs.length ? `<div class="card"><div class="card-h"><span class="eyebrow">${past ? 'PRs that day' : 'Latest PRs'}</span><button class="mh32 cap" data-a="prog" data-k="strength">All PRs</button></div>${prs.map(prRow).join('')}</div>` : ''}
</div>`;
}
// Rest week (23 Oct): sick or away, the weekly streak holds. Apple added Pause Rings and Duolingo has streak freezes for the same reason.
// Offered from Friday, only once a streak exists and this week has no workout yet; a rest week neither adds to nor breaks the streak.
function restWeekLine(ws, done) {
  const on = (S.profile.restWeeks || []).includes(ws);
  if (on) return `<div class="row between mt2 cap rest-line"><span>Rest week. Your streak is safe.</span><button class="link" data-a="restWeek" data-k="${ws}">Undo</button></div>`;
  if (done || daysBetween(ws, today()) < 4 || !ix().ws.some(w => !w.skipped && mondayOf(w.date) === addDays(ws, -7))) return '';
  return `<div class="row between mt2 cap rest-line"><span>Sick or away this week?</span><button class="link" data-a="restWeek" data-k="${ws}">Take a rest week</button></div>`;
}
function ratePerMonth() {
  const l = weightList(); if (l.length < 2) return null;
  const a = l[0], b = l[l.length - 1]; const d = daysBetween(a.d, b.d); if (d < 14) return null;
  return (b.w - a.w) / d * 30.44;
}
function streakText() {
  const ws = ix().ws.filter(w => !w.skipped); if (!ws.length) return 'No workouts yet';
  const weeks = new Set(ws.map(w => mondayOf(w.date)));
  const rest = new Set(S.profile.restWeeks || []);
  let k = 0, m = mondayOf(today());
  if (!weeks.has(m)) m = addDays(m, -7);
  while (weeks.has(m) || rest.has(m)) { if (weeks.has(m)) k++; m = addDays(m, -7); }
  return k ? `${k}-week streak` : 'Train this week to start a streak';
}
function prRow(p) {
  return `<button class="li" data-a="openEx" data-name="${esc(p.ex)}"><div class="grow"><div class="t">${esc(p.ex)}</div><div class="s">${esc(fmtDate(p.date, { wd: true }))} · ${p.types.map(t => esc(t)).join(', ')}</div></div><span class="fw6 num">${setStr(p.set)}</span><span class="pill pr">PR</span></button>`;
}

// ---------- Splits ----------
// The muscle groups a split hits most, as small labels.
function splitMuscles(sp, n = 3) {
  const c = {}; for (const e of sp.ex) { const m = exInfo(e.name).muscle; if (m !== 'Other') c[m] = (c[m] || 0) + (e.sets || 1); }
  const top = Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, n);
  return top.length ? `<div class="mus">${top.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : '';
}
function viewSplits() {
  const rk = sp => { const i = S.rotation.indexOf(sp.id); return i < 0 ? 1e3 : i; };
  const act = S.splits.filter(s => !s.archived).map((s, i) => [s, i]).sort((a, b) => rk(a[0]) - rk(b[0]) || a[1] - b[1]).map(x => x[0]), arc = S.splits.filter(s => s.archived);
  const nx = nextSplit();
  const card = sp => {
    const l = lastOfSplit(sp);
    const vols = ix().ws.filter(w => !w.skipped && (w.splitId === sp.id || (!w.splitId && w.splitName === sp.name))).slice(-8).map(wVol);
    return `<div class="swipe"><button class="swipe-del" data-a="spDelete" data-id="${sp.id}" tabindex="-1">Delete</button><button class="card split" data-a="openSplit" data-id="${sp.id}" style="--split:${sp.color}"><span class="tag" style="background:${sp.color}"></span><div class="grow"><div class="g2 row"><h3>${esc(sp.name)}</h3>${nx && nx.id === sp.id ? '<span class="pill">Next up</span>' : ''}</div><div class="mt1 cap">${plural(sp.ex.length, 'exercise')} · ${l ? relDay(l.date) : 'not done yet'}</div>${splitMuscles(sp)}</div>${sparkline(vols, sp.color)}${I.right}</button></div>`;
  };
  return `<div class="stack">
  <div class="top"><h1>Splits</h1><button class="btn sm" data-a="newSplit">New split</button></div>
  <button class="tl card tight row between" data-a="rotation"><div><div class="eyebrow">Rotation</div><div class="mt1 fw6">${esc(S.rotation.map(splitById).filter(Boolean).map(s => s.name).join(' → ') || 'Not set')}</div><div class="mt1 cap">Next up on Today is the split after the one you did last. Saving a new order starts again from the first.</div></div><span class="cap">Edit</span></button>
  ${act.map(card).join('')}
  ${arc.length ? `<details><summary class="link">Archived (${arc.length})</summary><div class="mt2 stack">${arc.map(card).join('')}</div></details>` : ''}
</div>`;
}
const targetStr = e => `${plural(e.sets, 'set')} × ${e.repMin}${plural(e.repMax !== e.repMin ? '–' + e.repMax : '', 'rep')}`;
function viewSplit({ id }) {
  const sp = splitById(id); if (!sp) return backBtn();
  const l = lastOfSplit(sp);
  return `<div class="stack">${backBtn('Splits')}
  <div class="pt0 top"><div class="grow"><div class="eyebrow" style="color:${sp.color}">Split</div><h1>${esc(sp.name)}</h1><div class="mt2 cap">${plural(sp.ex.length, 'exercise')} · ${l ? 'last done ' + fmtDate(l.date, { wd: true }) : 'not done yet'}</div></div></div>
  <div class="row">${A && A.splitId === sp.id ? `<button class="btn primary grow" data-a="resume">Resume ${esc(sp.name)}</button>` : `<button class="btn primary grow" data-a="startSplit" data-id="${sp.id}" ${A ? 'disabled' : ''}>${A ? 'Workout in progress' : 'Start ' + esc(sp.name)}</button>`}<button class="btn" data-a="editSplit" data-id="${sp.id}">Edit</button></div>
  <div class="card"><div class="list">${sp.ex.map(e => { const ls = lastSession(e.name); return `<button class="li" data-a="openEx" data-name="${esc(e.name)}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${targetStr(e)}</div><div class="mt1 s num">Last time: ${ls ? ls.sets.map(setStr).join(', ') + ' · ' + relDay(ls.date) : '—'}</div>${e.note ? `<div class="it s">${esc(e.note)}</div>` : ''}</div>${I.right}</button>`; }).join('') || '<div class="empty">No exercises yet. Tap Edit to add some.</div>'}</div></div>
<button class="btn block" data-a="spShare" data-id="${sp.id}">Share this split</button>
<button class="btn block danger-fill" data-a="spDelete" data-id="${sp.id}">Delete split</button>
</div>`;
}
function viewSplitEdit({ id }) {
  const sp = splitById(id); if (!sp) return backBtn();
  return `<div class="stack"><div class="row between"><h2 class="m0">Edit split</h2><button class="btn sm primary" data-a="back">Done</button></div>
  <div class="field"><label for="sp-name">Name</label><input class="input" id="sp-name" data-in="spName" data-id="${sp.id}" value="${esc(sp.name)}" maxlength="30"></div>
  <div class="field"><span class="lbl">Colour</span><div class="chips">${PALETTE.map(c => `<button class="chip ${sp.color === c ? 'on' : ''}" data-a="spColor" data-id="${sp.id}" data-c="${c}" aria-label="Colour ${c}"><span style="width:14px;height:14px;border-radius:50%;background:${c};display:inline-block"></span></button>`).join('')}</div></div>
  <h2>Exercises</h2>
  <div class="stack dsort" data-sort="split" data-id="${sp.id}">${sp.ex.map((e, i) => `<div class="g2 card tight stack" data-dragitem>
    <div class="row"><button class="drag-h" data-drag aria-label="Drag to move ${esc(e.name)}">${I.grip}</button><div class="f17 grow ex-name">${esc(e.name)}</div>
      <button class="icon-btn" data-a="spRemove" data-id="${sp.id}" data-i="${i}" aria-label="Remove ${esc(e.name)}">${I.x}</button></div>
    <div class="g2 row wrap">
      <label class="g2 row cap">Sets <input class="input sm num" style="width:52px" inputmode="numeric" id="se-${i}-sets" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="sets" value="${e.sets}"></label>
      <label class="g2 row cap">Reps <input class="input sm num" style="width:48px" inputmode="numeric" id="se-${i}-min" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="repMin" value="${e.repMin}">–<input class="input sm num" style="width:48px" inputmode="numeric" id="se-${i}-max" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="repMax" value="${e.repMax}"></label>
    </div>
    <input class="input sm" placeholder="Note: seat height, grip, cue" id="se-${i}-note" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="note" value="${esc(e.note || '')}">
  </div>`).join('')}</div>
  <button class="btn block" data-a="spAdd" data-id="${sp.id}">Add exercise</button>
  <div class="row"><button class="btn grow" data-a="spDup" data-id="${sp.id}">Duplicate</button><button class="btn grow" data-a="spArchive" data-id="${sp.id}">${sp.archived ? 'Unarchive' : 'Archive'}</button></div>
  <button class="btn block danger-fill" data-a="spDelete" data-id="${sp.id}">Delete split</button>
</div>`;
}

// ---------- Progress ----------
function viewProgress() {
  const segs = [['body', 'Body'], ['strength', 'Strength'], ['volume', 'Volume'], ['history', 'History']];
  const inner = ({ body: progBody, strength: progStrength, volume: progVolume, history: progHistory })[NAV.prog]();
  return `<div class="stack"><div class="top"><h1>Progress</h1></div>
  <div class="seg" role="tablist">${segs.map(([k, l]) => `<button role="tab" class="${NAV.prog === k ? 'on' : ''}" aria-selected="${NAV.prog === k}" data-a="prog" data-k="${k}">${l}</button>`).join('')}</div>${inner}</div>`;
}
function progBody() {
  const ranges = { '1M': 31, '3M': 92, '6M': 183, 'YTD': daysBetween(today().slice(0, 4) + '-01-01', today()), 'All': 1e5 };
  const lim = ranges[NAV.range] || 183;
  const all = weightList(), list = all.filter(e => daysBetween(e.d, today()) <= lim);
  const trend = trendSeries(all).filter(p => (Date.now() - p.x) / DAY <= lim + 1);
  const p = S.profile, lw = latestWeight(), fw = firstWeight();
  const bmi = w => p.heightCm ? (w / ((p.heightCm / 100) ** 2)).toFixed(1) : '—';
  const st = steps30();
  return `<div class="card"><div class="card-h"><span class="eyebrow">Body weight</span><span class="cap">${U()}</span></div>
    <div class="mb3 seg">${Object.keys(ranges).map(k => `<button class="${NAV.range === k ? 'on' : ''}" data-a="range" data-k="${k}">${k}</button>`).join('')}</div>
    ${lineChart({ series: [{ pts: list.map(e => ({ x: ts(e.d), y: e.w, hollow: e.src === 'estimated' })), color: 'var(--text2)', dots: true, dotsOnly: list.length > 1, noArea: true, noEnd: true }, { pts: trend, color: 'var(--accent)', width: 2.6 }], h: 190, yfmt: v => bw(v) })}
    <div class="mt2 legend"><span><i style="background:var(--accent)"></i>Trend</span><span><i style="background:var(--text2);width:6px;height:6px;border-radius:50%"></i>Logged</span><span><i style="background:transparent;border:1.5px solid var(--text2);width:7px;height:7px;border-radius:50%"></i>Estimated</span></div>
  </div>
  <div class="card"><div class="kpis"><div class="kpi"><b>${fw ? bw(fw.w) : '—'}</b><span>${fw ? esc(fmtDate(fw.d)) + (fw.src === 'estimated' ? ' (est.)' : '') : 'start'}</span></div><div class="kpi"><b>${lw ? bw(lw.w) : '—'}</b><span>now</span></div><div class="kpi"><b>${lw && fw ? bw(lw.w - fw.w, true) : '—'}</b><span>total change</span></div></div>
    <div class="mt3 cap">${p.heightCm && fw ? `BMI ${bmi(fw.w)} → ${lw ? bmi(lw.w) : '—'} · ` : ''}${(() => { const r = ratePerMonth(); return r == null ? '' : 'about ' + bw(Math.abs(r)) + ' ' + U() + (r < 0 ? ' down' : ' up') + ' per month'; })()}</div>
    <button class="link" data-a="weights">All weight entries</button></div>
  ${measCard()}
  <div class="card"><div class="card-h"><span class="eyebrow">Steps · last 30 days</span><button class="mh32 cap" data-a="steps">Add</button></div>
    ${st.any ? barChart({ bars: st.bars, line: st.avg, h: 140 }) + '<div class="mt2 legend"><span><i style="background:var(--text2)"></i>Daily</span><span><i style="background:var(--accent)"></i>7-day average</span></div>' : '<div class="empty">No steps logged yet. Tap Add, or import from an Apple Shortcut (see Me → Apple Health).</div>'}
  </div>`;
}
function steps30() {
  const t = today(), days = []; for (let i = 29; i >= 0; i--) days.push(addDays(t, -i));
  const vals = days.map(d => S.steps[d] || 0);
  const avg = vals.map((_, i) => { const w = vals.slice(Math.max(0, i - 6), i + 1).filter(v => v > 0); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; });
  return { any: vals.some(v => v > 0), bars: days.map((d, i) => ({ v: vals[i], label: i % 7 === 0 ? String(parseYmd(d).getDate()) : '', tip: fmtDate(d, { wd: true }) + ' · ' + n0(vals[i]) + ' steps', hi: d === t })), avg };
}
function viewWeights() {
  const l = weightList().reverse();
  return `<div class="stack">${backBtn('Progress')}<div class="pt0 top"><h1>Weight log</h1><button class="btn sm" data-a="weighDate">Add entry</button></div>
  ${l.some(e => e.src === 'estimated') ? `<div class="card est-note"><b>${plural(l.filter(e => e.src === 'estimated').length, 'entry is an estimate', 'entries are estimates')}</b><span>They were filled in from your starting numbers, not weighed. They show as hollow points, are marked Estimated below, and never count toward badges. Tap one to replace it with a real weigh-in.</span></div>` : ''}
  <div class="card"><div class="list">${l.map(e => `<button class="li" data-a="weighDate" data-d="${e.d}"><div class="grow"><div class="t">${esc(fmtDate(e.d, { wd: true, y: true }))}</div><div class="s">${e.src === 'estimated' ? '<span class="est-tag">Estimated</span>' : e.src === 'import' ? 'Imported' : 'Logged'}</div></div><span class="fw6 num">${bw(e.w)} ${U()}</span>${I.right}</button>`).join('')}</div></div></div>`;
}
function exerciseGroups() {
  const h = ix().hist, groups = {};
  for (const n of Object.keys(h)) { const b = baseName(n); (groups[b] || (groups[b] = [])).push(n); }
  return Object.entries(groups).map(([b, names]) => {
    const sessions = names.flatMap(n => h[n]);
    const last = sessions.reduce((a, s) => s.date > a ? s.date : a, '');
    return { b, names, n: Math.max(...names.map(n => h[n].length)), last };
  }).sort((a, b) => a.last < b.last ? 1 : a.last > b.last ? -1 : a.b.localeCompare(b.b));
}
// Weight and strength as % of where each started, week by week, so a cut that keeps strength is visible.
function cutData() {
  const ws = weightList(); if (ws.length < 2) return null;
  const h = ix().hist, base = {}, weeks = {};
  for (const [n, ss] of Object.entries(h)) {
    const v = ss.filter(x => x.e1 > 0); if (v.length < 3) continue;
    base[n] = Math.max(...v.slice(0, 2).map(x => x.e1));
    for (const x of v) { const m = mondayOf(x.date); (weeks[m] || (weeks[m] = {}))[n] = Math.max((weeks[m] || {})[n] || 0, x.e1); }
  }
  const med = a => { const b = a.slice().sort((x, y) => x - y), k = b.length >> 1; return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; };
  // strength: carry each lift's latest best forward so a week with only one split still reflects every lift
  const cur = {}, str = [];
  for (const m of Object.keys(weeks).sort()) { Object.assign(cur, weeks[m]); const r = Object.entries(cur).map(([n, v]) => v / base[n]); if (r.length >= 3) str.push({ x: ts(m), y: Math.round(med(r) * 1000) / 10 }); }
  const w0 = ws[0].w, wk = {};
  for (const e of ws) { const m = mondayOf(e.d); (wk[m] || (wk[m] = [])).push(e.w); }
  const wt = Object.keys(wk).sort().map(m => ({ x: ts(m), y: Math.round(wk[m].reduce((a, b) => a + b, 0) / wk[m].length / w0 * 1000) / 10 }));
  if (str.length < 2) return null;
  // Both lines start at 100% in the same week, so "% of where you started" is literally true for each.
  let i0 = 0; for (let i = 0; i < wt.length; i++) if (wt[i].x <= str[0].x) i0 = i;
  const wt2 = wt.slice(i0); if (wt2.length < 2) return null;
  const rb = (a, x0) => a.map((p, i) => ({ x: i === 0 ? x0 : p.x, y: Math.round(p.y / a[0].y * 1000) / 10 }));
  const S2 = rb(str, str[0].x), W2 = rb(wt2, str[0].x);
  return { str: S2, wt: W2, sNow: S2[S2.length - 1].y, wNow: W2[W2.length - 1].y, w0, from: ymd(new Date(str[0].x)) };
}
function cutCard() {
  const c = cutData(); if (!c) return '';
  const ds = c.sNow - 100, dwt = c.wNow - 100;
  return `<div class="card"><div class="card-h"><span class="eyebrow">Weight vs strength ${infoBtn('strength')}</span><span class="cap">since ${esc(fmtDate(c.from))} = 100%</span></div>
    <div class="mb3 kpis"><div class="kpi"><b class="${dwt < 0 ? '' : ''}">${dwt > 0 ? '+' : ''}${dwt.toFixed(1)}%</b><span>body weight</span></div><div class="kpi"><b class="${ds >= -1 ? 'c-pos' : 'c-neg'}">${ds > 0 ? '+' : ''}${ds.toFixed(1)}%</b><span>strength</span></div></div>
    ${lineChart({ series: [{ pts: c.wt, color: 'var(--text2)', noArea: true }, { pts: c.str, color: 'var(--accent)', width: 2.6, noArea: true }], h: 180, yfmt: v => Math.round(v) + '%' })}
    <div class="mt2 legend"><span><i style="background:var(--accent)"></i>Strength (median e1RM)</span><span><i style="background:var(--text2)"></i>Body weight</span></div>
    <div class="mt3 cap">${ds >= -1 ? `Since ${esc(fmtDate(c.from))} you've ${dwt <= 0 ? 'lost' : 'gained'} ${Math.abs(dwt).toFixed(0)}% body weight and kept your strength${ds > 1 ? `, even gaining ${ds.toFixed(0)}%` : ''}. The cut is taking fat, not muscle.` : `Strength is down ${Math.abs(ds).toFixed(0)}% while weight is down ${Math.abs(dwt).toFixed(0)}%. Check sleep and recovery, and keep lifting heavy.`}</div></div>`;
}
function progStrength() {
  const prs = ix().prs.slice(-10).reverse();
  const groups = exerciseGroups();
  return `${cutCard()}<div class="card"><div class="card-h"><span class="eyebrow">PR wall ${infoBtn('pr')}</span><span class="cap">${plural(ix().prs.length, 'PR')}${ix().ws.length ? ' since ' + esc(fmtDate(ix().ws[0].date)) : ''}</span></div>${prs.map(prRow).join('') || '<div class="empty">PRs appear here as you beat your bests.</div>'}</div>
  <div class="card"><div class="card-h"><span class="eyebrow">Exercises</span><span class="cap">best e1RM ${infoBtn('e1rm')}</span></div><div class="list">${groups.map(g => {
    const n = g.names.find(x => sideOf(x) === 'R') || g.names[0];
    const h = ix().hist[n]; const cur = ix().best[n] ? ix().best[n].e1 : 0;
    const old = h.filter(s => daysBetween(s.date, today()) >= 28 && s.e1 > 0).map(s => s.e1);
    const prev = old.length ? Math.max(...old) : null;
    return `<button class="li" data-a="openEx" data-name="${esc(g.names[0])}"><div class="grow"><div class="t">${esc(g.b)}${g.names.length > 1 ? ' <span class="cap">L / R</span>' : ''}</div><div class="s">${plural(g.n, 'session')} · last ${relDay(g.last)}</div></div><div class="tr"><div class="fw6 num">${e1f(cur)}</div><div class="cap">${prev && cur ? delta(cur, prev, v => e1f(v)) + ' vs 4 wk' : ''}</div></div>${I.right}</button>`;
  }).join('')}</div></div>`;
}
function weekKey(d) { return mondayOf(d); }
function progVolume() {
  const t = today(), m0 = mondayOf(t);
  const weeks = []; for (let i = 11; i >= 0; i--) weeks.push(addDays(m0, -7 * i));
  const vol = {}, setsBy = {};
  for (const w of ix().ws) {
    if (w.skipped) continue; const k = weekKey(w.date); vol[k] = (vol[k] || 0) + wVol(w);
    for (const e of w.ex) { const mu = exInfo(e.name).muscle; const n = e.sets.filter(s => s.t !== 'warm').length * (sideOf(e.name) ? 0.5 : 1); const o = setsBy[k] || (setsBy[k] = {}); o[mu] = (o[mu] || 0) + n; }
  }
  const conv = v => U() === 'lb' ? v * LB : v;
  const bars = weeks.map(k => ({ v: conv(vol[k] || 0), label: fmtDate(k).replace(/ \w+$/, m => ''), tip: 'Week of ' + fmtDate(k) + ' · ' + n0(conv(vol[k] || 0)) + ' ' + U(), hi: k === m0 }));
  bars.forEach((b, i) => { b.label = i % 3 === 0 || i === bars.length - 1 ? fmtDate(weeks[i]) : ''; });
  const cur = setsBy[m0] || {}, prev4 = {};
  for (let i = 1; i <= 4; i++) { const o = setsBy[addDays(m0, -7 * i)] || {}; for (const [k, v] of Object.entries(o)) prev4[k] = (prev4[k] || 0) + v / 4; }
  const musc = MUSCLES.filter(m => (cur[m] || 0) + (prev4[m] || 0) > 0);
  const mx = Math.max(1, ...musc.map(m => Math.max(cur[m] || 0, prev4[m] || 0)));
  const zero = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings'].filter(m => !(cur[m] > 0));
  const vals = musc.map(m => cur[m] || 0).filter(v => v > 0);
  let note = '';
  if (vals.length >= 2) {
    const hi = musc.reduce((a, m) => (cur[m] || 0) > (cur[a] || 0) ? m : a, musc[0]);
    note = `This week: ${esc(hi)} leads with ${plural(trim(cur[hi]), 'set')}.` + (zero.length ? ` No sets yet for ${esc(zero.join(', '))}.` : '');
  }
  return `<div class="card"><div class="card-h"><span class="eyebrow">Weekly volume</span><span class="cap">${U()} lifted, last 12 weeks</span></div>${barChart({ bars, h: 160, yfmt: v => v >= 1000 ? trim(v / 1000) + 'k' : n0(v) })}</div>
  <div class="card"><div class="card-h"><span class="eyebrow">Sets per muscle ${infoBtn('muscle')}</span><span class="cap">this week · <span style="color:var(--muted)">▮</span> 4-week avg</span></div>
    <div class="g2 stack">${musc.map(m => `<div class="hbar"><span class="sec">${m}</span><div class="rel b"><i style="width:${(cur[m] || 0) / mx * 100}%;background:var(--text)"></i><span style="position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--muted);left:${(prev4[m] || 0) / mx * 100}%"></span></div><span class="tr num">${trim(cur[m] || 0)}</span></div>`).join('') || '<div class="empty">No sets this week yet.</div>'}</div>
    ${note ? `<div class="mt3 note">${note}</div>` : ''}
    <div class="mt3 cap">Left and right sides of one exercise count as half a set each.</div></div>`;
}
function progHistory() {
  const ws = ix().ws.slice().reverse();
  const start = ws.length ? ws[ws.length - 1].date : today();
  const m0 = mondayOf(start), end = today();
  const vols = {}; Object.values(S.workouts).forEach(w => { vols[w.date] = w.skipped ? (vols[w.date] || -1) : (Math.max(0, vols[w.date] || 0) + wVol(w)); });
  const vmax = Math.max(1, ...Object.values(vols));
  let cells = '';
  for (let d = m0; d <= addDays(mondayOf(end), 6); d = addDays(d, 1)) {
    const v = vols[d]; let cls = d > end ? 'out' : '';
    if (v === -1) cls = 'sk'; else if (v > 0) cls = 'l' + Math.min(4, 1 + Math.floor(v / vmax * 3.999));
    cells += `<i class="${cls}" title="${esc(fmtDate(d, { wd: true }))}"></i>`;
  }
  let lastM = '', list = '';
  for (const w of ws) {
    const m = w.date.slice(0, 7);
    if (m !== lastM) { list += `${lastM ? '</div></div>' : ''}<div class="card"><div class="mb1 eyebrow">${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}</div><div class="list">`; lastM = m; }
    const sp = wSplit(w);
    list += `<button class="li" data-a="openWk" data-id="${w.id}"><span class="tag" style="width:6px;height:32px;border-radius:3px;background:${sp ? sp.color : 'var(--muted)'};flex:none"></span><div class="grow"><div class="t">${esc(w.splitName || 'Workout')}${w.skipped ? ' <span class="c-neg pill">Skipped</span>' : ''}</div><div class="s">${esc(fmtDate(w.date, { wd: true }))}${w.skipped ? '' : ' · ' + w.ex.length + ' exercises · ' + wSets(w) + ' sets'}${w.end && w.start ? ' · ' + fmtDur(w.end - w.start) : ''}</div></div><span class="num sec">${w.skipped ? '' : dvol(wVol(w))}</span>${I.right}</button>`;
  }
  if (lastM) list += '</div></div>';
  const trained = ws.filter(w => !w.skipped).length;
  const rm = reportMonths();
  return `${badgesCard()}
  <div class="card"><div class="card-h"><span class="eyebrow">Monthly reports</span><span class="cap">tap to open and share</span></div><div class="list">${rm.slice(0, 6).map(m => `<button class="li" data-a="month" data-k="${m}"><div class="grow"><div class="t">${esc(monthName(m))}</div><div class="s">${plural(ix().ws.filter(w => !w.skipped && ymOf(w.date) === m).length, 'workout')}</div></div>${I.right}</button>`).join('')}</div></div>
  <div class="card"><div class="card-h"><span class="eyebrow">Training days</span><span class="cap">${plural(trained, 'workout')} since ${fmtDate(start)}</span></div><div class="heat" aria-label="Calendar of training days">${cells}</div>
  <div class="mt2 legend"><span><i style="background:var(--accent);height:8px;width:8px;border-radius:2px"></i>Heavier day</span><span><i style="background:color-mix(in srgb, var(--accent) 28%, transparent);height:8px;width:8px;border-radius:2px"></i>Lighter day</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--neg);height:8px;width:8px;border-radius:2px"></i>Skipped</span></div></div>
  ${list || '<div class="empty">No workouts yet.</div>'}`;
}

// ---------- exercise detail ----------
// How-to pictures (Job, 16 Oct): Everkinetic line drawings (CC BY-SA 4.0) in one style, recoloured by the theme, plus a
// body map that lights up the muscles worked. One-side lifts ("X (L)") use a one-arm/one-leg drawing when there is one.
let HOWTO = null, HOWTO_LOADING = false, BODY = null;
const HT_SVG = {};
function howtoFor(name) {
  if (!HOWTO && !HOWTO_LOADING && HOSTED) {
    HOWTO_LOADING = true;
    Promise.all([fetch('ex/index.json').then(r => r.ok ? r.json() : {}), fetch('ex/body.json').then(r => r.ok ? r.json() : null)])
      .then(([j, b]) => { HOWTO = j || {}; BODY = b; rerender(); }).catch(() => { HOWTO = {}; });
  }
  return HOWTO && HOWTO[baseName(name)];
}
// Front and back body outlines with worked muscles filled: p = main, q = helping. side 'L'/'R' lights one side only.
function bodyMapHTML(p, q, side) {
  if (!BODY) return '';
  const k = side === 'L' ? ['l'] : side === 'R' ? ['r'] : ['l', 'r'];
  const fig = (parts, outline, vb) => `<svg class="bm" viewBox="${vb}" aria-hidden="true"><path class="bm-o" d="${outline}"/>${parts.map(m => {
    const c = p.includes(m.s) ? 'bm-p' : q.includes(m.s) ? 'bm-q' : '';
    return ['l', 'r'].map(sd => m[sd].map(d => `<path class="${c && k.includes(sd) ? c : 'bm-n'}" d="${d}"/>`).join('')).join('');
  }).join('')}</svg>`;
  return `<div class="bm-row">${fig(BODY.f, BODY.of, '0 0 724 1448')}${fig(BODY.b, BODY.ob, '724 0 724 1448')}</div>`;
}
const MUSCLE_NAMES = { chest: 'Chest', abs: 'Abs', obliques: 'Obliques', biceps: 'Biceps', triceps: 'Triceps', deltoids: 'Shoulders', trapezius: 'Traps', 'upper-back': 'Upper back', 'lower-back': 'Lower back', forearm: 'Forearms', gluteal: 'Glutes', adductors: 'Inner thighs', quadriceps: 'Quads', hamstring: 'Hamstrings', calves: 'Calves', tibialis: 'Shins' };
function howtoHTML(name, open) {
  const h = howtoFor(name); if (!h) return '';
  // No exercise pictures (Job, 16 Oct: too much). Muscle map and steps for the equipment you picked.
  const eq = exInfo(name).equip, side = sideOf(name);
  const mn = a => a.map(m => MUSCLE_NAMES[m] || m).join(', ');
  const base = (h.x && h.x[eq]) || h.s, steps = side ? ['Work one side at a time: do all your reps on one side, then switch.', ...base] : base;
  return `<div class="card howto">${side ? '<div class="ht-tag">One side at a time</div>' : ''}
  <div class="ht-mus">${bodyMapHTML(h.p, h.q, side)}<div class="grow"><div class="eyebrow">Muscles worked</div><div class="ht-ml"><i class="bm-key p"></i>${esc(mn(h.p))}</div>${h.q.length ? `<div class="ht-ml sec"><i class="bm-key q"></i>${esc(mn(h.q))}</div>` : ''}</div></div>
  <details ${open ? 'open' : ''}><summary class="eyebrow">How to do it</summary><ol class="ht-steps">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="cap ht-cr">Body map: react-muscle-highlighter, MIT.</p></details></div>`;
}
// Drawings are inline SVG so they take the theme's colours; fetch each once and drop it in when a card appears.
function htHydrate(root) {
  for (const el of root.querySelectorAll('.ht-fr[data-src]:not([data-done])')) {
    el.dataset.done = '1'; const src = el.dataset.src;
    (HT_SVG[src] = HT_SVG[src] || fetch(src).then(r => r.ok ? r.text() : '').catch(() => '')).then(t => { if (/^<svg[\s>]/.test(t)) el.innerHTML = t; });
  }
}
if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (document.querySelector('.ht-fr[data-src]:not([data-done])')) htHydrate(document); }).observe(document.documentElement, { childList: true, subtree: true });
function openHowto(name) {
  const h = howtoFor(name);
  if (!h) return toast(HOWTO ? 'No how-to pictures for this one yet.' : 'Loading pictures, try again in a second.');
  openSheet(`<div class="stack"><h2>${esc(baseName(name))}</h2>${howtoHTML(name, true)}<button class="btn block" data-a="closeSheet">Done</button></div>`, { label: 'How to do ' + baseName(name) });
}
// Lift goals (23 Oct): the top request on the Hevy subreddit. A goal is a weight for at least N reps, e.g. 100 kg × 5.
// Progress is the heaviest set you've logged with at least those reps. Facts only: no advice on how to get there.
const goalsOf = () => S.profile.goals || {};
function goalBest(name, r) { let best = null; for (const x of ix().hist[name] || []) for (const st of x.sets) if (validSet(st) && st.r >= r && (!best || st.w > best.w)) best = { w: st.w, r: st.r, date: x.date }; return best; }
function goalState(name) {
  const g = goalsOf()[name]; if (!g) return null;
  const best = goalBest(name, g.r), hit = best && best.w >= g.w - 0.01 ? (() => { for (const x of ix().hist[name] || []) if (x.sets.some(st => validSet(st) && st.r >= g.r && st.w >= g.w - 0.01)) return x.date; })() : null;
  return { ...g, name, best, hit, p: Math.min(1, best ? best.w / g.w : 0) };
}
function goalRow(G, link) {
  const tgt = `${dw(G.w)} ${U()} × ${G.r}`;
  const sub = G.hit ? `Reached ${esc(fmtDate(G.hit))}` : G.best ? `Best ${esc(dw(G.best.w))} ${U()} × ${G.best.r} · ${esc(dw(G.w - G.best.w))} ${U()} to go` : `No set of ${G.r}+ reps yet`;
  return `<${link ? `button class="goal li" data-a="openEx" data-name="${esc(G.name)}"` : 'div class="goal"'}><div class="row between"><span class="t">${link ? esc(G.name) : 'Goal'}</span><span class="num fw6">${tgt}</span></div>
    <i class="goal-bar ${G.hit ? 'hit' : ''}"><b style="width:${Math.round(G.p * 100)}%"></b></i><div class="cap">${sub}</div></${link ? 'button' : 'div'}>`;
}
function goalsCard() {
  const gs = Object.keys(goalsOf()).map(goalState).filter(Boolean); if (!gs.length) return '';
  gs.sort((a, b) => (!!a.hit - !!b.hit) || b.p - a.p);
  return `<div class="card"><div class="card-h"><span class="eyebrow">Goals</span><span class="cap">${gs.filter(g => g.hit).length} of ${gs.length} reached</span></div><div class="list">${gs.slice(0, 4).map(g => goalRow(g, true)).join('')}</div></div>`;
}
function openGoal(name) {
  const g = goalsOf()[name] || {}, best = goalBest(name, 1);
  const sh = openSheet(`<div class="stack"><h2>Goal for ${esc(name)}</h2>
    <p class="m0 sec">${best ? `Heaviest so far: ${esc(dw(best.w))} ${U()} × ${best.r}.` : 'No sets logged yet.'}</p>
    <div class="grid2"><div class="field"><label for="gl-w">Weight (${U()})</label><input class="input num" id="gl-w" inputmode="decimal" value="${g.w ? dw(g.w) : ''}" placeholder="${best ? dw(Math.ceil(best.w * 1.1 / 2.5) * 2.5) : ''}"></div>
    <div class="field"><label for="gl-r">Reps</label><select class="input" id="gl-r">${[1, 2, 3, 5, 8, 10, 12, 15].map(n => `<option ${n === (g.r || 5) ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <button class="btn block primary" id="gl-ok">Save goal</button>${g.w ? '<button class="btn block ghost c-neg" id="gl-del">Remove goal</button>' : '<button class="btn block ghost" data-a="closeSheet">Cancel</button>'}</div>`, { label: 'Goal' });
  sh.el.querySelector('#gl-ok').onclick = () => { const w = parseFloat(String(sh.el.querySelector('#gl-w').value).replace(',', '.')); if (!(w > 0)) { sh.el.querySelector('#gl-w').focus(); return; }
    S.profile.goals = { ...goalsOf(), [name]: { w: Math.round(toKg(w) * 100) / 100, r: +sh.el.querySelector('#gl-r').value, set: today() } }; persist('jd/meta'); closeSheet(sh); rerender(); toast('Goal saved'); };
  const d = sh.el.querySelector('#gl-del'); if (d) d.onclick = () => { const o = { ...goalsOf() }; delete o[name]; S.profile.goals = o; persist('jd/meta'); closeSheet(sh); rerender(); toast('Goal removed', 0, () => { S.profile.goals = { ...goalsOf(), [name]: g }; persist('jd/meta'); rerender(); }); };
}
function viewExercise(v) {
  const b = baseName(v.name), h = ix().hist;
  const sides = ['L', 'R'].filter(s => h[`${b} (${s})`]);
  const hasPlain = !!h[b];
  const opts = [...(hasPlain ? [b] : []), ...sides.map(s => `${b} (${s})`)];
  if (!v.sel) v.sel = sides.length === 2 && !hasPlain ? 'both' : v.name;
  if (!v.metric) v.metric = 'e1';
  const sel = v.sel === 'both' ? sides.map(s => `${b} (${s})`) : [v.sel];
  const colors = ['var(--text)', 'var(--accent)'];
  const metricOf = s => v.metric === 'e1' ? s.e1 : v.metric === 'top' ? (s.top ? s.top.w : 0) : s.vol;
  const series = sel.map((n, i) => ({ name: n, pts: (h[n] || []).filter(s => metricOf(s) > 0).map(s => ({ x: ts(s.date), y: U() === 'lb' ? metricOf(s) * LB : metricOf(s) })), color: colors[i], dots: true, noArea: sel.length > 1 }));
  const main = sel[sel.length - 1];
  const B = ix().best[main] || emptyBest();
  const sessions = (h[main] || []);
  const allSets = sessions.flatMap(s => s.sets.filter(validSet).map(x => ({ ...x, date: s.date })));
  const bestFor = n => { let r = null; for (const s of allSets) if (s.r >= n && (!r || s.w > r.w || (s.w === r.w && s.r > r.r))) r = s; return r; };
  const bw = latestWeight();
  const histSessions = sel.flatMap(n => (h[n] || []).map(s => ({ ...s, n }))).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.n < b.n ? -1 : 1);
  const info = exInfo(b);
  return `<div class="stack">${backBtn()}
  <div class="pt0 top"><div><button class="mh28 eyebrow" data-a="exCat" data-k="${esc(b)}">${esc(info.muscle)} · ${esc(info.equip)} ▾</button><h1>${esc(b)}</h1></div></div>
  ${opts.length > 1 ? `<div class="seg">${opts.map(o => `<button class="${v.sel === o ? 'on' : ''}" data-a="exSel" data-k="${esc(o)}">${sideOf(o) ? (sideOf(o) === 'L' ? 'Left' : 'Right') : opts.length > 2 ? 'Two-arm' : 'Both'}</button>`).join('')}${sides.length === 2 ? `<button class="${v.sel === 'both' ? 'on' : ''}" data-a="exSel" data-k="both">L + R</button>` : ''}</div>` : ''}
  ${setupHTML(b)}${howtoHTML(main)}
  <div class="card"><div class="kpis"><div class="kpi"><b>${e1f(B.e1)}</b><span>best e1RM ${infoBtn('e1rm')}</span></div><div class="kpi"><b>${B.maxW ? dw(B.maxW) : '—'}</b><span>heaviest</span></div><div class="kpi"><b>${B.vol ? dvol(B.vol) : '—'}</b><span>best set (${U()}) ${infoBtn('volume')}</span></div></div>
  ${bw && B.e1 && ['barbell', 'dumbbell', 'smith'].includes(exInfo(main).equip) ? `<div class="mt3 cap">Strength-to-weight: e1RM is <b class="c-text num">${(B.e1 / bw.w).toFixed(2)}×</b> your body weight${(() => { const old = sessions.filter(s => daysBetween(s.date, today()) >= 60 && s.e1 > 0); if (!old.length) return ''; const o = old[old.length - 1]; const ow = weightOn(o.date); return ow ? ` (was ${(Math.max(...old.map(s => s.e1)) / ow.w).toFixed(2)}× two months ago)` : ''; })()}.</div>` : ''}</div>
  ${(G => G ? `<div class="card">${goalRow(G)}<button class="mt2 link cap" data-a="goal" data-k="${esc(main)}">Edit goal</button></div>` : `<button class="card tight row between" data-a="goal" data-k="${esc(main)}"><span>Set a goal</span><span class="cap">e.g. ${esc(dw(Math.ceil(((B.maxW || 20) * 1.1) / 2.5) * 2.5))} ${U()} × 5</span></button>`)(goalState(main))}
  <div class="card"><div class="mb3 seg">${[['e1', 'e1RM'], ['top', 'Top set'], ['vol', 'Volume']].map(([k, l]) => `<button class="${v.metric === k ? 'on' : ''}" data-a="exMetric" data-k="${k}">${l}</button>`).join('')}</div>
    ${lineChart({ series, h: 180, yfmt: x => v.metric === 'vol' ? n0(x) : trim(Math.round(x * 10) / 10) })}
    ${sel.length > 1 ? `<div class="mt2 legend">${sel.map((n, i) => `<span><i style="background:${colors[i]}"></i>${sideOf(n) === 'L' ? 'Left' : 'Right'}</span>`).join('')}</div>` : ''}
  </div>
  <div class="card"><div class="card-h"><span class="eyebrow">Best sets${sel.length > 1 ? ' · right side' : ''}</span><span class="cap">heaviest weight for at least N reps</span></div>
    <table class="tbl"><tr><th>Reps</th><th class="r">Weight</th><th class="r">Set</th><th class="r">Date</th></tr>${[1, 3, 5, 8, 10, 12].map(n => { const s = bestFor(n); return `<tr><td>${n}+</td><td class="r num">${s ? dw(s.w) + ' ' + U() : '—'}</td><td class="r num sec">${s ? setStr(s) : ''}</td><td class="r sec">${s ? fmtDate(s.date) : ''}</td></tr>`; }).join('')}</table></div>
  <div class="card"><div class="card-h"><span class="eyebrow">History</span><span class="cap">${plural(sessions.length, 'session')}</span></div><div class="list">${histSessions.map(s => `<button class="li" data-a="openWk" data-id="${s.wid}"><div class="grow"><div class="t">${esc(fmtDate(s.date, { wd: true }))}${sel.length > 1 ? ` <span class="cap">${sideOf(s.n)}</span>` : ''}</div><div class="s num">${s.sets.map(setStr).join(', ')}${s.note ? ' · ' + esc(s.note) : ''}</div></div><span class="num sec">${s.vol ? dvol(s.vol) : ''}</span></button>`).join('')}</div></div>
</div>`;
}

// ---------- workout detail (history) ----------
function viewWorkout(v) {
  const w = S.workouts[v.id]; if (!w) return backBtn();
  const pr = new Map(ix().prs.filter(p => p.wid === w.id).map(p => [p.ex, p]));
  const ed = !!v.edit;
  return `<div class="stack"><div class="row between">${backBtn()}<div class="g2 row">${!ed && !w.skipped ? '<button class="btn sm" data-a="repeatWk">Do again</button><button class="btn sm" data-a="recap">Recap</button>' : ''}<button class="btn sm" data-a="wkEdit">${ed ? 'Done' : 'Edit'}</button></div></div>
  <div class="pt0 top"><div><div class="eyebrow">${esc(fmtDate(w.date, { wd: true, y: true }))}${w.src === 'import' ? ' · imported' : ''}</div><h1>${esc(w.splitName || 'Workout')}</h1></div></div>
  ${ed ? `<div class="grid2"><div class="field"><label for="wk-date">Date</label><input class="input" type="date" id="wk-date" data-in="wkDate" value="${w.date}"></div><div class="field"><label for="wk-split">Split</label><select class="input" id="wk-split" data-in="wkSplit">${S.splits.map(s => `<option value="${s.id}" ${wSplit(w) === s ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div></div>` : ''}
  ${w.skipped ? `<div class="card"><div class="empty">This session was skipped.</div></div>` : `<div class="card"><div class="kpis"><div class="kpi"><b>${dvol(wVol(w))}</b><span>${U()} volume</span></div><div class="kpi"><b>${wSets(w)}</b><span>sets</span></div><div class="kpi"><b>${w.end && w.start ? fmtDur(w.end - w.start) : '—'}</b><span>duration</span></div></div>${w.energy ? `<div class="mt3 cap">Energy ${w.energy}/5</div>` : ''}${w.note ? `<div class="mt3 note">${esc(w.note)}</div>` : ''}</div>`}
  ${w.ex.map((e, ei) => `<div class="card tight"><div class="row between"><button class="f17 ex-name" data-a="openEx" data-name="${esc(e.name)}">${esc(e.name)}</button>${pr.has(e.name) ? `<span class="pill pr">PR · ${esc(pr.get(e.name).types[0])}</span>` : ''}</div>
    ${e.note ? `<div class="mt1 cap">${esc(e.note)}</div>` : ''}
    ${ed ? `<div class="g2 mt2 stack">${e.sets.map((s, si) => `<div class="g2 row"><span class="cap" style="width:22px">${si + 1}</span><input class="input sm num" style="width:84px" inputmode="decimal" id="ws-${ei}-${si}-w" data-in="wsSet" data-e="${ei}" data-s="${si}" data-f="w" value="${s.w == null ? '' : dw(s.w)}" aria-label="Weight"><span class="cap">${U()} ×</span><input class="input sm num" style="width:60px" inputmode="numeric" id="ws-${ei}-${si}-r" data-in="wsSet" data-e="${ei}" data-s="${si}" data-f="r" value="${s.r == null ? '' : s.r}" aria-label="Reps"><button class="icon-btn" data-a="wsDel" data-e="${ei}" data-s="${si}" aria-label="Delete set">${I.x}</button></div>`).join('')}</div>`
      : `<div class="mt2 f15 num sec">${e.sets.map(setStr).join('  ·  ')}</div>`}
  </div>`).join('')}
  ${ed ? `<div class="field"><label for="wk-note">Note</label><textarea class="input" id="wk-note" data-in="wkNote">${esc(w.note || '')}</textarea></div>` : ''}
  <button class="btn block danger" data-a="wkDelete">Delete this workout</button>
</div>`;
}

// ---------- Me ----------
// iOS-style settings rows: one group per topic, hairlines between rows.
const swi = (on, a, extra = '') => `<button class="xsw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-a="${a}" ${extra}></button>`;
const srow = (t, right, sub) => `<div class="xr"><span class="grow">${t}${sub ? `<span class="s">${sub}</span>` : ''}</span>${right}</div>`;
const snum = (t, id, f, v, ph, unit) => `<label class="xr"><span class="grow">${t}</span><input class="xr-in ${f === 'name' ? '' : 'num'}" inputmode="${f === 'name' ? 'text' : 'decimal'}" id="${id}" data-in="${f === 'name' ? 'profT' : f === 'goalW' ? 'profW' : 'prof'}" data-f="${f}" value="${v == null ? '' : v}" placeholder="${ph || ''}">${unit ? `<span class="xr-u">${unit}</span>` : ''}</label>`;
const slink = (t, a, cls = '', extra = '') => `<button class="xr ${cls}" data-a="${a}" ${extra}><span class="grow">${t}</span>${cls ? '' : I.right}</button>`;
// Rep range picker: two numbers, "from" and "to". Either can be left on Skip.
function repPick(lo, hi, where) {
  const opt = (v, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v || 'Skip'}</option>`, nums = [0, ...Array.from({ length: 29 }, (_, i) => i + 1)];
  const at = where === 'ob' ? 'data-rr' : 'data-in="repR" data-rr';
  return `<div class="row rr"><select class="input rr-s" ${at}="0" aria-label="Lowest reps">${nums.map(v => opt(v, lo || 0)).join('')}</select><span class="sec">to</span><select class="input rr-s" ${at}="1" aria-label="Highest reps">${nums.map(v => opt(v, hi || 0)).join('')}</select><span class="sec">reps</span></div>`;
}
// If both numbers are set the wrong way round, swap them.
function fixRR(o, a, b) { if (o[a] && o[b] && o[a] > o[b]) [o[a], o[b]] = [o[b], o[a]]; if (o[a] && o[a] === o[b]) o[b] = o[a] + 1; }
function repRangeRow() {
  const r = S.profile.repRange || [], set = r[0] && r[1];
  return `<div class="xr rr-row"><span class="grow">Rep range<span class="s">${set ? `Move up a weight once you hit ${r[1]} reps, then start again at ${r[0]}` : 'Optional. Your desired rep range before moving up a weight. Skipped means 6 to 9'}</span></span>${repPick(r[0], r[1], 'me')}</div>`;
}
function viewMe() {
  const p = S.profile, lw = latestWeight(), fw = firstWeight(), on = f => !p[f];
  const goal = p.goalW ? `${bw(Math.abs(lw ? lw.w - p.goalW : 0))} ${U()} to your goal of ${bw(p.goalW)} ${U()}` : '';
  return `<div class="stack"><div class="top"><div><div class="eyebrow">Profile</div><h1>${esc(p.name)}</h1></div></div>
  <div class="card"><div class="kpis"><div class="kpi"><b>${p.heightCm ? p.heightCm + ' cm' : '—'}</b><span>height</span></div><div class="kpi"><b>${lw ? bw(lw.w) + ' ' + U() : '—'}</b><span>current</span></div><div class="kpi"><b>${lw && fw ? bw(lw.w - fw.w, true) : '—'}</b><span>since ${fw ? esc(fmtDate(fw.d)) + (fw.src === 'estimated' ? ' (est.)' : '') : 'start'}</span></div></div>
    <div class="mt3 cap">${plural(ix().ws.filter(w => !w.skipped).length, 'workout')} logged · BMI ${lw && p.heightCm ? (lw.w / (p.heightCm / 100) ** 2).toFixed(1) : '—'}${goal && lw ? ' · ' + goal : ''}</div></div>
  <section><div class="sgh">You</div><div class="sgrp">
    ${snum('Name', 'set-name', 'name', esc(p.name || ''), 'Your name')}
    ${snum('Height', 'set-h', 'heightCm', p.heightCm || '', 'Add', 'cm')}
    ${snum('Goal weight', 'set-goal', 'goalW', p.goalW ? bw(p.goalW) : '', 'Not set', U())}
    ${srow('Units', `<div class="seg w140"><button class="${U() === 'kg' ? 'on' : ''}" data-a="unit" data-k="kg">kg</button><button class="${U() === 'lb' ? 'on' : ''}" data-a="unit" data-k="lb">lb</button></div>`)}
  </div></section>
  <section><div class="sgh">Goals</div><div class="sgrp">
    ${snum('Daily steps', 'set-steps', 'stepGoal', p.stepGoal, '10000')}
    ${snum('Workouts per week', 'set-week', 'weeklyTarget', p.weeklyTarget, '4')}
  </div></section>
  <section><div class="sgh">Workouts</div><div class="sgrp">
    <label class="xr"><span class="grow">Rest between sets<span class="s">For every exercise. Change one from its ⋯ menu in a workout</span></span><select class="xr-in" id="set-rest" data-in="prof" data-f="defaultRest">${[60, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600].concat(REST_OPTS_X(p.defaultRest)).sort((a, b) => a - b).map(v => `<option value="${v}" ${v === (p.defaultRest || 300) ? 'selected' : ''}>${clock(v)}</option>`).join('')}</select></label>
    ${srow("Today's targets", swi(on('noTargets'), 'pset', 'data-f="noTargets"'), 'Top of your rep range last time adds weight, otherwise one more rep')}
    ${repRangeRow()}
    ${srow('Log how hard sets felt (RPE)', swi(!!p.rpe, 'pset', 'data-f="rpe"'), 'Tap 6 to 10 after each working set')}
    ${srow('Start rest after each set', swi(on('noAutoRest'), 'pset', 'data-f="noAutoRest"'))}
    ${HOSTED ? srow('Notify when rest ends', swi(!!p.restPush && pushReady(), 'restPush'), pushReady() ? 'A notification when the timer ends, even with your phone locked' : 'Add Job’s Done to your Home Screen first, then turn this on') : ''}
    ${srow('Keep screen awake', swi(on('noWake'), 'pset', 'data-f="noWake"'), 'While a workout is open')}
    ${srow('Confetti', swi(on('noConfetti'), 'pset', 'data-f="noConfetti"'), 'For PRs and finished workouts')}
    ${slink('Plate loader', 'plates')}
    ${slink('My exercises and muscle groups', 'myEx')}
  </div></section>
  <section><div class="sgh">Reminders</div><div class="sgrp">
    ${srow('Morning weigh-in pop-up', swi(on('noWeighPrompt'), 'pset', 'data-f="noWeighPrompt"'), 'Asks once a day until you log a weight')}
  </div></section>
  <section><div class="sgh">Sounds</div><div class="sgrp">
    ${srow('Sounds', swi(p.sound !== false, 'soundToggle'))}
    ${slink('Play a test sound', 'soundTest', 'act')}
  </div><div class="sgf">Sounds play over your music and never pause it. No sound? Your iPhone is on silent: flip the switch on the side (or turn off Silent Mode in Control Centre) to hear them. iPhone doesn’t let websites play sounds on silent without pausing your music.</div></section>
  <section><div class="sgh">App</div><div class="sgrp">
    ${slink(isStandalone() ? 'Home Screen app: installed' : 'Add Job’s Done to your Home Screen', 'a2hs')}
  </div></section>
  <section><div class="sgh">Theme</div><div class="sgrp pad">
    <div class="themes">${THEMES.map(t => `<button class="theme-opt ${theme() === t.k ? 'on' : ''}" data-a="theme" data-k="${t.k}"><i style="background:${t.sw}"></i>${t.name}</button>`).join('')}</div>
  </div></section>
  <section><div class="sgh">${p.stepSrc ? 'Steps from ' + esc(p.stepSrc) : 'Steps from Apple Health'}</div><div class="sgrp">
    ${HOSTED && USER ? `<p class="xr-p">${p.stepSrc ? esc(p.stepSrc) + ' sends your steps to Apple Health' : 'Your iPhone (and any watch that syncs to it) counts steps in Apple Health'}, and an evening Apple Shortcut sends them on to Job’s Done. It needs a sync key, made once here. On Android, add steps by hand below.</p>
    ${slink('Create sync key', 'syncKey', 'act')}
    <details class="xr-d"><summary class="xr act"><span class="grow">Set up the evening Shortcut</span></summary>
      <ol class="f15 m0 sec xr-ol">
        <li>Make a sync key above and copy it.</li>
        <li>Open Shortcuts, tap +, and name it “${SC_NAME()}”.</li>
        <li>Add <b>Find Health Samples</b>: Type is Steps, Start Date is in the last 3 days, Group By Day.</li>
        <li>Add <b>Repeat with Each</b>. Inside it, add <b>Text</b> containing the item’s Start Date (format: Custom, <span class="num">yyyy-MM-dd</span>), a space, then the item’s Value.</li>
        <li>After the repeat, add <b>Combine Text</b> with New Lines.</li>
        <li>Add <b>Get Contents of URL</b> with the address shown with your key. Method POST. Header <b>Authorization</b> = <span class="num">Bearer</span>, a space, then your key. Request Body JSON with one Text field <b>text</b> set to Combined Text.</li>
        <li>Optional: add <b>Show Notification</b> with Contents of URL, so you see “Saved…”.</li>
        <li>Run it once. Then in the Automation tab add a daily Time of Day automation at 9:30 PM, set to Run Immediately, that runs “${SC_NAME()}”.</li>
      </ol></details>` : `<p class="xr-p">Your steps are in Apple Health. Type them on Today, or paste them here. Sign in on the Job’s Done website to have a Shortcut send them every evening.</p>`}
    ${slink('Add or paste steps by hand', 'steps', 'act')}
  </div></section>
  ${HOSTED && USER ? `<section><div class="sgh">Account</div><div class="sgrp">
    ${srow('Signed in as', `<span class="xr-v">${esc(USER.email || 'your account')}</span>`)}
    ${slink('Change password', 'setPassword')}
    ${slink(`Two-step sign-in${MFA_ON ? ' · On' : ''}`, 'mfa')}
    ${slink(DEMO ? 'Leave the demo' : 'Sign out', 'signOut', 'acc')}
  </div></section>` : ''}
  <section><div class="sgh">Your data</div><div class="sgrp">
    <label class="xr" for="csv-file"><span class="grow">Import workouts from CSV</span>${I.right}</label><input type="file" id="csv-file" accept=".csv,text/csv" data-in="csvFile" hidden>
    <label class="xr" for="bk-file"><span class="grow">Restore from a backup</span>${I.right}</label><input type="file" id="bk-file" accept=".json,application/json" data-in="bkFile" hidden>
    ${slink('Export backup (JSON)', 'export', '', 'data-k="json"')}
    ${slink('Export spreadsheet (CSV)', 'export', '', 'data-k="csv"')}
    ${slink('Erase all data', 'reset', 'danger')}
  </div><div class="sgf">${pend().size && mode === 'cloud' && syncState === 'offline' ? `${pend().size} change${pend().size > 1 ? 's' : ''} saved on this phone, waiting for signal to sync. ` : ''}${HOSTED ? (mode === 'cloud' ? 'Saved to your Job’s Done account. Sign in on any device and your log is there.' : 'Not signed in. Changes are kept on this device until you sign in.') : mode === 'cloud' ? 'Saved to your Claude account. Open this same link on any device signed in as you and your log is there.' : 'Saved in this browser only. Sign in to Claude and open the link there to keep it in your account.'}</div></section>
  <section><div class="sgh">About</div><div class="sgrp">
    ${slink('Send feedback or report a bug', 'feedback')}
    ${p.owner && HOSTED && USER ? slink('Feedback inbox', 'fbInbox') : ''}
    <a class="xr" href="privacy.html" target="_blank" rel="noopener"><span class="grow">Privacy Policy</span>${I.right}</a>
    <a class="xr" href="terms.html" target="_blank" rel="noopener"><span class="grow">Terms of Use</span>${I.right}</a>
    ${HOSTED && USER ? slink('Delete account', 'delAccount', 'danger') : ''}
  </div></section>
  <p class="tc cap">Job’s Done early beta · Oct 2026</p>
</div>`;
}

// ---------- active workout ----------
// Today's target for a set, from the same set last time, using the rep tiers:
// Reaching the top of your rep range means add weight (aim for the bottom), anything less means same weight, one more rep.
// Rep range is optional (Job, 16 Oct): without one it's 6 to 9, the original tiers.
const repRange = () => { const r = S.profile.repRange; return r && r[0] && r[1] > r[0] ? r : [6, 9]; };
const TGT_UP = () => U() === 'lb' ? 5 / LB : 2.5;
function targetOf(p) {
  if (!p || p.w == null || p.r == null || p.t === 'warm' || S.profile.noTargets) return p ? { w: p.w, r: p.r } : null;
  const [lo, hi] = repRange();
  if (p.r >= hi) return { w: Math.round((p.w + TGT_UP()) * 1000) / 1000, r: lo, up: true };
  return { w: p.w, r: p.r + 1 };
}
function newExEntry(name, nSets, rest, tip) {
  const last = lastSession(name);
  const src = last ? last.sets : [];
  const n = Math.max(nSets || 0, src.length) || 2;
  const sets = [];
  for (let i = 0; i < n; i++) {
    const p = src[i] || src[src.length - 1], t = targetOf(p);
    sets.push({ w: t ? t.w : null, r: t ? t.r : null, t: p && p.t === 'warm' ? 'warm' : 'work', done: false, ...(t && (t.up || t.r !== p.r) ? { tg: 1 } : {}) });
  }
  return { name, rest: rest || S.profile.defaultRest, tip: tip || '', note: '', sets, key: uid() };
}
function startWorkout(splitId, date) {
  if (A) { openWk(); return; }
  const sp = splitId ? splitById(splitId) : null;
  A = { id: uid(), splitId: sp ? sp.id : null, splitName: sp ? sp.name : 'Workout', start: Date.now(), touched: Date.now(), ex: sp ? sp.ex.map(e => newExEntry(e.name, e.sets, e.rest, e.note)) : [], orig: sp ? sp.ex.map(e => e.name) : [], view: 'log' };
  if (date && date !== today()) A.date = date;
  persist('jd/active'); openWk();
  if (!sp) pickExercise(name => { A.ex.push(newExEntry(name)); touchA(); });
}
// Tap a day: open what was logged that day, or log a workout for it.
function openDay(d) {
  const t = today();
  if (d && d > t) { toast('That day hasn’t happened yet'); return; }
  const wk = d ? Object.values(S.workouts).filter(w => w.date === d && !w.skipped) : [];
  if (wk.length === 1) { go({ v: 'workout', id: wk[0].id }); return; }
  d = d || addDays(t, -1);
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Log or edit a day</div>
    <input class="input" type="date" id="dy-date" value="${d}" max="${t}">
    <div id="dy-list"></div></div>`, { label: 'Pick a day', mount: b => {
    const list = () => {
      const v = b.querySelector('#dy-date').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      const ws = Object.values(S.workouts).filter(w => w.date === v && !w.skipped);
      b.querySelector('#dy-list').innerHTML = `<div class="g3 stack">
        ${ws.length ? `<div class="cap">Logged on ${esc(relDay(v))}</div>` + ws.map(w => `<button class="btn block" data-dw="${w.id}">Edit ${esc(w.splitName)}</button>`).join('') : `<div class="cap">Nothing logged ${v === t ? 'today' : 'on ' + esc(fmtDate(v, { wd: true }))} yet.</div>`}
        ${A ? `<div class="cap">Finish or discard the workout in progress to log another one.</div>` : S.splits.map(sp => `<button class="btn ${ws.length ? '' : 'primary'} block" data-ds="${sp.id}">Log ${esc(sp.name)} for ${esc(relDay(v))}</button>`).join('') + `<button class="btn ghost block" data-ds="">Log an empty workout</button>`}</div>`;
    };
    b.querySelector('#dy-date').onchange = list; list();
    b.onclick = ev => {
      const w = ev.target.closest('[data-dw]'), s2 = ev.target.closest('[data-ds]');
      if (w) { closeSheet(sh); go({ v: 'workout', id: w.dataset.dw }); }
      else if (s2) { const v = b.querySelector('#dy-date').value; closeSheet(sh); startWorkout(s2.dataset.ds || null, v); }
    };
  } });
}
// Change which day the workout in progress counts for.
function openWkDay() {
  const t = today(), cur = A.date || t;
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Which day is this workout for?</div>
    <div class="seg"><button data-dd="${t}" class="${cur === t ? 'on' : ''}">Today</button><button data-dd="${addDays(t, -1)}" class="${cur === addDays(t, -1) ? 'on' : ''}">Yesterday</button><button data-dd="${addDays(t, -2)}" class="${cur === addDays(t, -2) ? 'on' : ''}">2 days ago</button></div>
    <input class="input" type="date" id="wd-date" value="${cur}" max="${t}">
    <button class="btn primary block" id="wd-ok">Done</button></div>`, { label: 'Workout day', mount: b => {
    const set = v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > t) return; if (v === t) delete A.date; else A.date = v; touchA(); };
    b.querySelectorAll('[data-dd]').forEach(x => x.onclick = () => { set(x.dataset.dd); closeSheet(sh); });
    b.querySelector('#wd-ok').onclick = () => { set(b.querySelector('#wd-date').value); closeSheet(sh); };
  } });
}
function touchA() { A.touched = Date.now(); persist('jd/active'); renderWorkout(); }
let wakeLock = null;
async function openWk() {
  A.open = true; renderWorkout();
  try { if (navigator.wakeLock && !wakeLock && !S.profile.noWake) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
}
function minimizeWk() { if (A) A.open = false; if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } render(); }
function ghostVol() {
  if (!A || !A.splitId) return 0;
  const sp = splitById(A.splitId); const l = sp && lastOfSplit(sp); return l ? wVol(l) : 0;
}
const doneVol = () => A.ex.reduce((a, e) => a + exVol(e.sets.filter(s => s.done)), 0);
function livePR(e) {
  const b = clone(ix().best[e.name] || emptyBest()); const out = [];
  for (const s of e.sets) { if (!s.done) { out.push([]); continue; } out.push(prTypes(s, b)); applyBest(s, b); }
  return out;
}
function renderWorkout() {
  syncRestPush();
  const el = $('#wk'); if (!el) return;
  if (!A || !A.open) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  if (A.view === 'summary') { el.innerHTML = summaryHTML(); return; }
  const body = el.querySelector('.wk-body'); const keep = body ? body.scrollTop : 0;
  const gv = ghostVol(), dv = doneVol(), totalSets = A.ex.reduce((a, e) => a + e.sets.length, 0), doneSets = A.ex.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const scale = Math.max(gv, dv, 1);
  el.innerHTML = `<div class="wk-head"><div class="row between"><button class="icon-btn" data-a="minWk" aria-label="Minimise workout">${I.down}</button>
      <div class="tc grow"><div class="wkname">${esc(A.splitName)}</div>${A.date ? `<button class="cap daychip" data-a="wkDay">${esc(fmtDate(A.date, { wd: true }))} ▾</button>` : `<div class="cap num">Started ${hm(A.start)} · <span data-elapsed>${fmtDur(Date.now() - A.start)}</span> · <button class="cap daychip" data-a="wkDay">Today ▾</button></div>`}</div>
      <button class="btn sm primary" data-a="finish">Finish</button></div>
    <div class="mt2 f13 row between"><span class="sec"><b class="c-text num">${dvol(dv)}</b> ${U()} lifted</span><span class="sec"><b class="c-text num">${doneSets}</b> / ${plural(totalSets, 'set')}</span>${gv ? `<span class="${dv >= gv ? 'pos' : 'sec'}">${dv >= gv ? 'Past last time' : dvol(gv - dv) + ' ' + U() + ' to match last time'}</span>` : ''}</div>
    ${gv ? `<div class="race" aria-hidden="true"><i class="ghost" style="width:${gv / scale * 100}%"></i><i class="me ${dv >= gv ? 'ahead' : ''}" style="width:${dv / scale * 100}%"></i></div>` : ''}
  </div>
  <div class="wk-body">${A.ex.map(exCardHTML).join('')}
    <button class="btn block" data-a="wkAddEx">Add exercise</button>
    <button class="self-c c-neg link" data-a="wkDiscard">Discard workout</button>
  </div>
  ${REST ? restHTML() : ''}`;
  el.innerHTML = resolveVars(el.innerHTML);
  const nb = el.querySelector('.wk-body'); if (nb) nb.scrollTop = keep;
}
function exCardHTML(e, ei) {
  const last = lastSession(e.name);
  const prs = livePR(e);
  const sp = A.splitId && splitById(A.splitId); const tgt = sp && sp.ex.find(x => x.name === e.name);
  let sugg = '';
  if (last && !S.profile.noTargets) {
    const hi = repRange()[1], ws = last.sets.filter(validSet), up = ws.filter(x => x.r >= hi).length;
    if (ws.length) sugg = up ? `Target: add ${dw(TGT_UP())} ${U()} on ${up === ws.length ? 'every set' : up + ' set' + (up > 1 ? 's' : '')}, you hit ${hi}+ reps last time.` : 'Target: same weight, one more rep than last time.';
  }
  const dsets = e.sets.filter(s => s.done);
  const cmp = dsets.length && last ? `<div class="cmp"><span class="sec">vs last time ${infoBtn('volume')}</span><span>heaviest ${delta(topSet(dsets) ? topSet(dsets).w : null, last.top ? last.top.w : null, v => dw(v), ' ' + U())}</span><span>volume ${delta(exVol(dsets), exVol(last.sets.slice(0, dsets.length)), v => dvol(v), ' ' + U())}</span><span class="sec">(first ${plural(dsets.length, 'set')})</span></div>` : '';
  const side = sideOf(e.name), pair = side === 'L' ? A.ex[ei + 1] : side === 'R' ? A.ex[ei - 1] : null;
  const uni = pair && baseName(pair.name) === baseName(e.name) && sideOf(pair.name) === (side === 'L' ? 'R' : 'L') ? side : '';
  // Fold a finished exercise down to one line (Job, 19 Oct); the chevron opens it again
  const allDone = e.sets.length && e.sets.every(x => x.done), asking = A.rpeAsk && A.rpeAsk[0] === ei;
  const fold = e.fold === true || (allDone && e.fold !== false);
  const foldBtn = `<button class="icon-btn fold-btn ${fold ? 'shut' : ''}" data-a="foldEx" data-e="${ei}" aria-label="${fold ? 'Show sets' : 'Hide sets'}" aria-expanded="${!fold}">${I.down}</button>`;
  return `<section class="card tight ${uni ? 'uni uni-' + uni.toLowerCase() : ''} ${fold ? 'folded' : ''}" id="ex-${ei}" aria-label="${esc(e.name)}">
    ${uni === 'R' ? '' : `<div class="row between"><div class="grow"><div class="ex-name">${esc(uni ? baseName(e.name) : e.name)}</div>${uni ? '<div class="cap">One side at a time</div>' : ''}`}${uni === 'R' ? `<div class="row between"><div class="grow"><div class="uni-lbl">Right</div>` : ''}${e.tip ? `<div class="cap">${esc(e.tip)}</div>` : ''}${uni === 'L' ? '<div class="uni-lbl">Left</div>' : ''}</div>${foldBtn}<button class="icon-btn" data-a="swapEx" data-e="${ei}" aria-label="Swap ${esc(e.name)}">${I.swap}</button><button class="icon-btn" data-a="exMenu" data-e="${ei}" aria-label="Options for ${esc(e.name)}">${I.more}</button></div>
    ${fold ? `<button class="fold-sum" data-a="foldEx" data-e="${ei}"><span class="fold-ck">${I.check}</span><span class="grow">${dsets.length === e.sets.length ? 'Done' : plural(dsets.length, 'set') + ' done'} · ${e.sets.filter(x => x.done && x.t !== 'warm').map(setStr).join(', ') || plural(e.sets.length, 'set')}</span><span class="sec">Show</span></button>${asking && S.profile.rpe ? (() => { const si = A.rpeAsk[1], st = e.sets[si]; return st ? `<div class="rpe mt2"><span class="cap">How hard? ${infoBtn('rpe')}</span>${[6, 7, 8, 9, 10].map(n => `<button class="${st.rpe === n ? 'on' : ''}" data-a="rpe" data-e="${ei}" data-s="${si}" data-k="${n}">${n}</button>`).join('')}</div>` : ''; })() : ''}${cmp}` : `
    ${setupHTML(e.name)}${(() => { const pl = plateaus().find(x => baseName(x.name) === baseName(e.name)); return pl ? `<div class="pl-line">No new best in ${plural(pl.weeks, 'week')}. ${esc(plateauTip(pl))}</div>` : ''; })()}${sugg ? `<div class="tgt-line">${esc(sugg.replace(/\s+\S+$/, ''))} <span class="nw">${esc((sugg.match(/\S+$/) || [''])[0])} ${infoBtn('target')}</span></div>` : ''}
    ${e.note ? `<div class="it cap">${esc(e.note)}</div>` : ''}${e.ss && A.ex[ei + 1] ? `<div class="ss-line">Superset with ${esc(baseName(A.ex[ei + 1].name))} ${infoBtn('ss')}</div>` : ''}${ei && A.ex[ei - 1].ss ? `<div class="ss-line">Superset with ${esc(baseName(A.ex[ei - 1].name))}. Rest starts after this one</div>` : ''}
    <table class="mt2 sets"><thead><tr><th>Set</th><th>Previous</th><th>${U()}</th><th>Reps</th><th><span class="sr" style="position:absolute;left:-9999px">Done</span></th></tr></thead><tbody>
    ${e.sets.map((s, si) => { const lw = last && last.sets.filter(x => x.t !== 'warm'), pv = s.t === 'warm' ? (last && last.sets.filter(x => x.t === 'warm')[e.sets.slice(0, si).filter(x => x.t === 'warm').length]) : lw && lw[si - e.sets.slice(0, si).filter(x => x.t === 'warm').length]; const pr = prs[si] || []; const lbl = s.t === 'warm' ? 'W' : s.t === 'drop' ? 'D' : s.t === 'fail' ? 'F' : si + 1 - e.sets.slice(0, si).filter(x => x.t === 'warm').length; return `<tr class="${s.done ? 'done' : ''}" id="row-${ei}-${si}">
      <td><button class="setno ${s.t}" data-a="setType" data-e="${ei}" data-s="${si}" aria-label="Set ${si + 1}, ${s.t === 'work' ? 'working' : s.t === 'warm' ? 'warm-up' : s.t === 'drop' ? 'drop' : 'failure'} set. Tap to change type">${lbl}</button></td>
      <td class="prev">${pv ? setStr(pv) : '—'}${pr.length ? ' <span class="pill pr" title="' + esc(pr.join(', ')) + '">PR</span>' : ''}</td>
      <td><button class="cell ${s.ed || s.done ? 'edited' : ''} ${s.tg && !s.ed && !s.done ? 'tgt' : ''}" data-a="key" data-e="${ei}" data-s="${si}" data-f="w" aria-label="Weight">${s.w == null ? '–' : dw(s.w)}</button></td>
      <td><button class="cell ${s.ed || s.done ? 'edited' : ''} ${s.tg && !s.ed && !s.done ? 'tgt' : ''}" data-a="key" data-e="${ei}" data-s="${si}" data-f="r" aria-label="Reps">${s.r == null ? '–' : s.r}${s.rpe ? `<small class="rpe-v">@${s.rpe}</small>` : ''}</button></td>
      <td><button class="check" data-a="done" data-e="${ei}" data-s="${si}" aria-label="${s.done ? 'Undo set' : 'Log set'}" aria-pressed="${s.done}">${I.check}</button></td></tr>${S.profile.rpe && s.done && s.t !== 'warm' && A.rpeAsk && A.rpeAsk[0] === ei && A.rpeAsk[1] === si ? `<tr class="rpe-row"><td colspan="5"><div class="rpe"><span class="cap">How hard? ${infoBtn('rpe')}</span>${[6, 7, 8, 9, 10].map(n => `<button class="${s.rpe === n ? 'on' : ''}" data-a="rpe" data-e="${ei}" data-s="${si}" data-k="${n}">${n}</button>`).join('')}</div></td></tr>` : ''}`; }).join('')}
    </tbody></table>
    <div class="mt2 row between"><button class="btn sm ghost" data-a="addSet" data-e="${ei}">Add set</button>${e.sets.length > 1 ? `<button class="btn sm ghost sec" data-a="rmSet" data-e="${ei}">Remove set</button>` : ''}</div>
    ${cmp}`}
  </section>`;
}
function restLeft() { return REST ? Math.max(0, REST.paused ? REST.left : (REST.end - Date.now()) / 1000) : 0; }
function restHTML() {
  const left = restLeft(), p = 1 - left / REST.total;
  if (REST.min) return `<button class="restpill" data-a="restOpen" aria-label="Show rest timer"><span class="hg-mini">${hourglass(p, REST.paused)}</span><span class="t" data-rest>${clock(left)}</span><span class="rp-end" data-rest-end2>${REST.paused ? '' : hm(Date.now() + left * 1000)}</span></button>`;
  return `<div class="restpop ${REST.paused ? 'paused' : ''}" role="timer" aria-label="Rest timer">
    <div class="row between"><span class="eyebrow">${REST.paused ? 'Paused' : 'Rest'}</span><button class="icon-btn" data-a="restMin" aria-label="Shrink rest timer">${I.down}</button></div>
    <div class="hg" data-hg style="--p:${p.toFixed(4)}">${hourglass(p, REST.paused)}</div>
    <div class="t" data-rest>${clock(left)}</div>
    <div class="tc cap rest-end" data-rest-end>${REST.paused ? 'Paused' : 'Next set at ' + hm(Date.now() + left * 1000)}</div>
    <div class="g2 row" style="justify-content:center"><button class="btn sm" data-a="rest" data-d="-30">−30s</button><button class="btn sm primary" data-a="restPause">${REST.paused ? 'Resume' : 'Pause'}</button><button class="btn sm" data-a="rest" data-d="30">+30s</button></div>
    <button class="self-c link" data-a="rest" data-d="0">Skip rest</button>
  </div>`;
}
// Sand drains from the top bulb into the bottom one as the rest runs out.
function hourglass(p, paused) {
  const top = 46 * (1 - p), bot = 46 * p;
  return `<svg viewBox="0 0 80 120" aria-hidden="true"><defs><clipPath id="hgT"><path d="M14 12h52c0 22-18 32-24 46h-4C32 44 14 34 14 12z"/></clipPath><clipPath id="hgB"><path d="M38 62h4c6 14 24 24 24 46H14c0-22 18-32 24-46z"/></clipPath></defs>
    <rect x="8" y="4" width="64" height="8" rx="4" class="hg-cap"/><rect x="8" y="108" width="64" height="8" rx="4" class="hg-cap"/>
    <path d="M14 12h52c0 22-18 32-24 48 6 16 24 26 24 48H14c0-22 18-32 24-48C32 44 14 34 14 12z" class="hg-glass"/>
    <rect x="10" y="${(58 - top).toFixed(1)}" width="60" height="${top.toFixed(1)}" clip-path="url(#hgT)" class="hg-sand"/>
    <rect x="10" y="${(108 - bot).toFixed(1)}" width="60" height="${bot.toFixed(1)}" clip-path="url(#hgB)" class="hg-sand"/>
    ${p < 1 && !paused ? '<line x1="40" y1="58" x2="40" y2="106" class="hg-stream"/>' : ''}</svg>`;
}
// Short synth sounds (no files). Cheers play even on silent and briefly duck music; dial clicks follow the silent switch.
// Sounds are synthesised once into small WAV files and played through <audio> elements, which iPhones play
// reliably after the first tap (and with the silent switch on). 'transient' asks iOS to lower music, not stop it.
// Sound, the same way Jedris does it (Job: "there were sounds then"): one Web Audio context,
// unlocked and resumed inside every tap, master gain, synthesized notes. Plays only when running.
const SOUND_VOL = 1.2;
const Sound = {
  ctx: null, master: null,
  unlock() {
    // Exactly what Jedris does (Job's music keeps playing there): one Web Audio context, created and
    // resumed from a tap, and no audio session or <audio> element at all. iPhone mixes Web Audio over music.
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = SOUND_VOL;
      // 20% louder (Job, 19 Oct), through a gentle limiter so peaks never get harsh
      const lim = this.ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .15;
      this.master.connect(lim).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') this.ctx.resume();
  },
  // Only for Me → Sounds → "Play when on silent", and only when a sound actually plays: a 'playback'
  // session plus a silent clip moves sounds onto the media channel, which pauses music apps.
  silentMode() {
    if (!(S && S.profile && S.profile.soundSilent)) return;
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') try { navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!this.media) try {
      const n = 800, b = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
      b.setUint32(24, 8000, true); b.setUint32(28, 16000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
      this.media = new Audio(URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }))); this.media.setAttribute('playsinline', '');
      const pr = this.media.play(); if (pr && pr.catch) pr.catch(() => { this.media = null; });
    } catch (e) { this.media = null; }
  },
  tone(freq, dur, type = 'sine', vol = .1, delay = 0) {
    const c = this.ctx, t0 = c.currentTime + delay, osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    osc.connect(g).connect(this.master); osc.start(t0); osc.stop(t0 + dur + .02);
  },
};
let sfxLast = null;
['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => Sound.unlock(), { passive: true, capture: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden && Sound.ctx) Sound.ctx.resume(); });
function tones(notes, type = 'sine', vol = .22) {
  if (S && S.profile && S.profile.sound === false) return;
  if (type === 'tick') type = 'sine';
  if (!Sound.ctx) Sound.unlock();
  Sound.silentMode();
  if (!Sound.ctx) { sfxLast = { name: 'no Web Audio' }; return; }
  const go = () => { Sound.master.gain.value = SOUND_VOL; for (const [f, at, len = .18] of notes) Sound.tone(f, len, type, vol * .6, at); };
  if (Sound.ctx.state === 'running') { go(); return; }
  return Sound.ctx.resume().then(() => { if (Sound.ctx.state === 'running') go(); else sfxLast = { name: 'audio ' + Sound.ctx.state }; }, e => { sfxLast = e; });
}
const SOUNDS = {
  low: () => tones([[392, 0, .22], [330, .16, .3]], 'triangle', .18),
  nice: () => tones([[659, 0, .2], [880, .1, .3]]),
  great: () => tones([[523, 0], [659, .09], [784, .18, .35]], 'triangle'),
  amazing: () => tones([[523, 0], [659, .08], [784, .16], [1047, .26, .5], [1319, .26, .5]], 'triangle', .2),
  next: () => tones([[784, 0, .12], [988, .1, .12], [1175, .2, .12], [1568, .3, .45]], 'square', .08),
  tick: () => tones([[1800, 0, .025]], 'tick', .05),
  rest: () => tones([[880, 0, .15], [880, .2, .15], [1175, .42, .4]]),
  clank: (big = 1, delay = 0) => clank(big, delay),
};
// A plate sliding on and smacking into the one already on the bar: a sharp noise hit, a low thud and
// a few clashing metal partials that ring out briefly. Heavier plates sound lower (Job, 15 Oct).
function clank(big = 1, delay = 0) {
  if (S && S.profile && S.profile.sound === false) return;
  if (!Sound.ctx) Sound.unlock(); if (!Sound.ctx || Sound.ctx.state !== 'running') { if (Sound.ctx) Sound.ctx.resume(); return; }
  const c = Sound.ctx, lo = 1 - Math.min(1, Math.max(0, big)) * .3, out = c.createGain();
  out.gain.value = 1; out.connect(Sound.master); Sound.master.gain.value = SOUND_VOL;
  // Tuned to Job's clip of plates clanking (15 Oct): a ringing iron clang with resonances near 760, 1345,
  // 2250 and 2745 Hz that rings out for about a third of a second, a soft low knock, and sometimes a small rebound.
  const hit = (t, v) => {
    const n = c.createBuffer(1, c.sampleRate * .03, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 5);
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
    src.buffer = n; bp.type = 'bandpass'; bp.frequency.value = 2600 * lo; bp.Q.value = 1.2; ng.gain.value = .8 * v; src.connect(bp).connect(ng).connect(out); src.start(t);
    const th = c.createOscillator(), tg = c.createGain(); th.type = 'sine'; th.frequency.setValueAtTime(250 * lo, t); th.frequency.exponentialRampToValueAtTime(120, t + .08);
    tg.gain.setValueAtTime(.12 * v, t); tg.gain.exponentialRampToValueAtTime(.0001, t + .1); th.connect(tg).connect(out); th.start(t); th.stop(t + .12);
    [[760, .09, .7], [1345, .15, .65], [2250, .17, .5], [2745, .2, .45], [3620, .1, .28], [5100, .06, .14]].forEach(([f, g0, len]) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * lo * (1 + (Math.random() - .5) * .012);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0 * v, t + .0015); g.gain.exponentialRampToValueAtTime(.0001, t + len * (.75 + big * .35));
      o.connect(g).connect(out); o.start(t); o.stop(t + len * 1.15 + .02);
    });
  };
  const t = c.currentTime + delay; hit(t, 1); if (Math.random() < .5) hit(t + .2 + Math.random() * .08, .3);
}
// What a finished set says, by reps.

// Plain-English meanings for the numbers the app shows. Opened from the small (i) buttons.
const GLOSSARY = [
  ['rpe', 'RPE (how hard a set felt)', 'A 6 to 10 score after a set. 10 means you could not have done another rep, 9 means one more was left, 8 means two were left, and 6 or 7 felt fairly easy. Most working sets land around 7 to 9. Turn it on or off in Me.'],
  ['ss', 'Superset', 'Two exercises done back to back. Rest starts after the second one, then you go back to the first. It saves time and works well for pairs like curls and pushdowns.'],
  ['e1rm', 'e1RM (estimated one-rep max)', 'The most you could likely lift for a single rep, worked out from a set you did. 80 kg for 8 reps works out to about 100 kg. It lets sets with different reps be compared fairly.'],
  ['volume', 'Volume', 'Weight × reps, added up across sets. 3 sets of 10 at 50 kg is 1,500 kg. Warm-up sets don’t count.'],
  ['pr', 'PRs (personal records)', 'You get at most one PR per exercise per workout, and left and right sides count as one lift. Heaviest: more weight than ever before. e1RM: your strongest set ever once reps are taken into account. Reps: more reps than ever at a weight you’ve lifted before.'],
  ['target', 'Today’s target', 'If you reached the top of your rep range last time, the target adds a small weight jump and aims for the bottom of the range. Otherwise it keeps the weight and asks for one more rep. Without a rep range set in Me, that’s 6 to 9 reps. You can turn targets off in Me too.'],
  ['plateau', 'Plateau alert', 'A lift that hasn’t set a record of any kind for 3 to 12 weeks across at least 3 sessions. A lighter week or a new rep range usually gets it moving again.'],
  ['muscle', 'Sets per muscle', 'Working sets this week for each muscle, with the grey marker showing your 4-week average. Left and right sides of one exercise count as half a set each, which is why you can see 3.5.'],
  ['strength', 'Weight vs strength', 'Both lines start at 100% in the same week. Strength is the middle value of your e1RMs across lifts. If weight falls while strength holds, you are losing fat and keeping muscle.'],
  ['rotation', 'Rotation and Next up', 'Your splits in the order you train them. Next up is the split after the last one you did, so if you skip a day nothing gets out of order. Change the order in Splits → Rotation.'],
  ['estimated', 'Estimated weigh-ins', 'Weights filled in from your starting numbers, not actually weighed. They show as hollow points and never count toward badges.'],
];
function openGlossary(focus) {
  const sh = openSheet(`<div class="stack"><div class="eyebrow">What the numbers mean</div><div class="gl">${GLOSSARY.map(([k, t, d]) => `<div class="gl-i ${k === focus ? 'on' : ''}" id="gl-${k}"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div><button class="btn block" data-a="closeSheet">Done</button></div>`, { label: 'What the numbers mean' });
  const el = sh.el.querySelector('#gl-' + focus); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 250);
}
const infoBtn = k => `<button class="info" data-a="glossary" data-k="${k}" aria-label="What does this mean?" title="What does this mean?">i</button>`;
// Set messages: the title speaks the theme's language, the subtitle keeps the coaching (same tiers Job set).
const THEME_MSG = {
  cliffs: {
    low: ['Loose rock', 'Steep pitch', 'Find your footing'], nice: ['Steady climb', 'On the trail', 'Good ground'],
    great: ['Above the treeline', 'Ridge in sight', 'Strong ascent'], amazing: ['Summit', 'Top of the ridge', 'Peak reached'],
    done: { day: ['Summit reached.', 'That ridge is behind you.', 'Clear skies, solid work.'], sunrise: ['First light, first win.', 'You beat the sun up.'], sunset: ['Golden hour, earned.', 'Down the mountain before dark.'], night: ['Night climb, done.', 'Stars out, work in.'] },
    part: ['Turned back early. The mountain stays put.', 'A short hike still counts.'],
  },
  climb: {
    low: ['Pumped out', 'Off the wall', 'Rework the beta'], nice: ['Clean move', 'On route', 'Good beta'],
    great: ['Crushed the crux', 'Sticking it', 'Strong grip'], amazing: ['Flashed it', 'Sent!', 'Top out'],
    done: ['Route sent.', 'Chalked up and topped out.', 'That project is yours.', 'Clipped the chains.'],
    part: ['Came off early. Back on the wall next time.', 'Not a send yet. Every attempt counts.'],
  },
  mono: {
    low: ['Missed the mark', 'Abort and regroup', 'Too much heat'], nice: ['Clean work', 'On target', 'Smooth operator'],
    great: ['Target down', 'Licensed to lift', 'Shaken, not stirred'], amazing: ['Contract complete', 'Silent and deadly', 'Flawless execution'],
    done: ['Contract complete.', 'Target down. Suit unwrinkled.', 'Clean exit. No witnesses.', 'Mission accomplished. Martini earned.'],
    part: ['Mission cut short. There’s always another contract.', 'Partial job. The client will understand.'],
  },
  spidey: {
    low: ['Lost your grip', 'Missed the swing', 'Steady on the wall'], nice: ['Web holds', 'Clean swing', 'Looking out'],
    great: ['Sense tingling', 'Swinging high', 'City’s safe'], amazing: ['Saved the day', 'Top of the tower', 'Spectacular'],
    done: ['City’s safe tonight.', 'Another night, another save.', 'Web-slung and done.', 'Your friendly neighbourhood lifter.'],
    part: ['Called away early. The city understands.', 'Short patrol, still counts.'],
  },
};
const pick = a => a[Math.floor(Math.random() * a.length)];
// Week-dot letters that never repeat: Push and Pull become Ps and Pl, so colour isn't the only clue.
function splitTag(name) {
  const names = [...new Set(S.splits.map(x => x.name).concat(name))].filter(Boolean);
  const cands = n => { const l = n.replace(/[^A-Za-z0-9]/g, ''); return l ? [l[0].toUpperCase(), ...[...l.slice(1)].map(c => l[0].toUpperCase() + c.toLowerCase())] : ['?']; };
  const others = names.filter(n => n !== name).flatMap(cands);
  return cands(name).find(c => !others.includes(c)) || cands(name)[0];
}
// Gym manners after the last set of a lift, in the theme's voice (Job, 16 Oct). Re-rack only for plates and dumbbells.
const TIDY = {
  mono: { rack: ['A good agent leaves no trace. Wipe down and re-rack your weights.', 'No fingerprints, no loose plates. Wipe down and re-rack before you move out.', 'Clean exit, agent: weights back on the rack, everything wiped down.', 'The mission isn’t over until you’ve re-racked and wiped down.'],
    wipe: ['A good agent leaves no trace. Wipe down before you move out.', 'No fingerprints left behind. Wipe down, agent.', 'Clean exit, agent: wipe down, then secure the scene.', 'The mission isn’t over until you’ve wiped down.'] },
  spidey: { rack: ['Be a friendly neighbour: wipe down and re-rack the weights.', 'With great strength comes great responsibility. Re-rack your weights and wipe down.', 'Your friendly neighbourhood lifter puts the weights back. Re-rack and wipe down.', 'Even heroes clean up after a fight. Re-rack the weights and wipe down.'],
    wipe: ['Be a friendly neighbour and wipe down.', 'With great strength comes great responsibility. Wipe down.', 'Your friendly neighbourhood lifter leaves no sweat behind. Wipe down.', 'Even heroes clean up after a fight. Wipe down before you swing off.'] },
  cliffs: { rack: ['Leave no trace. Wipe down and re-rack the weights.', 'Pack it in, pack it out: weights back on the rack, everything wiped clean.', 'Leave the trail better than you found it. Re-rack and wipe down.', 'Good climbers clean up camp. Weights on the rack, everything wiped down.'],
    wipe: ['Leave no trace. Wipe down before you head on.', 'Pack it in, pack it out. Wipe down before you go.', 'Leave the trail better than you found it. Wipe down.', 'Good climbers clean up camp. Wipe down before the next ascent.'] },
  climb: { rack: ['Brush your holds: wipe down and re-rack the weights for the next climber.', 'Clean the route for the next send. Re-rack and wipe down.', 'Chalk off, weights back. Re-rack and wipe down.', 'Respect the wall: weights back on the rack, everything wiped clean.'],
    wipe: ['Brush your holds: wipe down for the next climber.', 'Clean the route for the next send. Wipe down.', 'Chalk off, sweat off. Wipe down.', 'Respect the wall: wipe down before you move on.'] },
};
const tidyLine = name => { const t = TIDY[theme()] || TIDY.cliffs; return pick(['barbell', 'dumbbell', 'smith', 'kettlebell'].includes(exInfo(name).equip) ? t.rack : t.wipe); };
const themeMsg = () => THEME_MSG[theme()] || THEME_MSG.cliffs;
function setVerdict(r) {
  const m = themeMsg();
  const [lo, hi] = repRange();
  if (r <= lo - 2) return { k: 'low', title: pick(m.low), sub: 'Drop the weight a little. Form first.', bits: 0 };
  if (r <= lo) return { k: 'nice', title: pick(m.nice), sub: 'Right in the range.', bits: 0 };
  if (r < hi) return { k: 'great', title: pick(m.great), sub: 'Nearly time to add weight.', bits: 0 };
  return { k: 'amazing', title: pick(m.amazing), sub: 'Add weight next time. You hit the top of your range.', bits: 40 };
}
// One line under "Job’s done!" in the theme's voice. Cliffs follows the time of day like its sky.
function doneLine(w) {
  const m = themeMsg();
  if (w && w.planned && wSets(w) < w.planned) return pick(m.part);
  if (Array.isArray(m.done)) return pick(m.done);
  const h = new Date(w && w.end || Date.now()).getHours();
  return pick(m.done[h >= 5 && h < 8 ? 'sunrise' : h >= 17 && h < 20 ? 'sunset' : h >= 20 || h < 5 ? 'night' : 'day']);
}
function celebrate(v, delay = 0) {
  setTimeout(() => {
    document.querySelectorAll('.cele').forEach(c => c.remove());
    const c = document.createElement('div'); c.className = 'cele cele-' + v.k; c.setAttribute('role', 'status'); if (v.ms) c.style.setProperty('--out', (v.ms - 600) + 'ms');
    c.innerHTML = `<b>${esc(v.title)}</b><span>${esc(v.sub)}</span>${v.note ? `<i>${esc(v.note)}</i>` : ''}`;
    c.onclick = () => c.remove(); // tap to close early
    document.body.appendChild(c); setTimeout(() => c.remove(), v.ms || 2200);
    if (v.bits) confetti(v.bits);
    (SOUNDS[v.k] || (() => {}))();
  }, delay);
}

function beep() { SOUNDS.rest(); }
function tick() {
  document.querySelectorAll('[data-elapsed]').forEach(n => { if (A) n.textContent = fmtDur(Date.now() - A.start); });
  if (REST) {
    const left = restLeft();
    if (left <= 0) { REST = null; SOUNDS.rest(); buzz([30, 60, 30]); toast('Rest done. Next set.'); renderWorkout(); return; }
    const t = $('[data-rest]'); if (t) t.textContent = clock(left);
    const re = $('[data-rest-end]'); if (re) re.textContent = REST.paused ? 'Paused' : 'Next set at ' + hm(Date.now() + left * 1000);
    const re2 = $('[data-rest-end2]'); if (re2) re2.textContent = REST.paused ? '' : hm(Date.now() + left * 1000);
    const hg = $('.restpop .hg, .restpill .hg-mini'); if (hg && !REST.paused) hg.innerHTML = hourglass(1 - left / REST.total, false);
  }
}
function logSet(ei, si) {
  const e = A.ex[ei], s = e.sets[si];
  s.done = !s.done; s.at = s.done ? Date.now() : null; if (s.done) delete A.endAt;
  if (s.done) {
    buzz(10);
    const pr = livePR(e)[si];
    const secs = restFor(e.name);
    const inSS = e.ss && A.ex[ei + 1];
    const left = A.ex.some(x => x.sets.some(y => !y.done)); // no rest after the very last set (Job, 19 Oct)
    if (!left) REST = null; else if (!S.profile.noAutoRest && !inSS) REST = { end: Date.now() + secs * 1000, total: secs, paused: false, min: false };
    A.rpeAsk = S.profile.rpe && s.t !== 'warm' ? [ei, si] : null;
    touchA();
    if (inSS) setTimeout(() => { if (!A) return; const el = $('#ex-' + (ei + 1)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 600);
    const row = $(`#row-${ei}-${si}`); if (row) row.classList.add('pop');
    if (s.t !== 'warm' && s.r > 0) {
      const v = setVerdict(s.r); celebrate(v);
      const work = e.sets.filter(x => x.t !== 'warm'), doneN = work.filter(x => x.done).length;
      if (doneN === work.length && work.length) {
        const nx = A.ex.slice(ei + 1).find(x => x.sets.some(y => !y.done)) || A.ex.find(x => x.sets.some(y => !y.done));
        celebrate({ k: 'next', title: 'Exercise done', sub: nx ? 'Next: ' + nx.name : 'Every set done. Finish when you’re ready.', note: tidyLine(e.name), bits: 0, ms: 7000 }, 1200);
        if (nx) setTimeout(() => { if (!A) return; const el = $('#ex-' + A.ex.indexOf(nx)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 1700);
      }
    }
    if (pr.length) { buzz([20, 40, 60]); confetti(); toast(`<span class="pill pr">PR</span> ${esc(e.name)}: ${esc(setStr(s))} · ${esc(pr.join(', '))}`); const r2 = $(`#row-${ei}-${si} .check`); if (r2) r2.classList.add('glow'); }
  } else touchA();
}
function summaryData() {
  const ex = A.ex.map(e => ({ ...e, sets: e.sets.filter(s => s.done).map(s => ({ w: s.w, r: s.r, t: s.t, ...(s.rpe ? { rpe: s.rpe } : {}) })), ...(e.ss ? { ss: 1 } : {}) })).filter(e => e.sets.length);
  const rows = ex.map(e => {
    const last = lastSession(e.name); const b = clone(ix().best[e.name] || emptyBest());
    const types = new Set(); e.sets.forEach(s => { prTypes(s, b).forEach(t => types.add(t)); applyBest(s, b); });
    return { e, last, top: topSet(e.sets), vol: exVol(e.sets), types: [...types] };
  });
  return { ex, rows, vol: rows.reduce((a, r) => a + r.vol, 0), sets: ex.reduce((a, e) => a + e.sets.length, 0), prs: rows.filter(r => r.types.length).length };
}
function summaryHTML() {
  const d = summaryData(); const sp = A.splitId && splitById(A.splitId);
  const changed = sp && JSON.stringify(A.ex.map(e => e.name)) !== JSON.stringify(sp.ex.map(e => e.name));
  return `<div class="wk-body" style="padding-top:calc(16px + env(safe-area-inset-top, 0px))">
    <button class="back" data-a="sumBack">${I.left}Back to workout</button>
    <div><div class="eyebrow">Workout complete</div><h1>${esc(A.splitName)}</h1><button class="mt2 cap daychip" data-a="wkDay">${A.date ? esc(fmtDate(A.date, { wd: true })) : 'Today'} ▾ change day</button></div>
    <div class="card"><div class="kpis" style="grid-template-columns:repeat(4,1fr)"><div class="kpi"><b>${fmtDur((A.endAt || Date.now()) - A.start)}</b><span>time</span></div><div class="kpi"><b>${dvol(d.vol)}</b><span>${U()} volume</span></div><div class="kpi"><b>${d.sets}</b><span>sets</span></div><div class="kpi"><b class="${d.prs ? 'acc' : ''}">${d.prs}</b><span>PRs</span></div></div></div>
    <div class="card"><div class="mb1 eyebrow">Compared with last time</div><div class="list">${d.rows.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.e.name)} ${r.types.length ? `<span class="pill pr">PR · ${esc(r.types[0])}</span>` : ''}</div><div class="s num">${r.e.sets.map(setStr).join(', ')}</div></div><div class="tr f13 num"><div>top ${r.last ? delta(r.top ? r.top.w : null, r.last.top ? r.last.top.w : null, v => dw(v)) : '<span class="sec">first time</span>'}</div><div>vol ${r.last ? delta(r.vol, r.last.vol, v => dvol(v)) : ''}</div></div></div>`).join('') || '<div class="empty">No sets logged. Go back and tick some sets, or discard the workout.</div>'}</div></div>
    <div class="field"><label for="sum-note">Note</label><textarea class="input" id="sum-note" data-in="sumNote" placeholder="How did it go?">${esc(A.note || '')}</textarea></div>
    <div class="field"><span class="lbl">Energy</span><div class="seg">${[1, 2, 3, 4, 5].map(n => `<button class="${A.energy === n ? 'on' : ''}" data-a="energy" data-k="${n}">${n}</button>`).join('')}</div></div>
    ${changed ? `<label class="card tight row between" for="sum-upd"><span>Update the ${esc(sp.name)} split with today’s exercises</span><input type="checkbox" id="sum-upd" data-in="sumUpd" ${A.updSplit ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--accent)"></label>` : ''}
    ${d.sets ? `<button class="btn primary block" data-a="saveWk">Save workout</button>` : `<button class="btn block" data-a="sumBack">Back to workout</button><button class="self-c c-neg link" data-a="wkDiscard">Discard workout</button>`}
  </div>`;
}
function saveWorkout() {
  const d = summaryData(); if (!d.sets) return;
  const planned = A.ex.reduce((a, e) => a + e.sets.filter(s => s.t !== 'warm').length, 0);
  const w = { id: A.id, date: A.date || ymd(new Date(A.start)), splitId: A.splitId, splitName: A.splitName, start: A.start, end: A.endAt || Date.now(), note: A.note || '', energy: A.energy || null, src: 'native', planned, ex: d.ex.map(e => ({ name: e.name, note: e.note || '', sets: e.sets, ...(e.ss ? { ss: 1 } : {}) })) };
  S.workouts[w.id] = w;
  const sp = A.splitId && splitById(A.splitId);
  let metaChanged = false;
  if (sp && A.updSplit) {
    sp.ex = A.ex.map(e => sp.ex.find(x => x.name === e.name) || { name: e.name, sets: e.sets.length, repMin: 6, repMax: 10, rest: e.rest, note: '' });
    metaChanged = true;
  }
  A = null; REST = null; invalidate();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  persist(monthPath(w.date), 'jd/active', ...(metaChanged ? ['jd/meta'] : []));
  NAV.tab = 'today'; NAV.stack = []; render();
  showRecap(w.id, true);
}

// ---------- Job’s Done recap (after saving, or from a past workout) ----------
// "That's like lifting…" in each theme's voice (Job, 19 Oct): [kg per thing, line]. The biggest thing you lifted at least 1.5 of wins.
const HEAVY = {
  mono: [[3000, n => `That’s ${n} getaway helicopters, airlifted by hand.`], [1500, n => `That’s like pushing ${n} Aston Martins out of a car park. Quietly.`], [500, n => `That’s ${n} bank vault doors. Nobody saw a thing.`], [12.4, n => `That’s ${n} gold bars. Shaken, not stirred.`]],
  spidey: [[12000, n => `That’s like stopping ${n} runaway city buses.`], [1500, n => `That’s ${n} falling taxis, caught before they hit the street.`], [100, n => `That’s ${n} villains webbed up and left for the police.`], [1, n => `That’s ${n} large pizzas, delivered on time for once.`]],
  cliffs: [[4500, n => `That’s like hauling ${n} snowcats up the trail.`], [600, n => `That’s ${n} grumpy grizzly bears carried to the summit.`], [70, n => `That’s ${n} mountain goats, every one of them complaining.`], [20, n => `That’s ${n} overpacked hiking bags.`]],
  climb: [[200, n => `That’s ${n} haul bags dragged up El Cap.`], [75, n => `That’s ${n} climbers hanging off your belay at once.`], [5, n => `That’s ${n} crash pads, stacked to the ceiling.`], [.2, n => `That’s ${n} chalk bags. Very chalky.`]],
};
function heavyLine(kg, k = theme()) {
  const L = HEAVY[k] || HEAVY.mono, h = L.find(x => kg / x[0] >= 1.5) || L[L.length - 1], t = kg / h[0];
  return h[1](t < 10 ? (Math.round(t * 10) / 10).toString() : Math.round(t).toLocaleString('en-GB'));
}
function recapData(id) {
  const w = S.workouts[id], I2 = ix(), ws = I2.ws.filter(x => !x.skipped);
  const num = ws.findIndex(x => x.id === id) + 1;
  const prev = ws.slice(0, Math.max(0, num - 1)).reverse().find(x => (w.splitId && x.splitId === w.splitId) || (!w.splitId && x.splitName === w.splitName));
  const vol = wVol(w), sets = w.ex.reduce((a, e) => a + e.sets.filter(x => x.t !== 'warm').length, 0), reps = w.ex.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x.t !== 'warm' && x.r ? x.r : 0), 0), 0);
  const prs = I2.prs.filter(p => p.wid === id);
  const mus = {}; for (const e of w.ex) { const m = exInfo(e.name).muscle, n = e.sets.filter(x => x.t !== 'warm').length * (sideOf(e.name) ? .5 : 1); mus[m] = (mus[m] || 0) + n; }
  const musL = Object.entries(mus).sort((a, b) => b[1] - a[1]);
  const dur = w.end && w.start ? w.end - w.start : 0;
  return { w, num, prev, vol, sets, reps, prs, musL, dur, heavy: heavyLine(vol), dv: prev ? (vol - wVol(prev)) / Math.max(1, wVol(prev)) : null };
}
const RC_LINE = {};
// The top of the finish page, dressed for each theme (Job, 16 Oct: "more interesting", smaller title).
function finHero(d) {
  const k = theme(), num = String(d.num).padStart(3, '0'), when = esc(fmtDate(d.w.date, { wd: true }));
  const line = esc(d.line || (d.line = doneLine(d.w)));
  const tags = `<div class="rc-tags"><span class="rc-tag"><i class="sdot"></i>${esc(d.w.splitName || 'Workout')}</span>${d.prs.length ? `<span class="rc-tag pr">${d.prs.length} PR${d.prs.length > 1 ? 's' : ''}</span>` : ''}</div>`;
  const check = `<div class="rc-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>`;
  if (k === 'mono') return `<div class="rc-hero fin fin-agent"><svg class="fin-scope" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88"/><circle cx="100" cy="100" r="56"/><path d="M100 0v70M100 130v70M0 100h70M130 100h70"/><circle class="dot" cx="100" cy="100" r="4"/></svg>
    <div class="fin-eb">Mission complete · File ${num}</div><h1>Job’s done!</h1><div class="fin-stamp">Target down</div><div class="rc-line">${line}</div><div class="fin-sub">${when}</div>${tags}</div>`;
  if (k === 'spidey') {
    return `<div class="rc-hero fin fin-sky">${halftoneSVG()}${webSVG('fin-web')}
      <canvas class="fin-bamc" width="860" height="580" aria-label="Job’s done!"></canvas>
      <div class="fin-cap"><div class="rc-line">${line}</div><div class="fin-sub">Swing #${d.num} · ${when}</div></div>${tags}</div>`;
  }
  if (k === 'cliffs') { const sk = skyOfW(d.w); return `<div class="rc-hero fin fin-summit tod-${sk.tod}" style="--sky1:${sk.s1};--sky2:${sk.s2};--sky3:${sk.s3}"><div class="fin-ridges" aria-hidden="true"></div><svg class="fin-flag" viewBox="0 0 60 70" aria-hidden="true"><path d="M8 68V6"/><path class="f" d="M8 6l40 10-40 12z"/></svg>
    <div class="fin-eb">Summit reached · Route #${d.num}</div><h1>Job’s done!</h1><div class="rc-line">${line}</div><div class="fin-sub">${when}</div>${tags}</div>`; }
  return `<div class="rc-hero fin fin-boulder">${chalkSVG()}<div class="fin-tag">${chalkSVG().replace('class="fin-chalk"', 'class="fin-chalk on-tag"').replace(/id="ch([bs])"/g, 'id="cht$1"').replace(/#ch([bs])\)/g, '#cht$1)')}${tapeSVG('tape l', 1)}${tapeSVG('tape r', 4)}
    <div class="fin-row"><div><div class="fin-eb">Route sent · #${d.num}</div><h1>Sent!</h1></div><div class="fin-hold">${check}</div></div>
    <div class="rc-line">${line}</div><div class="fin-sub">${when}</div>${tags}</div></div>`;
}
// Boulder: a strip of used climbing tape: torn zigzag ends, creases, grime and chalky thumbprints.
function tapeSVG(cls, seed) {
  let n = seed * 9301 + 49297; const r = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  const end = (x, dir) => { let p = ''; for (let y = 0; y <= 24; y += 3) p += `L${(x + dir * (r() * 5 - 1)).toFixed(1)} ${Math.min(y, 24)}`; return p; };
  let d = 'M4 0L76 0' + end(76, 1).slice(0) + 'L4 24' + end(4, -1).split('L').reverse().join('L').replace(/L$/, '') + 'Z';
  const pts = []; for (let y = 0; y <= 24; y += 3) pts.push([76 + (r() * 5 - 1), y]); const lp = []; for (let y = 24; y >= 0; y -= 3) lp.push([4 - (r() * 5 - 1), y]);
  d = 'M4 0' + pts.map(([x, y]) => `L${x.toFixed(1)} ${y}`).join('') + lp.map(([x, y]) => `L${x.toFixed(1)} ${y}`).join('') + 'Z';
  let grime = ''; for (let i = 0; i < 40; i++) grime += `<circle cx="${(6 + r() * 68).toFixed(1)}" cy="${(2 + r() * 20).toFixed(1)}" r="${(.25 + r() * .7).toFixed(2)}" opacity="${(.3 + r() * .7).toFixed(2)}"/>`;
  const crease = [0, 1, 2].map(() => { const x = 14 + r() * 52; return `M${x.toFixed(1)} 0L${(x + r() * 10 - 5).toFixed(1)} 24`; }).join('');
  return `<svg class="${cls}" viewBox="0 0 80 24" aria-hidden="true"><path class="tb" d="${d}"/><path class="tc" d="${crease}"/><g class="tg">${grime}</g><ellipse class="tp" cx="${(30 + r() * 20).toFixed(1)}" cy="12" rx="9" ry="7"/></svg>`;
}
// Boulder: chalk on the wall: dusty clouds, speckle and finger swipes.
let CHALK = '';
function chalkSVG() {
  if (CHALK) return CHALK; let n = 11; const r = () => ((n = (n * 16807) % 2147483647) / 2147483647); let sp = '';
  [[40, 60, 70], [360, 210, 60], [300, 20, 40], [20, 230, 46]].forEach(([x, y, R]) => { for (let i = 0; i < 70; i++) { const t = r() * 7, dd = Math.pow(r(), .6) * R; sp += `<circle cx="${(x + Math.cos(t) * dd).toFixed(1)}" cy="${(y + Math.sin(t) * dd * .8).toFixed(1)}" r="${(.6 + r() * 1.8).toFixed(1)}" opacity="${(.5 + r() * .5).toFixed(2)}"/>`; } });
  const sw = (x, y, a, l) => [0, 1, 2].map(f => { const ox = -Math.sin(a) * f * 7, oy = Math.cos(a) * f * 7, L = l * (.7 + r() * .3); return `<path d="M${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)}l${(Math.cos(a) * L).toFixed(1)} ${(Math.sin(a) * L).toFixed(1)}"/>`; }).join('');
  return (CHALK = `<svg class="fin-chalk" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><filter id="chb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter><filter id="chs"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter></defs>
    <g filter="url(#chb)" class="cd"><ellipse cx="40" cy="60" rx="70" ry="48"/><ellipse cx="365" cy="215" rx="66" ry="44"/><ellipse cx="300" cy="18" rx="44" ry="26"/><ellipse cx="18" cy="232" rx="48" ry="32"/><ellipse cx="200" cy="250" rx="40" ry="16"/></g>
    <g class="cs">${sp}</g><g class="cw" filter="url(#chs)">${sw(330, 70, 2.5, 60)}${sw(250, 196, -.35, 48)}</g></svg>`);
}
// Comic halftone: dots shrink as they fade away from the bottom right corner.
let HALFTONE = '';
function halftoneSVG() {
  if (HALFTONE) return HALFTONE; let c = '';
  for (let y = 0, row = 0; y <= 300; y += 11, row++) for (let x = row % 2 ? 5.5 : 0; x <= 400; x += 11) { const t = Math.hypot(400 - x, 300 - y) / 420, r = 3.4 * (1 - t); if (r > .35) c += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}"/>`; }
  return (HALFTONE = `<svg class="fin-dots" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">${c}</svg>`);
}
// A spider web hanging from the top right corner: straight spokes, threads that sag towards the corner between them.
function webSVG(cls) {
  const S = 7, R = 150, sp = [...Array(S)].map((_, i) => .02 + i / (S - 1) * (Math.PI / 2 - .04));
  let d = sp.map(a => `M150 0L${(150 - Math.cos(a) * R).toFixed(1)} ${(Math.sin(a) * R).toFixed(1)}`).join('');
  for (let r = 26; r < R; r += 24) sp.forEach((a, i) => { const x = 150 - Math.cos(a) * r, y = Math.sin(a) * r; if (!i) { d += `M${x.toFixed(1)} ${y.toFixed(1)}`; return; } const m = (a + sp[i - 1]) / 2, q = r * .8; d += `Q${(150 - Math.cos(m) * q).toFixed(1)} ${(Math.sin(m) * q).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; });
  return `<svg class="${cls}" viewBox="0 0 150 150" aria-hidden="true"><path d="${d}"/></svg>`;
}
function showRecap(id, fresh) {
  const d = recapData(id); if (!d.w) return;
  d.line = RC_LINE[id] || (RC_LINE[id] = doneLine(d.w));
  const old = document.getElementById('recap'); if (old) old.remove(); document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div'); el.id = 'recap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Workout recap');
  const pr = new Map(d.prs.map(p => [p.ex, p])), mx = d.musL.length ? d.musL[0][1] : 1;
  const h = d.w.ex.map(e => { const H = ix().hist[e.name] || [], k = H.findIndex(x => x.wid === d.w.id), p = k > 0 ? H[k - 1] : null, t = topSet(e.sets);
    let dl = '<span class="rc-dl new">New</span>';
    if (p && p.top && t) { const dk = t.w - p.top.w, dr = t.r - p.top.r;
      dl = dk > 0.01 ? `<span class="rc-dl up">▲ ${dw(dk)} ${U()}</span>` : dk < -0.01 ? `<span class="rc-dl dn">▼ ${dw(-dk)} ${U()}</span>` : dr > 0 ? `<span class="rc-dl up">▲ ${dr} rep${dr > 1 ? 's' : ''}</span>` : dr < 0 ? `<span class="rc-dl dn">▼ ${-dr} rep${dr < -1 ? 's' : ''}</span>` : '<span class="rc-dl">Same as last</span>'; }
    return { e, t, dl }; });
  const pv = d.prev ? wVol(d.prev) : 0, top = Math.max(d.vol, pv, 1);
  const wk = ix().ws.filter(x => !x.skipped && mondayOf(x.date) === mondayOf(d.w.date)).length, tgt = Math.max(wk, S.profile.weeklyTarget || 4);
  const sp = wSplit(d.w), col = sp ? sp.color : 'var(--accent)', nx = nextSplit();
  const n1 = n => (n % 1 ? n.toFixed(1) : n) + (n === 1 ? ' set' : ' sets');
  el.innerHTML = `<div class="rc-body" style="--split:${col};--ink:${sp ? inkOn(sp.color) : '#fff'}">
    ${finHero(d)}
    <div class="card rc-vol">
      <div class="eyebrow">Volume</div>
      <div class="rc-big num">${dvol(d.vol)}<span class="unit">${U()}</span></div>
      <div class="cap">${esc(d.heavy)}</div>
      ${d.prev ? `<div class="rc-cmp">
        <div class="rc-bar"><span>Today</span><i><b style="width:${Math.round(d.vol / top * 100)}%"></b></i><em class="num">${dvol(d.vol)}</em></div>
        <div class="rc-bar was"><span>Last ${esc(fmtDate(d.prev.date))}</span><i><b style="width:${Math.round(pv / top * 100)}%"></b></i><em class="num">${dvol(pv)}</em></div>
        <div class="cap ${d.dv >= 0 ? 'c-pos' : ''}">${d.dv >= 0 ? `${Math.round(d.dv * 100)}% more volume than your last ${esc(d.w.splitName || 'workout')}` : d.w.planned && d.sets < d.w.planned ? `A shorter session: ${d.sets} of ${d.w.planned} planned sets done.` : `${Math.abs(Math.round(d.dv * 100))}% less volume than your last ${esc(d.w.splitName || 'workout')}`}</div></div>` : ''}
    </div>
    <div class="card"><div class="kpis rc-k">${d.dur ? `<div class="kpi"><b>${fmtDur(d.dur)}</b><span>time</span></div>` : ''}<div class="kpi"><b>${d.w.ex.length}</b><span>exercises</span></div><div class="kpi"><b>${d.sets}</b><span>sets</span></div><div class="kpi"><b>${d.reps}</b><span>reps</span></div></div></div>
    ${d.prs.length ? `<div class="card"><div class="mb2 eyebrow">Personal records</div>${d.prs.map(p => `<div class="rc-pr"><span class="rc-medal" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 2l3 7M16 2l-3 7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="15" r="6" fill="#F4B728"/></svg></span><div class="grow"><div class="t">${esc(p.ex)}</div><div class="cap">${esc(p.types.join(' · '))}</div></div><b class="num">${setStr(p.set)}</b></div>`).join('')}</div>` : ''}
    <div class="card"><div class="mb1 eyebrow">Exercises</div><div class="list">${h.map(({ e, t, dl }) => `<div class="li"><div class="grow"><div class="t">${esc(e.name)} ${pr.has(e.name) ? '<span class="pill pr">PR</span>' : ''}</div><div class="s num">${e.sets.map(setStr).join('  ·  ')}</div></div><div class="rc-right"><b class="num">${t ? setStr(t) : '—'}</b>${dl}</div></div>`).join('')}</div></div>
    <div class="card"><div class="mb3 eyebrow">Muscles worked</div>${d.musL.map(([m, n]) => `<div class="rc-mu"><span>${esc(m)}</span><i><b style="width:${Math.round(n / mx * 100)}%"></b></i><em class="num">${n1(n)}</em></div>`).join('')}</div>
    ${(() => { const gr = d.w.ex.map(e => goalState(e.name)).filter(G => G && G.hit === d.w.date); return gr.length ? `<div class="card"><div class="mb2 eyebrow">Goal reached</div>${gr.map(G => `<div class="row between"><span>${esc(G.name)}</span><span class="num fw6">${dw(G.w)} ${U()} × ${G.r}</span></div>`).join('')}</div>` : ''; })()}
    ${(() => { const nb = badgeList().filter(b => b.at === d.w.date); return nb.length ? `<div class="card"><div class="mb3 eyebrow">${nb.length > 1 ? 'Badges' : 'Badge'} earned</div><div class="badges">${nb.map(badgeHTML).join('')}</div></div>` : ''; })()}
    <div class="card rc-week"><div class="row between"><span class="eyebrow">This week</span><span class="cap">${esc(streakText())}</span></div>
      <div class="rc-dots">${Array.from({ length: tgt }, (_, i) => `<i class="${i < wk ? 'on' : ''}"></i>`).join('')}</div>
      <div class="cap">${wk} of ${plural(S.profile.weeklyTarget || 4, 'workout')}${nx ? ` · Next up: <b class="c-text">${esc(nx.name)}</b>` : ''}</div></div>
    <div class="grid2"><button class="btn block" id="rc-share">Share</button><button class="btn primary block" id="rc-done">Done</button></div>
  </div>`;
  document.body.appendChild(el);
  const bc = el.querySelector('.fin-bamc'); if (bc) drawBam(bc.getContext('2d'), 330, 290);
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); if (fresh) setTimeout(maybeInstallGuide, 400); };
  el.querySelector('#rc-done').onclick = close;
  el.querySelector('#rc-share').onclick = () => openShareSheet(d);
  if (fresh) { const w0 = S.workouts[id]; if (!(w0 && w0.planned && wSets(w0) < w0.planned)) confetti(110); try { SOUNDS.amazing(); } catch (e) {} }
}
// Draw the recap as a 1080x1350 share card. Each theme has its own card (Job, 16 Oct):
// Agent = mission debrief, Skyline = night patrol comic, Summit = summit log with an elevation profile, Boulder = route tag on the wall.
// The Skyline BAM! burst Job picked (16 Oct): red halftone ring, jagged red burst, yellow rim, white core, extruded orange letters.
// Drawn centred on BX, BY; the share card and the finish page both use it.
function drawBam(g, BX, BY) {
  const RED = '#E2231A', F = (wt, px) => `${wt} ${px}px -apple-system, "SF Pro Display", system-ui, sans-serif`, BAM = Object.assign({ rim: '#FFD21F', core: '#FFFFFF', l: ['#D91A12', '#F26A1B', '#FFC61A'], dots: 'rgba(255,214,60,.75)' });
    const burst = (n, rIn, rOut, sx, sy, rot, jit) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * Math.PI * 2, r = i % 2 ? rIn : rOut * (1 + jit * Math.sin(i * 7.3)); g.lineTo(BX + Math.cos(a) * r * sx, BY + Math.sin(a) * r * sy); } g.closePath(); };
    g.save(); g.translate(BX, BY); g.rotate(-.13); g.scale(.84, .84); g.translate(-BX, -BY); // the whole burst leans, kept small in the top left
    g.save(); burst(13, 230, 420, 1.25, .78, .1, .18); g.clip();
    for (let y = BY - 360; y < BY + 360; y += 22) for (let x = BX - 560; x < BX + 560; x += 22) { const dx = (x - BX) / 1.25, dy = (y - BY) / .78, dd = Math.hypot(dx, dy), r = Math.max(0, 7.5 * (1 - Math.abs(dd - 330) / 140)); if (r > .6) { g.fillStyle = RED; g.beginPath(); g.arc(x + ((y / 22) % 2 ? 11 : 0), y, r, 0, 7); g.fill(); } }
    g.restore();
    burst(11, 210, 330, 1.25, .78, .25, .22); g.fillStyle = RED; g.fill(); g.lineWidth = 6; g.strokeStyle = '#7A0D0A'; g.stroke();
    burst(11, 190, 262, 1.25, .78, .27, .15); g.fillStyle = BAM.rim; g.fill();
    burst(11, 172, 240, 1.25, .78, .27, .15); g.fillStyle = BAM.core; g.fill();
    // Letters drawn one by one, each with its own width, height and tilt, then the whole word is bent like a hand-lettered BAM!:
    // Job picked the per-letter warp without the perspective bend (16 Oct), so the bend is off (from = to = 1).
    const glyph = (q, ch, px, sx, sy) => {
      q.save(); q.scale(sx, sy); q.font = F(900, px); q.textAlign = 'center'; q.lineJoin = 'round';
      for (let k = 16; k > 0; k -= 2) { q.fillStyle = '#111'; q.fillText(ch, k / sx, k / sy); }
      q.lineWidth = 15 / Math.min(sx, sy); q.strokeStyle = '#111'; q.strokeText(ch, 0, 0);
      const gr2 = q.createLinearGradient(0, -px * .8, 0, 0); gr2.addColorStop(0, BAM.l[0]); gr2.addColorStop(.6, BAM.l[1]); gr2.addColorStop(1, BAM.l[2]); q.fillStyle = gr2; q.fillText(ch, 0, 0);
      q.globalCompositeOperation = 'source-atop'; q.fillStyle = BAM.dots; const cw = q.measureText(ch).width;
      for (let yy = -px * .78; yy < 6; yy += 13) for (let xx = -cw / 2 - 6; xx < cw / 2 + 6; xx += 13) { const r = 3.6 * Math.max(0, (yy + px * .78) / (px * .78)); if (r > .5) { q.beginPath(); q.arc(xx + (Math.round(yy / 13) % 2 ? 6.5 : 0), yy, r, 0, 7); q.fill(); } }
      q.globalCompositeOperation = 'source-over'; q.restore(); };
    const word = (t, cx, cy, px, spec, warp) => {
      const o = document.createElement('canvas'), OW = 1000, OH = Math.round(px * 2.6); o.width = OW; o.height = OH; const q = o.getContext('2d');
      q.font = F(900, px); const ws = [...t].map((ch, i) => q.measureText(ch).width * spec[i][0] * .97); const tot = ws.reduce((a, b) => a + b, 0);
      let x = OW / 2 - tot / 2; const base = OH * .66;
      [...t].forEach((ch, i) => { const [sx, sy, rot, dy] = spec[i]; q.save(); q.translate(x + ws[i] / 2, base + dy); q.rotate(rot); q.transform(1, 0, -.1, 1, 0, 0); glyph(q, ch, px, sx, sy); q.restore(); x += ws[i]; });
      // bend: draw in thin columns, each stretched by its position (small on the left, huge on the right) and lifted on an arc
      const x0 = OW / 2 - tot / 2 - 40, x1 = OW / 2 + tot / 2 + 60, span = x1 - x0;
      for (let sx0 = x0; sx0 < x1; sx0 += 2) {
        const u = (sx0 - x0) / span, k = warp.from + (warp.to - warp.from) * Math.pow(u, 1.15), lift = Math.sin(u * Math.PI) * warp.arc;
        const dx = cx - span * warp.wide / 2 + (sx0 - x0) * warp.wide;
        g.drawImage(o, sx0, 0, 2, OH, dx, cy - base * k - lift, 2 * warp.wide + .6, OH * k);
      }
    };
    word('JOB’S', BX - 34, BY - 6, 138, [[.98, .78, -.17, 16], [1.38, 1.0, -.06, 0], [1.5, 1.16, .03, -8], [.9, 1.1, .08, -14], [1.28, 1.32, .13, 6]], { from: 1, to: 1, arc: 0, wide: 1 });
    word('DONE!', BX - 16, BY + 156, 138, [[1.12, .82, -.13, 10], [1.48, 1.04, -.04, 0], [1.36, 1.2, .05, -6], [1.2, 1.36, .1, 4], [.92, 1.56, .17, 16]], { from: 1, to: 1, arc: 0, wide: 1 });
    g.letterSpacing = '0px';
  g.restore();
}
// A small invite at the foot of every share card, in the theme's voice (Job, 16 Oct), and in the text that goes with it.
const APP_URL = 'jobdone-peach.vercel.app';
const INVITE = { mono: 'Your mission awaits', spidey: 'Suit up', cliffs: 'Start your own climb', climb: 'Send your own routes' };
const inviteText = () => `Job’s Done! ${INVITE[theme()] || INVITE.cliffs} at https://${APP_URL}`;
async function drawShare(d, o = shareOpts(d)) {
  // story = full-screen 9:16 for Instagram Stories (Job, 19 Oct): the scenery fills 1920 tall, the card's content keeps its 1350 layout, centred inside the story's safe area
  const W = 1080, CH = 1350, H = o.story ? 1920 : CH, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const SANS = '-apple-system, "SF Pro Display", system-ui, sans-serif', MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const F = (wt, px, fam = SANS) => `${wt} ${px}px ${fam}`;
  try { await document.fonts.ready; } catch (e) {}
  const img = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; setTimeout(() => r(null), 3000); });
  const urlOf = s => { const m = /url\(\s*"((?:[^"\\]|\\.)*)"\s*\)/.exec(s || '') || /url\(\s*'?([^')]+)'?\s*\)/.exec(s || ''); return m ? m[1].replace(/\\"/g, '"') : null; };
  const bgOf = (sel, pseudo) => { const el = document.querySelector(sel); return el ? urlOf(getComputedStyle(el, pseudo || null).backgroundImage) : null; };
  const cover = (i, x = 0, y = 0, w = W, h = H, ay = 0) => { if (!i) return; const iw = i.naturalWidth || 390, ih = i.naturalHeight || 844, s = Math.max(w / iw, h / ih); g.drawImage(i, x + (w - iw * s) / 2, y + (h - ih * s) * ay, iw * s, ih * s); };
  const cs = getComputedStyle(document.documentElement), tok = (k, f) => (cs.getPropertyValue(k).trim() || f);
  const fit = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
  const RR = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const sp = (t, ls) => { g.letterSpacing = ls + 'px'; return t; };
  const line = d.line || RC_LINE[d.w.id] || doneLine(d.w);
  // the theme's 'That's like…' comparison from the recap goes on every card (Job, 20 Oct)
  const heavy = d.heavy || heavyLine(d.vol);
  // with no lifts on the card (Job, 22 Oct): muscles worked and the week's streak fill the space, no weights or exercise names
  const wkN = ix().ws.filter(x => !x.skipped && mondayOf(x.date) === mondayOf(d.w.date)).length, wkT = Math.max(wkN, S.profile.weeklyTarget || 4);
  // fill: 'both' (muscles + week), 'mus', 'week', or 'shrink' (nothing added, the layout closes the gap)
  const FILL = o.fill || 'both';
  const fillIn = (x, y, w, h, st) => { if (FILL === 'shrink') return; const fam = st.mono ? MONO : SANS; g.textAlign = 'left';
    const showM = FILL !== 'week', showW = FILL !== 'mus', big = FILL !== 'both';
    g.fillStyle = st.dim; g.font = F(800, 24, fam); g.fillText(sp(showM ? st.title : 'THIS WEEK', 4), x, y); g.letterSpacing = '0px'; let yy = y + 30;
    if (showM) { const mus = d.musL.slice(0, 4), mx = mus.length ? mus[0][1] : 1, cw = w / Math.max(3, mus.length), bh = big ? 22 : 14;
      mus.forEach(([m, n], i) => { const cx = x + i * cw; g.fillStyle = st.ink; g.font = F(700, big ? 30 : 26, fam); g.fillText(fit(m, 11), cx, yy + (big ? 34 : 28));
        g.fillStyle = st.track; RR(cx, yy + (big ? 54 : 44), cw - 28, bh, bh / 2); g.fill(); g.fillStyle = st.bar; RR(cx, yy + (big ? 54 : 44), Math.max(bh, (cw - 28) * n / mx), bh, bh / 2); g.fill(); });
      yy += big ? 110 : 84; }
    if (showW) { const r = big ? 22 : 13, gap = big ? 60 : 40; yy += big ? 30 : 16; for (let i = 0; i < wkT; i++) { g.beginPath(); g.arc(x + r + i * gap, yy - r * .7, r, 0, 7); g.fillStyle = i < wkN ? st.bar : st.track; g.fill(); }
      g.fillStyle = st.ink; g.font = F(700, big ? 32 : 28, fam); if (big) g.fillText(`${wkN} of ${wkT} workouts this week · ${streakText()}`, x, yy + 54);
      else g.fillText(`${wkN} of ${wkT} this week · ${streakText()}`, x + wkT * gap + 10, yy); } };
  const wrap = (t, x, y, mw, lh, max = 2) => { const words = t.split(' '); let ln = '', n = 0; for (const w of words) { const tr = ln ? ln + ' ' + w : w; if (g.measureText(tr).width > mw && ln) { if (n === max - 1) break; g.fillText(ln, x, y + n * lh); n++; ln = w; } else ln = tr; } if (ln) { g.fillText(ln, x, y + n * lh); n++; } return n; };
  const prn = new Map(d.prs.map(p => [p.ex, p.set]));
  const lifts = mergeLR(d.w.ex.map(e => ({ name: e.name, sets: e.sets })), e => { const t = prn.get(e.name) || topSet(e.sets); return t ? setStr(t) : '—'; })
    .map(r => ({ ...r, txt: r.txt.replace(' each side', ''), pr: d.w.ex.some(e => baseName(e.name) === baseName(r.name) && prn.has(e.name)),
      vol: d.w.ex.filter(e => baseName(e.name) === baseName(r.name)).reduce((a, e) => a + exVol(e.sets), 0) }));
  const allLifts = lifts.slice();
  // what's on the card is the person's choice (Job, 19 Oct): stats can be hidden one by one, lifts picked or turned off
  const stats = [d.dur ? [fmtDur(d.dur), 'time', 'time'] : [String(d.reps), 'reps', 'time'], [dvol(d.vol), U() + ' lifted', 'vol'], [String(d.sets), 'sets', 'sets'], [String(d.prs.length), d.prs.length === 1 ? 'PR' : 'PRs', 'prs']]
    .filter(s => !o.hide.includes(s[2]));
  const hotStat = s => s[2] === 'prs' && d.prs.length;
  lifts.splice(0, lifts.length, ...(o.lifts ? lifts.filter(r => !o.pick || o.pick.includes(r.name)) : []));
  const date = fmtDate(d.w.date, { wd: true }), split = d.w.splitName || 'Workout';
  const icon = HOSTED ? await img('icons/apple-touch-icon.png?v=7') : null;
  const mark = (x, y, col, s = 1) => { let x0 = x; if (icon) { g.save(); RR(x, y - 44 * s, 56 * s, 56 * s, 14 * s); g.clip(); g.drawImage(icon, x, y - 44 * s, 56 * s, 56 * s); g.restore(); x0 = x + 72 * s; } g.fillStyle = col; g.font = F(800, 32 * s); g.fillText(sp('Job’s Done', 0), x0, y); };
  let OY = (H - CH) / 2;
  const k = theme();
  if (k === 'climb') await handFont();
  const GAP = !lifts.length && FILL === 'shrink' ? { mono: 230, spidey: 250, cliffs: 210, climb: 330 }[k] || 0 : 0;
  if (o.story) OY += GAP / 2;

  if (k === 'mono') {
    // Agent: mission debrief on the obsidian wallpaper
    g.fillStyle = '#0B0B0E'; g.fillRect(0, 0, W, H);
    cover(await img(bgOf('#bg', '::before')));
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(8,8,10,.25)'); gr.addColorStop(.45, 'rgba(8,8,10,.72)'); gr.addColorStop(1, 'rgba(8,8,10,.92)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const RED = '#E0303C', DIM = 'rgba(255,255,255,.55)';
    g.save(); g.translate(0, OY);
    // scope reticle behind the headline
    g.save(); g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 3; const cx = 820, cy = 300;
    [210, 140].forEach(r => { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); });
    g.beginPath(); g.moveTo(cx - 260, cy); g.lineTo(cx - 40, cy); g.moveTo(cx + 40, cy); g.lineTo(cx + 260, cy); g.moveTo(cx, cy - 260); g.lineTo(cx, cy - 40); g.moveTo(cx, cy + 40); g.lineTo(cx, cy + 260); g.stroke();
    g.fillStyle = 'rgba(224,48,60,.55)'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill(); g.restore();
    g.fillStyle = RED; g.font = F(700, 26, MONO); g.fillText(sp(`DEBRIEF · FILE ${String(d.num).padStart(3, '0')} · ${date.toUpperCase()}`, 4), 72, 110);
    g.textAlign = 'right'; g.fillStyle = DIM; g.fillText(sp('EYES ONLY', 4), W - 72, 110); g.textAlign = 'left';
    g.fillStyle = '#fff'; g.font = F(900, 128); g.fillText(sp('MISSION', -2), 64, 270); g.fillText(sp('COMPLETE', -2), 64, 396);
    // red stamp
    g.save(); g.translate(78, 556); g.rotate(-.05); g.strokeStyle = RED; g.lineWidth = 6; RR(-10, -58, 400, 84, 10); g.stroke();
    g.fillStyle = RED; g.font = F(900, 50, MONO); g.fillText(sp('JOB’S DONE', 6), 22, 2); g.restore();
    g.fillStyle = DIM; g.font = F(500, 34); g.fillText(sp(fit(line, 40), 0), 70, 470);
    // dossier rows
    let y = 680; const row = (a, b, hot) => { g.font = F(600, 28, MONO); g.fillStyle = DIM; g.fillText(sp(a, 3), 72, y); const aw = g.measureText(a).width;
      g.font = F(700, 38); g.letterSpacing = '0px'; const bw = g.measureText(b).width; g.fillStyle = 'rgba(255,255,255,.22)'; for (let x = 72 + aw + 24; x < W - 72 - bw - 20; x += 16) g.fillRect(x, y - 6, 6, 3);
      g.fillStyle = hot ? RED : '#fff'; g.textAlign = 'right'; g.fillText(b, W - 72, y + 2); g.textAlign = 'left'; y += 54; };
    row('OPERATION', fit(split, 22)); stats.forEach(s => row(s[1].toUpperCase().replace(' LIFTED', ' MOVED'), s[0], hotStat(s)));
    g.letterSpacing = '0px'; g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `italic 600 32px ${SANS}`; y += 4 + (wrap(heavy, 72, y, W - 144, 42) - 1) * 42 + 30;
    if (lifts.length) { y += 26; g.fillStyle = RED; g.fillRect(72, y - 38, W - 144, 3); g.font = F(700, 26, MONO); g.fillText(sp('TARGETS', 4), 72, y + 8); y += 64;
    for (const r of lifts.sort((a, b) => b.pr - a.pr).slice(0, 5)) {
      if (y > CH - 120) break;
      g.fillStyle = '#fff'; g.font = F(700, 36); g.fillText(sp(fit(r.name, 22), 0), 72, y);
      g.textAlign = 'right'; g.font = F(700, 34, MONO); g.fillStyle = r.pr ? RED : 'rgba(255,255,255,.8)'; g.fillText(sp(fit(r.txt, 16), 0), W - (r.pr ? 230 : 72), y);
      if (r.pr) { g.strokeStyle = RED; g.lineWidth = 3; RR(W - 214, y - 34, 142, 46, 6); g.stroke(); g.fillStyle = RED; g.font = F(800, 22, MONO); g.textAlign = 'center'; g.fillText(sp('NEW RECORD', 1), W - 143, y - 3); }
      g.textAlign = 'left'; y += 58;
    } } else if (FILL !== 'shrink') { y += 40; g.fillStyle = RED; g.fillRect(72, y - 38, W - 144, 3); fillIn(72, y + 8, W - 144, CH - 110 - y, { title: 'AREAS ENGAGED', ink: '#fff', dim: RED, bar: RED, track: 'rgba(255,255,255,.14)', mono: true }); }
    g.letterSpacing = '0px'; mark(72, CH - 56, 'rgba(255,255,255,.7)', .8);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.6)'; g.font = F(600, 24, MONO); g.fillText(sp(('Recruiting · ' + APP_URL).toUpperCase(), 2), W - 72, CH - 62); g.textAlign = 'left'; g.restore();
  } else if (k === 'spidey') {
    // Skyline: night patrol over the city
    g.fillStyle = '#0D1A45'; g.fillRect(0, 0, W, H);
    cover(await img(bgOf('#bg', '::before')), 0, 0, W, H, 1);
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(9,16,44,.35)'); gr.addColorStop(.5, 'rgba(9,16,44,.75)'); gr.addColorStop(1, 'rgba(9,16,44,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const RED = '#E2231A';
    // web in the top corner
    // graded halftone from the bottom right corner, like the finish page
    g.fillStyle = 'rgba(91,140,255,.17)';
    for (let y = 0, row = 0; y <= H; y += 30, row++) for (let x = row % 2 ? 15 : 0; x <= W; x += 30) { const r = 8.5 * (1 - Math.hypot(W - x, H - y) / 1450); if (r > 1) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
    g.save(); g.translate(W - 380, 0); g.scale(380 / 150, 380 / 150); g.strokeStyle = 'rgba(255,255,255,.42)'; g.lineWidth = 1.1; g.lineCap = 'round';
    g.stroke(new Path2D(/ d="([^"]+)"/.exec(webSVG(''))[1])); g.restore();
    g.save(); g.translate(0, OY);
    // comic burst headline, BAM! style (Job's reference, 16 Oct): halftone dots, red burst, yellow rim, white core, extruded orange letters
    drawBam(g, 330, 310); mark(72, 92, '#fff', .8);
    // caption box
    g.letterSpacing = '0px'; g.font = F(800, 34); const cap = fit(line, 44), cw = g.measureText(cap).width + 56;
    g.save(); g.translate(72, 540); g.rotate(-.02); g.fillStyle = '#111'; g.fillRect(10, 10, cw, 74); g.fillStyle = '#FFD21F'; g.fillRect(0, 0, cw, 74); g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(0, 0, cw, 74);
    g.fillStyle = '#111'; g.font = F(800, 34); g.fillText(cap, 28, 49); g.restore();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = F(700, 28); g.fillText(sp(`${split.toUpperCase()} · SWING #${d.num} · ${date.toUpperCase()}`, 2), 72, 680);
    // stats as web cells
    const hex = (x, y, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
    const hy = lifts.length ? 830 : 900;
    stats.forEach(([a, b, key], i) => { const x = W / 2 + (i - (stats.length - 1) / 2) * 234, y = hy; hex(x, y, 112); g.fillStyle = key === 'prs' && d.prs.length ? RED : 'rgba(20,34,84,.92)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.stroke();
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.letterSpacing = '0px'; g.font = F(800, a.length > 5 ? 44 : 54); g.fillText(a, x, y + 6); g.font = F(700, 22); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(sp(b.toUpperCase(), 2), x, y + 46); g.textAlign = 'left'; });
    g.letterSpacing = '0px'; g.fillStyle = '#FFD21F'; g.font = F(800, 28); g.textAlign = 'center'; const hn = wrap(heavy, W / 2, hy + 160, W - 140, 36); g.textAlign = 'left';
    let y = hy + 160 + hn * 36 + 46;
    if (!lifts.length && FILL !== 'shrink') { g.fillStyle = 'rgba(13,26,69,.85)'; RR(56, y - 56, W - 112, CH - 110 - (y - 56), 16); g.fill(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.stroke();
      fillIn(92, y - 6, W - 184, CH - 150 - y, { title: 'POWERS USED', ink: '#fff', dim: '#FFD21F', bar: RED, track: 'rgba(255,255,255,.16)' }); }
    for (const r of lifts.sort((a, b) => b.pr - a.pr).slice(0, 3)) {
      g.letterSpacing = '0px'; g.fillStyle = 'rgba(13,26,69,.85)'; RR(56, y - 50, W - 112, 72, 12); g.fill(); g.strokeStyle = r.pr ? RED : 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fff'; g.font = F(700, 34); g.fillText(fit(r.name, 24), 88, y); g.textAlign = 'right'; g.font = F(800, 34); g.fillText(fit(r.txt, 18), W - (r.pr ? 180 : 88), y);
      if (r.pr) { hex(W - 128, y - 14, 34); g.fillStyle = RED; g.fill(); g.fillStyle = '#fff'; g.font = F(900, 22); g.textAlign = 'center'; g.fillText('PR', W - 128, y - 6); }
      g.textAlign = 'left'; y += 78;
    }
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = F(600, 26); g.fillText(sp(`Job’s Done! ${INVITE.spidey} at ${APP_URL}`, 0), 72, CH - 48); g.restore();
  } else if (k === 'cliffs') {
    // Summit: the sky right now, the ridges, and the session drawn as an elevation profile
    const sk = skyOfW(d.w), s1 = sk.s1, s2 = sk.s2, s3 = sk.s3;
    const night = sk.tod !== 'day';
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, s1); gr.addColorStop(.3, s2); gr.addColorStop(.55, s3); gr.addColorStop(1, s2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rid = await img(urlOf(tok('--ridges', ''))); if (rid) { g.globalAlpha = .9; cover(rid, 0, 260, W, H - 260, 0); g.globalAlpha = 1; }
    const INK = night ? '#fff' : '#12304A', INK2 = night ? 'rgba(255,255,255,.75)' : 'rgba(18,48,74,.7)', CARD = night ? 'rgba(14,24,40,.78)' : 'rgba(255,255,255,.82)';
    g.save(); g.translate(0, OY);
    mark(72, 110, INK, .9);
    g.textAlign = 'right'; g.fillStyle = INK2; g.font = F(700, 26); g.fillText(sp('SUMMIT LOG', 4), W - 72, 104); g.textAlign = 'left'; g.letterSpacing = '0px';
    g.fillStyle = INK; g.font = F(900, 132); g.fillText(sp('Summit', -3), 64, 280); g.fillText(sp('reached.', -3), 64, 400);
    g.letterSpacing = '0px'; g.fillStyle = INK2; g.font = F(600, 34); g.fillText(fit(/^summit reached/i.test(line) ? 'That ridge is behind you.' : line, 44), 70, 462);
    // elevation profile card
    const px = 56, py = 520, pw = W - 112, ph = 380; g.fillStyle = CARD; RR(px, py, pw, ph, 32); g.fill();
    g.fillStyle = INK2; g.font = F(700, 24); g.fillText(sp(`${split.toUpperCase()} · ROUTE #${d.num} · ${date.toUpperCase()}`, 2), px + 36, py + 56); g.letterSpacing = '0px';
    g.fillStyle = INK; g.font = F(800, 36); wrap(heavy, px + 36, py + 112, pw - 170, 44);
    const pts = []; let cum = 0; const tot = Math.max(1, allLifts.reduce((a, r) => a + r.vol, 0));
    allLifts.forEach(r => { cum += r.vol; pts.push(cum / tot); });
    const gx = px + 48, gw = pw - 110, gy = py + ph - 44, gh = ph - 230;
    const P = [[gx, gy]].concat(pts.map((v, i) => [gx + (i + 1) / pts.length * gw, gy - v * gh * (.55 + .45 * ((i % 2) ? .8 : 1))]));
    P[P.length - 1][1] = gy - gh;
    gr = g.createLinearGradient(0, gy - gh, 0, gy); gr.addColorStop(0, night ? 'rgba(150,190,230,.55)' : 'rgba(31,122,153,.45)'); gr.addColorStop(1, 'rgba(31,122,153,0)');
    g.beginPath(); g.moveTo(gx, gy); P.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(gx + gw, gy); g.closePath(); g.fillStyle = gr; g.fill();
    g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
    P.slice(1).forEach(([x, y], i) => { g.fillStyle = allLifts[i] && allLifts[i].pr ? '#E0A100' : INK; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); });
    const [fx, fy] = P[P.length - 1]; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 70); g.stroke();
    g.fillStyle = '#E0303C'; g.beginPath(); g.moveTo(fx, fy - 70); g.lineTo(fx - 54, fy - 56); g.lineTo(fx, fy - 42); g.fill();
    // stats
    g.letterSpacing = '0px'; const cw = pw / Math.max(1, stats.length); if (stats.length) { g.fillStyle = CARD; RR(px, 930, pw, 150, 28); g.fill(); }
    stats.forEach(([a, b, key], i) => { const x = px + i * cw + 36; g.fillStyle = key === 'prs' && d.prs.length ? '#C98A00' : INK; g.font = F(800, a.length > 6 ? 38 : 50); g.fillText(a, x, 1004); g.fillStyle = INK2; g.font = F(600, 26); g.fillText(b, x, 1046); });
    // waypoints
    g.letterSpacing = '0px'; let y = stats.length ? 1118 : 978; g.font = F(700, 30);
    if (!lifts.length && FILL !== 'shrink') { g.fillStyle = CARD; RR(px, y - 52, pw, CH - 60 - (y - 52), 28); g.fill(); fillIn(px + 36, y, pw - 72, CH - 100 - y, { title: 'TERRAIN COVERED', ink: INK, dim: INK2, bar: night ? '#9CC4E8' : '#1F7A99', track: night ? 'rgba(255,255,255,.15)' : 'rgba(18,48,74,.12)' }); }
    lifts.slice(0, 3).forEach((r, i) => { g.fillStyle = CARD; RR(px, y - 44, pw, 64, 20); g.fill(); g.fillStyle = INK; g.font = F(800, 24); g.beginPath(); g.arc(px + 40, y - 12, 18, 0, 7); g.fill();
      g.fillStyle = night ? '#0E1828' : '#fff'; g.textAlign = 'center'; g.fillText(String(i + 1), px + 40, y - 3); g.textAlign = 'left'; g.fillStyle = INK; g.font = F(700, 30); g.fillText(fit(r.name, 26), px + 76, y);
      g.textAlign = 'right'; g.font = F(800, 30); g.fillText((r.pr ? 'PR  ' : '') + fit(r.txt, 18), px + pw - 32, y); g.textAlign = 'left'; y += 70; });
    g.fillStyle = INK2; g.font = F(600, 24); g.textAlign = 'center'; g.fillText(`Job’s Done! ${INVITE.cliffs} at ${APP_URL}`, W / 2, CH - 26); g.textAlign = 'left'; g.restore();
  } else {
    // Boulder: a route tag taped to the chalk wall
    g.fillStyle = '#EFEBE5'; g.fillRect(0, 0, W, H);
    cover(await img(bgOf('#bg', '::before')));
    g.fillStyle = 'rgba(120,108,96,.18)'; g.fillRect(0, 0, W, H);
    // more holds bolted to the wall (Job, 22 Oct), drawn in the wallpaper's own style so they all match: soft rounded resin blobs,
    // a darker base peeking out below, a light top, a bolt, all at one strength and under the same chalky wash
    {
      // each hold its own shape (Job, 22 Oct): a jug with a scooped lip, a long pinch, a big lumpy sloper; points are unit coords, smoothed
      const SHAPES = { jug: [[-1, -.2], [-.6, -.75], [0, -.85], [.7, -.65], [1, -.1], [.6, .25], [0, .02], [-.5, .3]], pinch: [[-1.35, -.05], [-.6, -.42], [.4, -.38], [1.25, -.12], [1.15, .26], [.2, .4], [-.8, .34]],
        sloper: [[-1, .1], [-.8, -.6], [-.1, -.95], [.7, -.72], [1, 0], [.72, .6], [-.2, .78], [-.86, .56]] };
      const blob = (x, y, r, sh, rot) => { const c = Math.cos(rot), sn = Math.sin(rot), P = SHAPES[sh].map(([u, v]) => [x + (u * c - v * sn) * r, y + (u * sn + v * c) * r]), n = P.length;
        g.beginPath(); const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const s0 = m(P[n - 1], P[0]); g.moveTo(s0[0], s0[1]); for (let i = 0; i < n; i++) { const e = m(P[i], P[(i + 1) % n]); g.quadraticCurveTo(P[i][0], P[i][1], e[0], e[1]); } g.closePath(); };
      // Job's three spots (22 Oct, marked on a Story screenshot): top left, top right, and the blue one tucked half behind the card on the right.
      // Drawn after the wash in the wallpaper holds' on-screen colours (sampled from Job's screenshot) so strength and tone match exactly.
      for (const [x, ys, r, col, sh, rot, bx, by] of [[52, 115, 46, '#D499AF', 'jug', -.25, 0, -.4], [996, 140, 34, '#DBA179', 'pinch', .5, 0, 0], [968, 440, 52, '#8B99C0', 'sloper', .3, .05, -.1]]) {
        const y = ys * H / 1920;
        g.save();
        blob(x, y + r * .16, r, sh, rot); g.fillStyle = 'rgba(70,60,55,.22)'; g.fill();
        blob(x, y, r, sh, rot); g.fillStyle = col; g.fill();
        const gr4 = g.createLinearGradient(x, y - r, x, y + r); gr4.addColorStop(0, 'rgba(255,255,255,.22)'); gr4.addColorStop(.55, 'rgba(255,255,255,0)'); gr4.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = gr4; g.fill();
        g.fillStyle = 'rgba(40,32,30,.6)'; g.beginPath(); g.arc(x + bx * r, y + by * r, Math.max(3.5, r * .12), 0, 7); g.fill(); g.restore(); } }
    // chalk dust: soft smudges, speckle and a few finger swipes (Job: chalky, not too much)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // chalk (Job, 22 Oct: less like round blots): each mark is a few soft, uneven drag strokes plus grain, so it reads as a smear from chalky fingers
    let CK = '255,255,255'; const dust = (x, y, r, a) => { const ang = rnd() * Math.PI;
      for (let k = 0; k < 4 + rnd() * 3; k++) { const ox = (rnd() - .5) * r * .7, oy = (rnd() - .5) * r * .5, len = r * (.6 + rnd() * .9), a2 = ang + (rnd() - .5) * .5, w0 = r * (.12 + rnd() * .14);
        for (let i = 0; i < len; i += 3) { const f = i / len, w = w0 * (1 - f * .6) * (.7 + rnd() * .6), px = x + ox + Math.cos(a2) * (i - len / 2) + Math.sin(f * 6) * 4, py = y + oy + Math.sin(a2) * (i - len / 2);
          const gr3 = g.createRadialGradient(px, py, 0, px, py, w); gr3.addColorStop(0, `rgba(${CK},${a * .1 * (1 - f * .5)})`); gr3.addColorStop(1, `rgba(${CK},0)`); g.fillStyle = gr3; g.fillRect(px - w, py - w, w * 2, w * 2); } }
      for (let i = 0; i < r * 1.4; i++) { const t = (rnd() - .5) * 1.2 + (rnd() < .5 ? ang : ang + Math.PI), dd = Math.pow(rnd(), .8) * r; g.fillStyle = `rgba(${CK},${Math.min(1, a + .2) * rnd() * .8})`; g.fillRect(x + Math.cos(t) * dd, y + Math.sin(t) * dd * .7, 1 + rnd() * 2.5, 1 + rnd() * 2); } };
    const swipe = (x, y, len, ang, a) => { for (let f = 0; f < 3; f++) { const ox = Math.cos(ang + Math.PI / 2) * f * 16, oy = Math.sin(ang + Math.PI / 2) * f * 16, l = len * (.7 + rnd() * .3);
      for (let i = 0; i < l; i += 2) { const fade = 1 - i / l; g.fillStyle = `rgba(${CK},${a * fade * (.4 + rnd() * .6)})`; g.fillRect(x + ox + Math.cos(ang) * i + (rnd() - .5) * 5, y + oy + Math.sin(ang) * i + (rnd() - .5) * 5, 2 + rnd() * 3, 2 + rnd() * 3); } } };
    const chalkMarks = (spots, swipes) => { spots.forEach(([x, y, r, a]) => dust(x, y, r, a)); swipes.forEach(([x, y, l, ang, a]) => swipe(x, y, l, ang, a)); };
    chalkMarks([[40, 260, 130, 1], [1040, 520, 110, .95], [60, 1180, 150, 1], [990, 1290, 120, .95], [520, 30, 110, .9], [1050, 900, 90, .85], [20, 640, 80, .85]], [[20, 760, 170, -.5, 1], [930, 120, 160, 2.6, 1], [1000, 1080, 140, 3.5, .9], [240, 1320, 150, -.2, .9]]);
    const PUR = '#6C3FD6', MUS = '#F4B728', INK = '#2B213A', INK2 = 'rgba(43,33,58,.62)', HOLDS = ['#E2453C', '#2F7FD8', '#2E8B4E', '#F4B728', '#6C3FD6', '#F07A2B'];
    // rope down the right edge
    g.strokeStyle = PUR; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(W - 46, -20); g.bezierCurveTo(W - 10, 400, W - 90, 800, W - 36, H + 20); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.setLineDash([10, 14]); g.stroke(); g.setLineDash([]);
    g.save(); g.translate(0, OY);
    // the tag
    g.save(); g.translate(W / 2 - 20, 690 - GAP / 2); g.rotate(-.025);
    const TW = 900, TH = 1180 - GAP; g.shadowColor = 'rgba(43,33,58,.28)'; g.shadowBlur = 40; g.shadowOffsetY = 14; g.fillStyle = '#FFFDFA'; RR(-TW / 2, -TH / 2, TW, TH, 22); g.fill(); g.shadowColor = 'transparent';
    // used climbing tape: torn zigzag ends, creases, grime and a chalky thumbprint
    // uneven, asymmetrical tape (Job, 22 Oct): two strips the same size (Job, 22 Oct) set at different angles and heights; the left one carries the name
    [[-TW / 2 + 140, -TH / 2 - 4, -.27, 290, 74], [TW / 2 - 110, -TH / 2 + 16, .55, 290, 74]].forEach(([x, y, a, TL, TT], k) => { g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(-TL / 2, -TT / 2); for (let yy = -TT / 2; yy <= TT / 2; yy += 6) g.lineTo(TL / 2 + (rnd() * 12 - 3), yy); for (let yy = TT / 2; yy >= -TT / 2; yy -= 6) g.lineTo(-TL / 2 - (rnd() * 12 - 3), yy); g.closePath();
      g.shadowColor = 'rgba(43,33,58,.18)'; g.shadowBlur = 6; g.shadowOffsetY = 3; g.fillStyle = 'rgba(241,235,222,.94)'; g.fill(); g.shadowColor = 'transparent';
      g.save(); g.clip(); g.strokeStyle = 'rgba(120,105,85,.28)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const cx = -TL / 2 + 20 + rnd() * (TL - 40); g.beginPath(); g.moveTo(cx, -TT / 2); g.lineTo(cx + rnd() * 24 - 12, TT / 2); g.stroke(); }
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(90,75,60,${.1 + rnd() * .25})`; g.beginPath(); g.arc(-TL / 2 + rnd() * TL, -TT / 2 + rnd() * TT, .6 + rnd() * 1.8, 0, 7); g.fill(); }
      const tp = g.createRadialGradient(k ? -20 : 25, 0, 0, k ? -20 : 25, 0, 26); tp.addColorStop(0, 'rgba(110,95,80,.28)'); tp.addColorStop(1, 'rgba(110,95,80,0)'); g.fillStyle = tp; g.beginPath(); g.ellipse(k ? -20 : 25, 0, 26, 20, 0, 0, 7); g.fill();
      // the app's name in marker on the left strip of tape, like climbers label their routes (Job, 22 Oct)
      if (!k) { g.fillStyle = 'rgba(28,22,40,.9)'; g.font = `42px "JD Marker", "Marker Felt", "Chalkboard SE", cursive`; g.textAlign = 'center'; g.letterSpacing = '0px'; g.rotate(-.03); g.fillText('Job’s Done', 4, 16); g.textAlign = 'left'; }
      g.restore(); g.restore(); });
    const L = -TW / 2 + 60; let y = -TH / 2 + 110;
    g.fillStyle = INK2; g.font = F(800, 26); g.fillText(sp('ROUTE CARD', 4), L, y);
    g.textAlign = 'right'; g.fillText(sp(date.toUpperCase(), 2), TW / 2 - 60, y); g.textAlign = 'left';
    y += 150; g.fillStyle = PUR; g.font = F(900, 170); g.fillText(sp('SENT!', -4), L - 6, y);
    // grade badge
    const hold = (x, y, r, col, seed = 1) => { g.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = r * (.82 + .18 * Math.abs(Math.sin(seed * 7 + i * 2.3))); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .9); } g.closePath(); g.fillStyle = col; g.fill(); g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.arc(x + r * .1, y + r * .1, r * .16, 0, 7); g.fill(); };
    hold(TW / 2 - 150, y - 60, 92, MUS, 3); g.fillStyle = INK; g.font = F(900, 54); g.textAlign = 'center'; g.letterSpacing = '0px'; g.fillText('#' + d.num, TW / 2 - 150, y - 42); g.textAlign = 'left';
    y += 60; g.fillStyle = INK2; g.font = F(600, 34); g.fillText(fit(line, 40), L, y);
    y += 70; g.font = F(800, 30); const tg = split.toUpperCase(), tw = g.measureText(tg).width + 48; g.fillStyle = PUR; RR(L, y - 40, tw, 58, 29); g.fill(); g.fillStyle = '#fff'; g.fillText(sp(tg, 2), L + 24, y - 2);
    // stats on holds
    const HC = { time: '#E7E0F7', vol: '#DDEBF7', sets: '#E3F1E6', prs: '#FFF1CF' };
    if (stats.length) y += 120; stats.forEach(([a, b, key], i) => { const x = L + 95 + (1.5 + i - (stats.length - 1) / 2) * 196; hold(x, y, 84, key === 'prs' && d.prs.length ? MUS : HC[key], i + 5);
      g.fillStyle = INK; g.textAlign = 'center'; g.letterSpacing = '0px'; g.font = F(900, a.length > 6 ? 34 : 46); g.fillText(a, x, y + 10); g.fillStyle = INK2; g.font = F(800, 20); g.fillText(sp(b.toUpperCase(), 1), x, y + 112); g.textAlign = 'left'; });
    y += stats.length ? 180 : 40; g.letterSpacing = '0px'; g.fillStyle = PUR; g.font = `italic 700 32px ${SANS}`; y += (wrap(heavy, L, y, TW - 120, 42) - 1) * 42 + 70; if (lifts.length) { g.fillStyle = INK2; g.font = F(800, 24); g.fillText(sp('PROBLEMS SENT', 4), L, y); } else fillIn(L, y, TW - 120, TH / 2 - 40 - y, { title: 'MUSCLES ON THE WALL', ink: INK, dim: INK2, bar: PUR, track: 'rgba(108,63,214,.14)' }); y += 64;
    lifts.sort((a, b) => b.pr - a.pr).slice(0, 5).forEach((r, i) => { hold(L + 18, y - 12, 20, HOLDS[i % HOLDS.length], i + 2); g.letterSpacing = '0px'; g.fillStyle = INK; g.font = F(700, 34); g.fillText(fit(r.name, 22), L + 56, y);
      g.textAlign = 'right'; g.font = F(800, 34); g.fillText(fit(r.txt, 16), TW / 2 - (r.pr ? 170 : 60), y);
      if (r.pr) { g.fillStyle = MUS; RR(TW / 2 - 150, y - 36, 90, 48, 24); g.fill(); g.fillStyle = INK; g.font = F(900, 24); g.textAlign = 'center'; g.fillText('PR', TW / 2 - 105, y - 4); }
      g.textAlign = 'left'; y += 66; });
    // a little chalk on the card itself, from chalky hands
    CK = '150,138,126'; chalkMarks([[-TW / 2 + 70, TH / 2 - 60, 70, .34], [TW / 2 - 36, -TH / 2 + 260, 56, .3], [TW / 2 - 80, TH / 2 - 120, 50, .26]], [[TW / 2 - 210, TH / 2 - 44, 110, -.35, .5], [-TW / 2 + 40, -TH / 2 + 170, 90, .4, .45]]);
    g.restore(); g.letterSpacing = '0px';
    mark(80, CH - 34, INK, .7);
    g.fillStyle = INK; g.font = F(700, 23); g.textAlign = 'right'; g.fillText(`${INVITE.climb} at ${APP_URL}`, W - 84, CH - 40); g.textAlign = 'left'; g.restore();
  }
  g.letterSpacing = '0px';
  return c;
}
// The person picks what goes on their card (Job, 19 Oct). Hidden stats and lifts on/off are remembered; which lifts is per workout.
const SHARE_MAX = { spidey: 3, cliffs: 3 };
function shareOpts(d) { const p = S.profile.share || {}; return { hide: p.hide || [], lifts: p.lifts !== false, story: !!p.story, pick: d.pick || null }; }
function shareLiftNames(d) {
  const prn = new Set(d.prs.map(p => baseName(p.ex)));
  return mergeLR(d.w.ex.map(e => ({ name: e.name, sets: e.sets })), () => '').map(r => ({ name: r.name, pr: prn.has(baseName(r.name)) })).sort((a, b) => b.pr - a.pr);
}
function openShareSheet(d) {
  const max = SHARE_MAX[theme()] || 5, all = shareLiftNames(d);
  if (!d.pick) d.pick = all.slice(0, max).map(r => r.name);
  const o = () => shareOpts(d);
  const STATS = [['time', d.dur ? 'Time' : 'Reps'], ['vol', U() + ' lifted'], ['sets', 'Sets'], ['prs', 'PRs']];
  const body = () => { const x = o(); return `<div class="stack"><div><div class="eyebrow">Share your card</div><div class="mt1 cap">Pick what goes on it. The picture shows what your friends will see.</div></div>
    <div class="seg sh-seg">${[['', 'Post'], ['1', 'Story']].map(([v, t]) => `<button class="${!!v === x.story ? 'on' : ''}" data-sf="${v}">${t}</button>`).join('')}</div>
    <img class="sh-prev ${x.story ? 'story' : ''}" id="sh-prev" alt="Your share card">
    <div><div class="mb2 eyebrow">Stats</div><div class="chips sh-chips">${STATS.map(([k, t]) => `<button class="chip ${x.hide.includes(k) ? '' : 'on'}" data-sx="${k}">${esc(t)}</button>`).join('')}</div></div>
    <div class="row between"><span class="eyebrow">Lifts</span><button class="xsw ${x.lifts ? 'on' : ''}" role="switch" aria-checked="${x.lifts}" data-sl="1" aria-label="Show lifts"></button></div>
    ${x.lifts ? `<div class="cap">Up to ${max} fit on this card.</div><div class="list">${all.map(r => { const on = d.pick.includes(r.name); return `<label class="li sh-li"><div class="grow"><div class="t">${esc(r.name)} ${r.pr ? '<span class="pill pr">PR</span>' : ''}</div></div><input type="checkbox" class="cbox" data-lp="${esc(r.name)}" ${on ? 'checked' : ''} ${!on && d.pick.length >= max ? 'disabled' : ''}></label>`; }).join('')}</div>` : ''}
    <button class="btn primary block" id="sh-go">Share</button></div>`; };
  let tok = 0;
  const paint = async b => { const t = ++tok; const c = await drawShare(d, o()); if (t !== tok) return; const im = b.querySelector('#sh-prev'); if (im) im.src = c.toDataURL('image/jpeg', .8); };
  const draw = b => { const keep = b.querySelector('#sh-prev'), was = keep && keep.classList.contains('story'); b.innerHTML = body(); const im = b.querySelector('#sh-prev'); if (keep && keep.src && was === im.classList.contains('story')) im.src = keep.src; paint(b); };
  openSheet('', { label: 'Share card', mount: (b, sh) => {
    draw(b);
    const save = () => { persist('jd/meta'); };
    b.addEventListener('click', e => {
      const sx = e.target.closest('[data-sx]'), sl = e.target.closest('[data-sl]');
      if (sx) { const p = S.profile.share = S.profile.share || {}, h = new Set(p.hide || []); h.has(sx.dataset.sx) ? h.delete(sx.dataset.sx) : h.add(sx.dataset.sx); p.hide = [...h]; save(); draw(b); }
      else if (e.target.closest('[data-sf]')) { const p = S.profile.share = S.profile.share || {}; p.story = !!e.target.closest('[data-sf]').dataset.sf; save(); draw(b); }
      else if (sl) { const p = S.profile.share = S.profile.share || {}; p.lifts = p.lifts === false; save(); draw(b); }
      else if (e.target.id === 'sh-go') { closeSheet(sh); shareRecap(d); }
    });
    b.addEventListener('change', e => { const lp = e.target.closest('[data-lp]'); if (!lp) return; const n = lp.dataset.lp;
      d.pick = lp.checked ? [...d.pick, n] : d.pick.filter(x => x !== n); draw(b); });
  } });
}
// Permanent Marker (Apache 2.0) for the handwriting on the Boulder card's tape; Marker Felt stands in if it can't load
let HAND_FONT;
function handFont() { return HAND_FONT || (HAND_FONT = (async () => { try { const f = new FontFace('JD Marker', 'url(fonts/permanent-marker.woff2)'); await f.load(); document.fonts.add(f); } catch (e) {} })()); }
async function shareRecap(d) {
  // Instagram and some other apps keep only the picture, so the invite link also goes on the clipboard
  let copied = false; try { navigator.clipboard.writeText(inviteText()).then(() => { copied = true; }, () => {}); } catch (e) {}
  const c = await drawShare(d);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return;
  const file = new File([blob], `jobdone-${d.w.date}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Job’s done!', text: inviteText() }); if (copied) toast('Link copied. If only the picture went through, paste it in the chat.', 5000); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- Swap: same-muscle alternatives, ranked by your own history ----------
function openSwap(ei) {
  const e = A.ex[ei], cur = exInfo(e.name), h = ix().hist;
  const names = new Set([...LIB.map(x => x.name), ...(S.customEx || []).map(x => x.name)]);
  const n = x => (h[x] || []).length + (h[x + ' (L)'] || []).length;
  const alts = [...names].map(exInfo).filter(x => x.muscle === cur.muscle && x.name !== baseName(e.name))
    .sort((a, b) => n(b.name) - n(a.name) || (b.equip === cur.equip) - (a.equip === cur.equip) || a.name.localeCompare(b.name));
  const sp = A.splitId && splitById(A.splitId), inSplit = sp && sp.ex.some(x => x.name === e.name);
  const sh = openSheet(`<div class="stack"><div><div class="eyebrow">Swap ${esc(e.name)}</div><div class="mt1 cap">Other ${plural(esc(cur.muscle.toLowerCase()), 'exercise')}, the ones you do most first.</div></div>
    ${inSplit ? `<label class="row between card tight"><span>Also change it in ${esc(sp.name)}</span><input type="checkbox" id="sw-keep" class="cbox"></label>` : ''}
    <div class="list">${alts.slice(0, 14).map(x => { const l = lastSession(x.name); return `<button class="li" data-sw="${esc(x.name)}"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.equip)}${l ? ' · last ' + esc(l.sets.filter(validSet).map(setStr).join(', ')) + ' · ' + esc(relDay(l.date)) : ''}</div></div>${I.right}</button>`; }).join('') || '<div class="empty">No other exercises for this muscle yet.</div>'}</div>
    <button class="btn block" id="sw-all">Search all exercises</button></div>`, { label: 'Swap exercise', mount: b => {
    const go = name => {
      const keep = b.querySelector('#sw-keep') && b.querySelector('#sw-keep').checked; closeSheet(sh);
      if (keep) { const x = sp.ex.find(y => y.name === e.name); if (x) { x.name = name; persist('jd/meta'); } }
      A.ex[ei] = newExEntry(name, e.sets.length, e.rest); touchA(); toast(`Swapped to ${name}${keep ? ' in ' + sp.name + ' too' : ' for today'}`);
    };
    b.querySelectorAll('[data-sw]').forEach(x => x.onclick = () => go(x.dataset.sw));
    b.querySelector('#sw-all').onclick = () => { closeSheet(sh); pickExercise(go, { title: 'Swap ' + e.name }); };
  } });
}

// ---------- Plateau alerts: no new best e1RM for 3+ weeks across 3+ sessions ----------
function plateaus() {
  return [];   // Job, 16 Oct: plateaus are normal, no alerts or change-your-weight advice anywhere.
  if (S && S.profile && S.profile.noPlateau) return [];
  const out = [], hide = UI.plHide || {}, t = today();
  for (const [name, ss] of Object.entries(ix().hist)) {
    const v = ss.filter(x => x.e1 > 0); if (v.length < 4) continue;
    if (daysBetween(v[v.length - 1].date, t) > 21) continue;
    let best = 0, at = null, since = 0;
    for (const x of v) { if (x.e1 > best * 1.01) { best = x.e1; at = x.date; since = 0; } else since++; }
    // any kind of record (heavier, more reps, more volume) also counts as progress
    const lp = ix().prs.filter(x => x.ex === name).pop(); if (lp && lp.date > at) { at = lp.date; since = v.filter(x => x.date > lp.date).length; }
    const days = daysBetween(at, t);
    if (days >= 21 && days <= 84 && since >= 3 && !(hide[name] && daysBetween(hide[name], t) < 14)) out.push({ name, weeks: Math.floor(days / 7), since, best: (v.find(x => x.date === at) || {}).top || (lp && lp.set) });
  }
  const seen = new Set();
  return out.sort((a, b) => b.weeks - a.weeks).filter(x => { const k = baseName(x.name); if (seen.has(k)) return false; seen.add(k); x.name0 = x.name; return true; });
}
const plateauTip = p => p.weeks >= 6 ? 'Try a lighter week (about 90% of your weight), then build back up.' : 'Try a new rep range for 2 weeks, like 10 to 12 reps, or a lighter week at about 90%.';
function plateauCard() {
  const ps = plateaus(); if (!ps.length) return '';
  return `<div class="card"><div class="card-h"><span class="eyebrow">Plateau alert ${infoBtn('plateau')}</span><span class="cap">no new best lately</span></div>
    <div class="list">${ps.slice(0, 3).map(p => `<div class="li"><button class="grow tl" data-a="openEx" data-name="${esc(p.name)}"><div class="t">${esc(baseName(p.name))}</div><div class="s">${plural(p.weeks, 'week')}, ${plural(p.since, 'session')} since your best (${p.best ? esc(setStr(p.best)) : '—'})</div></button><button class="mh32 cap" data-a="plHide" data-name="${esc(p.name)}">Hide</button></div>`).join('')}</div>
    <div class="mt2 cap">${esc(plateauTip(ps[0]))}</div></div>`;
}

// ---------- Monthly report ----------
const ymOf = d => d.slice(0, 7);
const monthName = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
function monthData(ym) {
  const I2 = ix(), ws = I2.ws.filter(w => !w.skipped && ymOf(w.date) === ym);
  const prev = addMonths(ym, -1), pws = I2.ws.filter(w => !w.skipped && ymOf(w.date) === prev);
  const vol = ws.reduce((a, w) => a + wVol(w), 0), pvol = pws.reduce((a, w) => a + wVol(w), 0);
  const sets = ws.reduce((a, w) => a + wSets(w), 0), prs = I2.prs.filter(p => ymOf(p.date) === ym);
  const top = {}; for (const p of prs) if (!top[p.ex] || e1(p.set) > e1(top[p.ex].set)) top[p.ex] = p;
  const wl = weightList().filter(e => ymOf(e.d) === ym);
  const mus = {}; for (const w of ws) for (const e of w.ex) { const m = exInfo(e.name).muscle; mus[m] = (mus[m] || 0) + e.sets.filter(x => x.t !== 'warm').length * (sideOf(e.name) ? .5 : 1); }
  const st = Object.entries(S.steps || {}).filter(([d]) => ymOf(d) === ym).map(([, n]) => n);
  const days = new Set(ws.map(w => w.date)).size;
  const badges = badgeList().filter(b => b.at && ymOf(b.at) === ym);
  return { ym, ws, pws, vol, pvol, sets, prs, top: Object.values(top).sort((a, b) => e1(b.set) - e1(a.set)), w0: wl[0], w1: wl[wl.length - 1], musL: Object.entries(mus).sort((a, b) => b[1] - a[1]), steps: st.length ? Math.round(st.reduce((a, b) => a + b, 0) / st.length) : 0, days, badges };
}
function addMonths(ym, k) { const d = new Date(+ym.slice(0, 4), +ym.slice(5) - 1 + k, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function reportMonths() { const s = new Set(ix().ws.filter(w => !w.skipped).map(w => ymOf(w.date))); return [...s].sort().reverse(); }
function showMonth(ym) {
  const d = monthData(ym), old = document.getElementById('recap'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'recap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Monthly report');
  const dv = d.pvol ? (d.vol - d.pvol) / d.pvol : null, mx = d.musL.length ? d.musL[0][1] : 1;
  const wd = d.w0 && d.w1 && d.w0 !== d.w1 ? d.w1.w - d.w0.w : null;
  UI.seenReport = UI.seenReport && UI.seenReport > ym ? UI.seenReport : ym; lsSave();
  el.innerHTML = `<div class="rc-body" style="--split:var(--accent);--ink:var(--accent-ink)">
    <div class="rc-hero"><div class="rc-date">Monthly report</div><h1>${esc(monthName(ym))}</h1>
      <div class="rc-tags"><span class="rc-tag">${d.ws.length} workout${d.ws.length === 1 ? '' : 's'}</span>${d.prs.length ? `<span class="rc-tag pr">${d.top.length} PR${d.top.length === 1 ? '' : 's'}</span>` : ''}</div></div>
    <div class="card rc-vol"><div class="eyebrow">Volume</div><div class="rc-big num">${dvol(d.vol)}<span class="unit">${U()}</span></div>
      ${d.pvol ? `<div class="rc-cmp"><div class="rc-bar"><span>${esc(monthName(ym).split(' ')[0])}</span><i><b style="width:${Math.round(d.vol / Math.max(d.vol, d.pvol) * 100)}%"></b></i><em class="num">${dvol(d.vol)}</em></div>
      <div class="rc-bar was"><span>${esc(monthName(addMonths(ym, -1)).split(' ')[0])}</span><i><b style="width:${Math.round(d.pvol / Math.max(d.vol, d.pvol) * 100)}%"></b></i><em class="num">${dvol(d.pvol)}</em></div>
      <div class="cap ${dv >= 0 ? 'c-pos' : ''}">${Math.abs(Math.round(dv * 100))}% ${dv >= 0 ? 'more' : 'less'} volume than last month</div></div>` : ''}</div>
    <div class="card"><div class="kpis rc-k"><div class="kpi"><b>${d.days}</b><span>days trained</span></div><div class="kpi"><b>${d.sets}</b><span>sets</span></div><div class="kpi"><b>${wd == null ? '—' : bw(wd, true)}</b><span>${U()} weight</span></div><div class="kpi"><b>${d.steps ? n0(d.steps) : '—'}</b><span>avg steps</span></div></div></div>
    ${d.top.length ? `<div class="card"><div class="mb2 eyebrow">Personal records</div>${d.top.slice(0, 6).map(p => `<div class="rc-pr"><span class="rc-medal" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 2l3 7M16 2l-3 7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="15" r="6" fill="#F4B728"/></svg></span><div class="grow"><div class="t">${esc(p.ex)}</div><div class="cap">${esc(fmtDate(p.date))} · ${esc(p.types.join(' · '))}</div></div><b class="num">${setStr(p.set)}</b></div>`).join('')}</div>` : ''}
    ${d.musL.length ? `<div class="card"><div class="mb3 eyebrow">Sets by muscle</div>${d.musL.slice(0, 6).map(([m, n]) => `<div class="rc-mu"><span>${esc(m)}</span><i><b style="width:${Math.round(n / mx * 100)}%"></b></i><em class="num">${Math.round(n)}</em></div>`).join('')}</div>` : ''}
    ${d.badges.length ? `<div class="card"><div class="mb3 eyebrow">Badges earned</div><div class="badges">${d.badges.map(badgeHTML).join('')}</div></div>` : ''}
    <div class="grid2"><button class="btn block" id="rc-share">Share</button><button class="btn primary block" id="rc-done">Done</button></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  el.querySelector('#rc-done').onclick = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); };
  el.querySelector('#rc-share').onclick = () => shareMonth(d);
}
async function shareMonth(d) {
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const F = (wt, px) => `${wt} ${px}px -apple-system, system-ui, sans-serif`;
  g.fillStyle = v('--bg') || '#EFEBE5'; g.fillRect(0, 0, W, H);
  g.fillStyle = v('--accent') || '#6C3FD6'; g.fillRect(0, 0, W, 330);
  g.fillStyle = v('--accent-ink') || '#fff'; g.font = F(700, 40); g.fillText('MONTHLY REPORT', 72, 110); g.font = F(800, 120); g.fillText(monthName(d.ym), 64, 250);
  const st = [[String(d.ws.length), 'workouts'], [dvol(d.vol), U() + ' lifted'], [String(d.top.length), 'PRs'], [d.w0 && d.w1 && d.w0 !== d.w1 ? bw(d.w1.w - d.w0.w, true) : '—', U() + ' weight']];
  st.forEach(([a, b], i) => { const x = 56 + i * 246; g.fillStyle = v('--surface-solid') || '#fff'; g.beginPath(); g.roundRect(x, 380, 226, 190, 36); g.fill(); g.fillStyle = v('--text') || '#222'; g.font = F(800, 58); g.fillText(a, x + 26, 470); g.fillStyle = v('--text2') || '#666'; g.font = F(600, 32); g.fillText(b, x + 26, 528); });
  let y = 670; g.font = F(700, 34); g.fillStyle = v('--text2') || '#666'; g.fillText('TOP LIFTS', 72, y); y += 70;
  for (const p of d.top.slice(0, 7)) { g.fillStyle = v('--text') || '#222'; g.font = F(600, 44); g.fillText(p.ex.length > 26 ? p.ex.slice(0, 25) + '…' : p.ex, 72, y); g.textAlign = 'right'; g.fillText(setStr(p.set), W - 72, y); g.textAlign = 'left'; y += 72; }
  g.fillStyle = v('--muted') || '#999'; g.font = F(800, 36); g.fillText('Job’s Done', 72, H - 72);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return;
  const file = new File([blob], `jobdone-${d.ym}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Job’s Done ' + monthName(d.ym) }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function reportCard() {
  const t = today(), last = addMonths(ymOf(t), -1);
  if (+t.slice(8) > 10 || !reportMonths().includes(last) || (UI.seenReport && UI.seenReport >= last)) return '';
  return `<button class="card tl full rc-ready" data-a="month" data-k="${last}"><div class="row between"><div><div class="eyebrow">Monthly report</div><div class="mt1 f17 fw6">Your ${esc(monthName(last).split(' ')[0])} report is ready</div></div>${I.right}</div></button>`;
}

// ---------- Badges ----------
const BADGES = [
  ...[1, 10, 25, 50, 100, 150, 200, 300].map(n => ({ k: 'w' + n, ic: String(n), t: n === 1 ? 'First workout' : n + ' workouts', g: 'Workouts', n })),
  ...[4, 8, 12, 26, 52].map(n => ({ k: 's' + n, ic: n + 'w', t: n + '-week streak', g: 'Streaks', n })),
  ...[60, 80, 100, 120, 150].map(n => ({ k: 'h' + n, ic: n, t: 'First ' + n + ' kg set', g: 'Heavy', n })),
  ...[10, 100, 500, 1000].map(n => ({ k: 'v' + n, ic: n + 't', t: n + ' tonnes lifted', g: 'Volume', n })),
  ...[10, 50, 100, 250].map(n => ({ k: 'p' + n, ic: n, t: n + ' PRs', g: 'Records', n })),
  ...[5, 10, 15].map(n => ({ k: 'b' + n, ic: '−' + n, t: n + ' kg down', g: 'Cut', n })),
  { k: 'st7', ic: '7d', t: 'Step goal 7 days running', g: 'Steps', n: 7 },
];
function badgeList() {
  const ws = ix().ws.filter(w => !w.skipped), at = {}, prog = {};
  const hit = (k, d) => { if (!at[k]) at[k] = d; };
  // workouts, heavy sets, volume
  let vol = 0, heavy = 0;
  ws.forEach((w, i) => { BADGES.filter(b => b.g === 'Workouts' && i + 1 >= b.n).forEach(b => hit(b.k, w.date));
    for (const e of w.ex) for (const s of e.sets) if (validSet(s)) heavy = Math.max(heavy, s.w);
    BADGES.filter(b => b.g === 'Heavy' && heavy >= b.n).forEach(b => hit(b.k, w.date));
    vol += wVol(w); BADGES.filter(b => b.g === 'Volume' && vol >= b.n * 1000).forEach(b => hit(b.k, w.date)); });
  prog.Workouts = ws.length; prog.Heavy = heavy; prog.Volume = vol / 1000;
  // weekly streaks
  const weeks = [...new Set(ws.map(w => mondayOf(w.date)))].sort(); let run = 0, best = 0;
  const rw = new Set(S.profile.restWeeks || []), joined = (a, b) => { for (let x = addDays(a, 7); x < b; x = addDays(x, 7)) if (!rw.has(x)) return false; return true; };
  weeks.forEach((m, i) => { run = i && joined(weeks[i - 1], m) ? run + 1 : 1; best = Math.max(best, run); const last = ws.filter(w => mondayOf(w.date) === m).pop(); BADGES.filter(b => b.g === 'Streaks' && run >= b.n).forEach(b => hit(b.k, last.date)); });
  prog.Streaks = best;
  // PRs (sessions with a record)
  const prs = ix().prs; prs.forEach((p, i) => BADGES.filter(b => b.g === 'Records' && i + 1 >= b.n).forEach(b => hit(b.k, p.date))); prog.Records = prs.length;
  // weight down from the first entry
  const wl = weightList().filter(e => e.src !== 'estimated'); let down = 0; if (wl.length) for (const e of wl) { down = Math.max(down, wl[0].w - e.w); BADGES.filter(b => b.g === 'Cut' && wl[0].w - e.w >= b.n).forEach(b => hit(b.k, e.d)); } prog.Cut = down;
  // steps: goal hit 7 days in a row
  const goal = S.profile.stepGoal || 10000; let sr = 0, sbest = 0, prev = null;
  for (const d of Object.keys(S.steps || {}).sort()) { sr = S.steps[d] >= goal ? (prev && daysBetween(prev, d) === 1 ? sr + 1 : 1) : 0; prev = d; sbest = Math.max(sbest, sr); if (sr >= 7) hit('st7', d); } prog.Steps = sbest;
  return BADGES.map(b => ({ ...b, at: at[b.k] || null, p: Math.min(1, (prog[b.g] || 0) / b.n) }));
}
const badgeHTML = b => `<div class="badge ${b.at ? 'on' : ''}" title="${esc(b.t)}"><div class="bd-ic" style="--p:${b.at ? 1 : b.p.toFixed(3)}"><span>${esc(String(b.ic))}</span></div><div class="bd-t">${esc(b.t)}</div><div class="bd-s">${b.at ? esc(fmtDate(b.at)) : Math.round(b.p * 100) + '%'}</div></div>`;
function badgesCard() {
  const l = badgeList(), got = l.filter(b => b.at).sort((a, b) => a.at < b.at ? 1 : -1), next = l.filter(b => !b.at).sort((a, b) => b.p - a.p).slice(0, 3);
  return `<div class="card"><div class="card-h"><span class="eyebrow">Badges</span><span class="cap">${got.length} of ${l.length}</span></div>
    <div class="badges">${got.slice(0, 8).map(badgeHTML).join('')}</div>
    ${next.length ? `<div class="mt3 mb2 cap">Up next</div><div class="badges">${next.map(badgeHTML).join('')}</div>` : ''}
    ${got.length > 8 ? `<button class="mt2 link" data-a="allBadges">See all badges</button>` : ''}</div>`;
}
function openBadges() {
  const l = badgeList(), gs = [...new Set(l.map(b => b.g))];
  openSheet(`<div class="stack"><div class="eyebrow">Badges</div>${gs.map(g => `<div><div class="mb2 cap">${esc(g)}</div><div class="badges">${l.filter(b => b.g === g).map(badgeHTML).join('')}</div></div>`).join('')}</div>`, { label: 'Badges' });
}

// ---------- Optional body measurements and progress photos ----------
const MEAS = [['waist', 'Waist'], ['chest', 'Chest'], ['arms', 'Arms'], ['thighs', 'Thighs'], ['hips', 'Hips']];
function measCard() {
  const m = S.meas || {}, ds = Object.keys(m).sort(), f = ds[0] && m[ds[0]], l = ds.length && m[ds[ds.length - 1]];
  const rows = MEAS.filter(([k]) => l && l[k]).map(([k, n]) => { const first = ds.map(d => m[d][k]).find(Boolean); const dd = l[k] - first; return `<tr><td>${n}</td><td class="r num">${trim(l[k])} cm</td><td class="r num ${dd < 0 ? 'c-pos' : 'sec'}">${ds.length > 1 && Math.abs(dd) > 0.05 ? (dd > 0 ? '+' : '−') + trim(Math.abs(Math.round(dd * 10) / 10)) : ''}</td></tr>`; }).join('');
  return `<div class="card"><div class="card-h"><span class="eyebrow">Measurements</span><span class="cap">optional</span></div>
    ${rows ? `<table class="tbl"><tr><th>Area</th><th class="r">Latest</th><th class="r">Since ${esc(fmtDate(ds[0]))}</th></tr>${rows}</table>` : `<div class="cap">The scale can hide fat loss while you keep muscle. Add a tape measurement now and then if you like. Nothing here is required.</div>`}
    <div class="mt3 row g4"><button class="link" data-a="meas">${rows ? 'Add measurements' : 'Add measurements'}</button><button class="link" data-a="photos">Progress photos</button></div></div>`;
}
function openMeas() {
  const t = today(), cur = (S.meas || {})[t] || {};
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Measurements · optional</div><div class="cap">Fill in any you like and leave the rest blank. In centimetres.</div>
    <div class="field"><label for="ms-d">Date</label><input class="input" type="date" id="ms-d" value="${t}" max="${t}"></div>
    <div class="sgrp">${MEAS.map(([k, n]) => `<label class="xr"><span class="grow">${n}</span><input class="xr-in num" inputmode="decimal" id="ms-${k}" value="${cur[k] || ''}" placeholder="—"><span class="xr-u">cm</span></label>`).join('')}</div>
    <button class="btn primary block" id="ms-s">Save</button></div>`, { label: 'Measurements', mount: b => {
    b.querySelector('#ms-s').onclick = () => {
      const d = b.querySelector('#ms-d').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      const e = {}; for (const [k] of MEAS) { const v = parseFloat(b.querySelector('#ms-' + k).value); if (v > 0) e[k] = Math.round(v * 10) / 10; }
      S.meas = S.meas || {}; if (Object.keys(e).length) S.meas[d] = e; else delete S.meas[d];
      persist('jd/meta'); closeSheet(sh); rerender(); toast('Measurements saved');
    };
  } });
}
// Photos are stored one document each (photos/<date>-<n>), shrunk to 720px JPEG, and loaded only when opened.
let PHOTOS = null;
async function loadPhotos() {
  if (PHOTOS) return PHOTOS;
  if (!DB) return PHOTOS = {};
  try { const r = await DB.collection('photos').get(); PHOTOS = {}; r.docs.forEach(d => { PHOTOS[d.id] = d.data(); }); } catch (e) { PHOTOS = null; throw e; }
  return PHOTOS;
}
function shrink(file, max = 720) {
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', .72)); }; img.onerror = no; img.src = URL.createObjectURL(file); });
}
async function openPhotos() {
  if (!DB) { toast('Sign in to keep progress photos in your account.'); return; }
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Progress photos · optional</div><div id="ph-body" class="cap">Loading…</div>
    <label class="btn primary block" for="ph-in">Add a photo</label><input type="file" id="ph-in" accept="image/*" hidden>
    <div class="cap">Photos are private to your account. Same spot, same light and same pose make the comparison fair.</div></div>`, { label: 'Progress photos', mount: async b => {
    const draw = () => {
      const ks = Object.keys(PHOTOS).sort(), first = ks[0], last = ks[ks.length - 1];
      b.querySelector('#ph-body').innerHTML = !ks.length ? 'No photos yet.' : `${ks.length > 1 ? `<div class="ph-cmp"><figure><img src="${PHOTOS[first].img}" alt=""><figcaption>${esc(fmtDate(PHOTOS[first].d, { y: true }))}${PHOTOS[first].w ? ' · ' + bw(PHOTOS[first].w) + ' ' + U() : ''}</figcaption></figure><figure><img src="${PHOTOS[last].img}" alt=""><figcaption>${esc(fmtDate(PHOTOS[last].d, { y: true }))}${PHOTOS[last].w ? ' · ' + bw(PHOTOS[last].w) + ' ' + U() : ''}</figcaption></figure></div>` : ''}
        <div class="ph-grid">${ks.slice().reverse().map(k => `<button class="ph" data-ph="${k}"><img src="${PHOTOS[k].img}" alt="Photo from ${esc(fmtDate(PHOTOS[k].d))}"><span>${esc(fmtDate(PHOTOS[k].d))}</span></button>`).join('')}</div>`;
      b.querySelectorAll('[data-ph]').forEach(x => x.onclick = () => { const k = x.dataset.ph; confirmSheet({ title: 'Delete this photo?', body: fmtDate(PHOTOS[k].d, { y: true }), ok: 'Delete', danger: true, onOk: async () => { try { await DB.doc('photos/' + k).delete(); delete PHOTOS[k]; draw(); toast('Photo deleted'); } catch (e) { toast('Couldn’t delete it. Check your signal and try again.'); } } }); });
    };
    try { await loadPhotos(); draw(); } catch (e) { b.querySelector('#ph-body').textContent = 'Couldn’t load photos. Check your signal.'; }
    b.querySelector('#ph-in').onchange = async ev => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      try { const img = await shrink(f), d = today(), lw = weightOn(d); let k = d, i = 1; while (PHOTOS && PHOTOS[k]) k = d + '-' + (++i);
        const body = { img, d, w: lw ? lw.w : null }; await DB.doc('photos/' + k).set(body); PHOTOS = PHOTOS || {}; PHOTOS[k] = body; draw(); toast('Photo saved'); }
      catch (e) { toast('Couldn’t save the photo. Check your signal and try again.'); }
      ev.target.value = '';
    };
  } });
}

// ---------- plate loader ----------
// Bar with sleeves; plates slide on from the ends, mirrored on both sides. Drag (or tap) plates from the tray.
const PLATE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>';
const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
const PLATE_COL = { 25: '#D8312B', 20: '#2F62C9', 15: '#E8B524', 10: '#2E8B4E', 5: '#DCD8CE', 2.5: '#7A7F88', 1.25: '#9EA3AA', 45: '#2F62C9', 35: '#E8B524' };
const plateH = w => { const m = U() === 'lb' ? 45 : 25; return Math.round(46 + 104 * Math.sqrt(w / m)); };
// Weight entry starts on the plate loader; "Dial / keypad" switches to the number pad.
function openSetPlates(ei, si) {
  const e = A.ex[ei], s = e.sets[si];
  openPlates(s.w == null ? 0 : +dw(s.w), v => { s.w = Math.round(toKg(v) * 1000) / 1000; s.ed = true; touchA(); openKeypad(ei, si, 'r'); },
    { title: `${e.name} · set ${si + 1}`, alt: () => openKeypad(ei, si, 'w') });
}
function openPlates(target, onUse, o = {}) {
  const den = PLATES[U()], bars = U() === 'lb' ? [45, 35, 25, 0] : [20, 15, 10, 0];
  let bar = S.profile.barW != null ? S.profile.barW : (U() === 'lb' ? 45 : 20); if (U() === 'lb' && S.profile.barW === 0) bar = 0;
  let side = [], fresh = -1;
  const total = () => Math.round((bar + 2 * side.reduce((a, b) => a + b, 0)) * 1000) / 1000;
  const auto = t => { side = []; let r = Math.max(0, (t - bar) / 2); for (const p of den) while (r >= p - 1e-9) { side.push(p); r = Math.round((r - p) * 1000) / 1000; } return r; };
  let left = target ? auto(target) : 0;
  const custom = () => (S.profile.customPlates || []).filter(x => x > 0);
  const svg = () => {
    const W = 340, cx = W / 2, H = 170, cy = H / 2;
    let xR = cx + 62, xL = cx - 62, out = '';
    // Heavy loads: squeeze plate thickness and gaps so every plate stays on the sleeve (Job, 15 Oct: 330 kg overflowed).
    const pw = p => p >= (U() === 'lb' ? 25 : 10) ? 15 : 10, need = side.reduce((a, p) => a + pw(p) + 2, 0), k = Math.min(1, (W - 22 - xR) / (need || 1));
    side.forEach((p, i) => { const h = plateH(p), w = pw(p) * k, col = PLATE_COL[p] || 'var(--accent)', nw = i === fresh ? ' new' : '';
      out += `<g class="pl R${nw}" data-i="${i}"><rect x="${xR}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${Math.min(4, w / 3)}" fill="${col}" stroke="rgba(0,0,0,.25)"/><rect x="${xR + 2 * k}" y="${cy - h / 2 + 4}" width="${3 * k}" height="${h - 8}" rx="1.5" fill="#fff" opacity=".25"/></g>`;
      out += `<g class="pl L${nw}" data-i="${i}"><rect x="${xL - w}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${Math.min(4, w / 3)}" fill="${col}" stroke="rgba(0,0,0,.25)"/><rect x="${xL - w + 2 * k}" y="${cy - h / 2 + 4}" width="${3 * k}" height="${h - 8}" rx="1.5" fill="#fff" opacity=".25"/></g>`;
      xR += w + 2 * k; xL -= w + 2 * k; });
    return `<svg viewBox="0 0 ${W} ${H}" class="barsvg"><rect x="8" y="${cy - 5}" width="${W - 16}" height="10" rx="5" fill="#9BA1A8"/><rect x="${cx - 60}" y="${cy - 4}" width="120" height="8" fill="#7E848C"/><rect x="${cx - 64}" y="${cy - 14}" width="6" height="28" rx="2" fill="#6B7178"/><rect x="${cx + 58}" y="${cy - 14}" width="6" height="28" rx="2" fill="#6B7178"/>${out}</svg>`;
  };
  const tray = () => [...den, ...custom()].map(p => `<button class="plate-chip" data-p="${p}" style="--pc:${PLATE_COL[p] || 'var(--accent)'};--ph:${Math.max(34, plateH(p) * .42)}px"><i></i><b>${trim(p)}</b></button>`).join('');
  const sh = openSheet(`<div class="g3 stack"><div class="row between"><div><div class="eyebrow">${esc(o.title || 'Plate loader')}</div><div class="big num" id="pl-tot">${trim(total())}<span class="unit">${U()}</span></div></div><button class="btn sm" id="pl-clear">Clear</button></div>
    <div class="cap" id="pl-msg"></div>
    <div class="bar-wrap" id="pl-bar"></div>
    <div class="field"><span class="lbl">Bar</span><div class="seg" id="pl-barw">${bars.map(b => `<button data-b="${b}" class="${b === bar ? 'on' : ''}">${b ? b + ' ' + U() : 'Plates only'}</button>`).join('')}</div></div>
    <div><span class="lbl">Drag a plate onto the bar, or tap it. Tap a plate on the bar to take it off.</span><div class="plate-tray" id="pl-tray">${tray()}</div></div>
    <div class="g2 row"><input class="flex1 input num" id="pl-cw" inputmode="decimal" placeholder="Custom plate (${U()})"><button class="btn" id="pl-cadd">Add plate</button></div>
    <div class="g2 row"><input class="flex1 input num" id="pl-t" inputmode="decimal" placeholder="Target total" value="${target ? trim(target) : ''}"><button class="btn" id="pl-auto">Load it</button></div>
    ${onUse ? `<div class="g2 row">${o.alt ? `<button class="btn" id="pl-alt" style="flex:none">Dial / keypad</button>` : ''}<button class="flex1 btn primary block" id="pl-use">Use <span id="pl-use-v">${trim(total())}</span> ${U()}${o.useLabel ? ', ' + esc(o.useLabel) : ''}</button></div>` : ''}
  </div>`, { label: 'Plate loader', mount: b => {
    const draw = () => {
      b.querySelector('#pl-bar').innerHTML = svg(); fresh = -1;
      b.querySelector('#pl-tot').firstChild.textContent = trim(total());
      const u = b.querySelector('#pl-use-v'); if (u) u.textContent = trim(total());
      b.querySelector('#pl-msg').textContent = side.length ? `Each side: ${side.map(trim).join(' + ')} ${U()}${left > 0.001 ? ` · closest to your ${trim(target)} ${U()} with these plates` : ''}` : (bar ? `Empty ${bar} ${U()} bar` : 'Add plates to start');
    };
    const add = p => { side.push(p); side.sort((a, c) => c - a); fresh = side.lastIndexOf(p); left = 0; buzz(8); clank(p / 25); draw(); };
    draw();
    b.querySelector('#pl-bar').onclick = ev => { const g = ev.target.closest('.pl'); if (!g) return; side.splice(+g.dataset.i, 1); left = 0; buzz(5); draw(); };
    b.querySelector('#pl-clear').onclick = () => { side = []; left = 0; draw(); };
    b.querySelector('#pl-barw').onclick = ev => { const x = ev.target.closest('[data-b]'); if (!x) return; bar = +x.dataset.b; S.profile.barW = bar; persist('jd/meta'); b.querySelectorAll('#pl-barw button').forEach(y => y.classList.toggle('on', y === x)); draw(); };
    b.querySelector('#pl-auto').onclick = () => { const t = parseFloat(b.querySelector('#pl-t').value); if (!(t >= 0)) return; left = auto(t); fresh = -2; draw(); b.querySelectorAll('#pl-bar .pl').forEach((g, i) => { g.classList.add('new'); g.style.animationDelay = (Math.floor(i / 2) * .09) + 's'; }); side.forEach((p, i) => clank(p / 25, i * .09)); };
    b.querySelector('#pl-cadd').onclick = () => { const v = parseFloat(b.querySelector('#pl-cw').value); if (!(v > 0 && v < 100)) { toast('Enter a plate weight'); return; } const c = new Set(custom()); c.add(v); S.profile.customPlates = [...c].sort((a, d) => d - a); persist('jd/meta'); b.querySelector('#pl-tray').innerHTML = tray(); b.querySelector('#pl-cw').value = ''; add(v); };
    const u = b.querySelector('#pl-use'); if (u) u.onclick = () => { closeSheet(sh); onUse(total()); };
    const al = b.querySelector('#pl-alt'); if (al) al.onclick = () => { closeSheet(sh); o.alt(); };
    // drag from tray: a ghost plate follows the finger; drop over the bar to load it
    const trayEl = b.querySelector('#pl-tray'), barEl = b.querySelector('#pl-bar');
    let drag = null;
    trayEl.addEventListener('pointerdown', ev => {
      const chip = ev.target.closest('[data-p]'); if (!chip) return;
      drag = { p: +chip.dataset.p, x0: ev.clientX, y0: ev.clientY, moved: false, ghost: null };
      chip.setPointerCapture(ev.pointerId);
    });
    trayEl.addEventListener('pointermove', ev => {
      if (!drag) return; const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 8) return;
      if (!drag.moved) { drag.moved = true; const g = document.createElement('div'); g.className = 'plate-ghost'; g.style.cssText = `--pc:${PLATE_COL[drag.p] || 'var(--accent)'};--ph:${plateH(drag.p) * .7}px`; g.textContent = trim(drag.p); document.body.appendChild(g); drag.ghost = g; }
      drag.ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      const r = barEl.getBoundingClientRect(); barEl.classList.toggle('hot', ev.clientY > r.top - 30 && ev.clientY < r.bottom + 30);
    });
    const end = ev => {
      if (!drag) return; const d0 = drag; drag = null; barEl.classList.remove('hot');
      if (d0.ghost) d0.ghost.remove();
      if (!d0.moved) { add(d0.p); return; }
      const r = barEl.getBoundingClientRect(); if (ev.clientY > r.top - 30 && ev.clientY < r.bottom + 30) add(d0.p);
    };
    trayEl.addEventListener('pointerup', end); trayEl.addEventListener('pointercancel', () => { if (drag && drag.ghost) drag.ghost.remove(); drag = null; barEl.classList.remove('hot'); });
  } });
}

// ---------- keypad ----------
function openKeypad(ei, si, f) {
  const e = A.ex[ei], s = e.sets[si];
  let buf = null; // null = untouched
  const cur = () => buf != null ? buf : (f === 'w' ? (s.w == null ? '' : dw(s.w)) : (s.r == null ? '' : String(s.r)));
  const q = f === 'w' ? (U() === 'lb' ? [-5, 5, -2.5, 2.5] : [-2.5, 2.5, -1.25, 1.25]) : [-1, 1, -2, 2];
  // scale-style dial: weight in 1.25 kg / 2.5 lb steps, reps in 1s
  const D = f === 'w' ? { step: U() === 'lb' ? 2.5 : 1.25, every: U() === 'lb' ? 4 : 8, px: 12 } : { step: 1, every: 5, px: 24 };
  D.n = Math.round(Math.max(f === 'w' ? (U() === 'lb' ? 400 : 180) : 40, (parseFloat(cur()) || 0) * 1.5) / D.step) + 1;
  const dialHTML = () => { let t = ''; for (let i = 0; i < D.n; i++) { const m = i % D.every === 0; t += `<i class="${m ? 'm' : ''}">${m ? `<b>${trim(i * D.step)}</b>` : ''}</i>`; } return `<div class="rel"><div class="ruler" id="kp-dial" style="--tw:${D.px}px"><div class="ruler-in">${t}</div></div><span class="ruler-mark"></span></div>`; };
  const html = () => `<div class="g4 stack"><div class="row between"><div><div class="cap">${esc(e.name)} · set ${si + 1}</div><div class="big" id="kp-val">${esc(cur() || '–')}<span class="unit">${f === 'w' ? U() : 'reps'}</span></div></div>${f === 'w' ? `<button class="btn sm" data-k="plates" style="margin-right:8px">${PLATE_ICON} Plates</button>` : ''}<div class="seg" style="width:130px"><button class="${f === 'w' ? 'on' : ''}" data-kf="w">${U()}</button><button class="${f === 'r' ? 'on' : ''}" data-kf="r">reps</button></div></div>
    ${dialHTML()}
    <div class="keys">
      ${['1', '2', '3'].map(k => `<button data-k="${k}">${k}</button>`).join('')}<button class="q" data-q="${q[0]}">${q[0]}</button>
      ${['4', '5', '6'].map(k => `<button data-k="${k}">${k}</button>`).join('')}<button class="q" data-q="${q[1]}">+${q[1]}</button>
      ${['7', '8', '9'].map(k => `<button data-k="${k}">${k}</button>`).join('')}<button class="q" data-q="${q[2]}">${q[2]}</button>
      <button data-k="." ${f === 'r' ? 'disabled class="dim"' : ''}>.</button><button data-k="0">0</button><button data-k="del" aria-label="Delete">⌫</button><button class="q" data-q="${q[3]}">+${q[3]}</button>
      <button class="span2 q" data-k="next">${f === 'w' ? 'Reps →' : 'Next set →'}</button><button class="span2 done" data-k="done">Done</button>
    </div></div>`;
  const commit = () => {
    if (buf == null) return;
    const v = parseFloat(buf);
    if (f === 'w') s.w = isNaN(v) ? null : Math.round(toKg(v) * 1000) / 1000; else s.r = isNaN(v) ? null : Math.round(v);
    s.ed = true; buf = null;
  };
  const sh = openSheet(html(), {
    label: 'Number pad',
    onClose: () => { commit(); touchA(); },
    mount: (b) => {
      const r = b.querySelector('#kp-dial'), inner = r.firstElementChild;
      let quiet = 0, lastI = null, raf = null;
      const show = () => { const d = b.querySelector('#kp-val'); if (d) d.firstChild.textContent = cur() || '–'; };
      const dialTo = () => { const i = Math.max(0, Math.min(D.n - 1, Math.round((parseFloat(cur()) || 0) / D.step))); lastI = i; quiet = performance.now() + 300; r.scrollLeft = i * D.px; };
      requestAnimationFrame(() => { inner.style.padding = `0 ${r.clientWidth / 2 - D.px / 2}px`; dialTo(); });
      r.addEventListener('scroll', () => {
        if (raf || performance.now() < quiet) return;
        raf = requestAnimationFrame(() => { raf = null; const i = Math.round(r.scrollLeft / D.px); if (i !== lastI) { lastI = i; const v = i * D.step; buf = f === 'w' ? trim(v) : String(v); show(); buzz(3); SOUNDS.tick(); } });
      }, { passive: true });
      b.onclick = ev => {
        const k = ev.target.closest('[data-k]'), qq = ev.target.closest('[data-q]'), kf = ev.target.closest('[data-kf]');
        if (kf) { commit(); closeSheet(sh); openKeypad(ei, si, kf.dataset.kf); return; }
        if (qq) { const base = parseFloat(cur()) || 0; const nv = Math.max(0, base + parseFloat(qq.dataset.q)); buf = f === 'w' ? trim(nv) : String(Math.round(nv)); buzz(5); }
        else if (k) {
          const key = k.dataset.k;
          if (key === 'done') { closeSheet(sh); return; }
          if (key === 'plates') { commit(); closeSheet(sh); openSetPlates(ei, si); return; }
          if (key === 'next') { commit(); closeSheet(sh); if (f === 'w') openKeypad(ei, si, 'r'); else if (si + 1 < e.sets.length) openKeypad(ei, si + 1, 'w'); return; }
          if (key === 'del') buf = (buf == null ? cur() : buf).slice(0, -1);
          else { if (buf == null) buf = ''; if (key === '.' && buf.includes('.')) return; if (buf.length < 6) buf += key; }
        }
        show(); dialTo();
      };
    },
  });
}

// ---------- weigh-in ----------
function openWeighIn(date, prompt) {
  date = date || today();
  const ex = S.weights[date];
  const base = ex ? ex.w : (latestWeight() || { w: 70 }).w;
  const toD = kg => U() === 'lb' ? Math.round(kg * LB * 10) / 10 : Math.round(kg * 10) / 10;
  let val = toD(base);
  const lo = Math.max(20, Math.floor(val - 15)), hi = Math.ceil(val + 15);
  const n = Math.round((hi - lo) * 10) + 1;
  let ticks = ''; for (let i = 0; i < n; i++) { const v = lo + i / 10; const m = i % 10 === 0; ticks += `<i class="${m ? 'm' : ''}">${m ? `<b>${Math.round(v)}</b>` : ''}</i>`; }
  const isToday = date === today();
  const sh = openSheet(`<div class="g4 stack">
    <div><div class="eyebrow">${isToday ? 'Morning weigh-in' : 'Weight entry'}</div>${isToday ? '' : `<input class="mt2 input" type="date" id="wi-date" value="${date}">`}</div>
    <div class="row between"><button class="f22 icon-btn" data-wd="-1" aria-label="Decrease by 0.1" style="background:var(--surface)">−</button><div class="tc big" id="wi-val">${val.toFixed(1)}<span class="unit">${U()}</span></div><button class="f22 icon-btn" data-wd="1" aria-label="Increase by 0.1" style="background:var(--surface)">+</button></div>
    <div class="rel"><div class="ruler" id="wi-ruler"><div class="ruler-in">${ticks}</div></div><span class="ruler-mark"></span></div>
    <button class="btn primary block" id="wi-save">Save</button>
    ${prompt ? `<button class="btn ghost block" id="wi-skip">Skip today</button>` : ex ? `<button class="btn ghost block danger" id="wi-del">Delete this entry</button>` : `<button class="btn ghost block" data-a="closeSheet">Cancel</button>`}
  </div>`, {
    label: 'Weigh-in',
    onClose: () => { if (prompt) { UI.lastPrompt = today(); lsSave(); } },
    mount: (b) => {
      const r = b.querySelector('#wi-ruler'), inner = b.querySelector('.ruler-in');
      const setPad = () => { const p = r.clientWidth / 2 - 6; inner.style.padding = `0 ${p}px`; };
      const show = () => { b.querySelector('#wi-val').firstChild.textContent = val.toFixed(1); };
      const scrollTo = (smooth) => r.scrollTo({ left: Math.round((val - lo) * 10) * 12, behavior: smooth ? 'smooth' : 'auto' });
      requestAnimationFrame(() => { setPad(); scrollTo(false); });
      let raf = null, lastI = null;
      r.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; const i = Math.round(r.scrollLeft / 12); if (i !== lastI) { lastI = i; val = Math.round((lo + i / 10) * 10) / 10; show(); buzz(3); SOUNDS.tick(); } }); }, { passive: true });
      b.querySelectorAll('[data-wd]').forEach(x => x.onclick = () => { val = Math.round((val + 0.1 * x.dataset.wd) * 10) / 10; show(); scrollTo(true); });
      b.querySelector('#wi-save').onclick = () => {
        const d = (b.querySelector('#wi-date') || {}).value || date;
        const kg = Math.round(toKg(val) * 100) / 100;
        const prev = weightOn(addDays(d, -1));
        if (d !== date && S.weights[date] && ex) delete S.weights[date];
        S.weights[d] = { w: kg, src: 'manual' };
        UI.lastPrompt = today(); persist('jd/weights'); closeSheet(sh); rerender();
        const a7 = avg7(d);
        toast(`<b class="num">${bw(kg)} ${U()}</b> · ${prev ? wdelta(kg, prev.w) + ' vs last' : 'logged'} · 7-day avg <span class="num">${a7 ? bw(a7) : '—'}</span>`, 3200);
      };
      const sk = b.querySelector('#wi-skip'); if (sk) sk.onclick = () => { closeSheet(sh); };
      const dl = b.querySelector('#wi-del'); if (dl) dl.onclick = () => { delete S.weights[date]; persist('jd/weights'); closeSheet(sh); rerender(); toast('Entry deleted'); };
    },
  });
}

// ---------- steps ----------
function parseStepText(txt) {
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const L = line.trim(); if (!L) continue;
    let d = null; const iso = L.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) d = iso[0];
    else { const p = Date.parse(L.replace(/\s+[\d,.]+\s*(steps?)?\s*$/i, '').replace(/\bat\b.*$/i, '')); if (!isNaN(p)) d = ymd(new Date(p)); }
    const nm = L.replace(iso ? iso[0] : '', '').match(/([\d][\d,.]*)\s*(steps?)?\s*$/i);
    if (d && nm) { const v = Math.round(parseFloat(nm[1].replace(/,/g, ''))); if (v >= 0 && v < 200000) out[d] = (out[d] || 0) + v; }
  }
  return out;
}
function openSyncKey() {
  const url = CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/steps';
  openSheet(`<div class="stack"><div class="eyebrow">Steps sync key</div>
    <p class="m0 f15 sec">A new key replaces any key you made before, so an old Shortcut stops working until you paste the new key in. Job’s Done shows the key only once.</p>
    <div id="sk-out"></div>
    <button class="btn primary block" id="sk-make">Create key</button>
    <button class="btn ghost block" data-a="closeSheet">Close</button></div>`, { label: 'Steps sync key', mount: el => {
  el.querySelector('#sk-make').onclick = async ev => {
    const b = ev.currentTarget; b.disabled = true;
    try {
      const raw = crypto.getRandomValues(new Uint8Array(32));
      const key = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
      const key_hash = [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
      const { error } = await SB.from('jobdone_sync_keys').upsert({ user_id: USER.id, key_hash, created_at: new Date().toISOString() });
      if (error) throw error;
      b.remove();
      el.querySelector('#sk-out').innerHTML = `<div class="g3 stack">
        <div class="field"><label>Your key</label><textarea class="input num" readonly rows="2" style="min-height:0">${esc(key)}</textarea></div>
        <button class="btn block" data-copy="${esc(key)}">Copy key</button>
        <div class="field"><label>Shortcut address</label><textarea class="input num" readonly rows="2" style="min-height:0">${esc(url)}</textarea></div>
        <button class="btn block" data-copy="${esc(url)}">Copy address</button></div>`;
      for (const c of el.querySelectorAll('[data-copy]')) c.onclick = async () => { try { await navigator.clipboard.writeText(c.dataset.copy); toast('Copied'); } catch (e) { toast('Press and hold the text to copy it'); } };
    } catch (e) { b.disabled = false; toast('Could not create the key. Check your connection and try again.'); }
  };
  } });
}
function openSteps(day) {
  const t = today(), d0 = day && day <= t ? day : t;
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Steps</div>
    <div class="grid2"><div class="field"><label for="st-date">Date</label><input class="input" type="date" id="st-date" value="${d0}" max="${t}"></div><div class="field"><label for="st-n">Steps</label><input class="input num" id="st-n" inputmode="numeric" placeholder="Steps" value="${S.steps[d0] || ''}"></div></div>
    <button class="btn primary block" id="st-save">Save</button>
    <div class="mt2 field"><label for="st-paste">Or paste from your “${SC_NAME()}” shortcut</label><textarea class="input num" id="st-paste" placeholder="2026-10-13 9412&#10;2026-10-14 6120"></textarea></div>
    <button class="btn block" id="st-import">Import pasted steps</button><div class="cap" id="st-msg"></div></div>`, {
    label: 'Steps',
    mount: b => {
      b.querySelector('#st-date').onchange = ev => { b.querySelector('#st-n').value = S.steps[ev.target.value] || ''; };
      b.querySelector('#st-save').onclick = () => {
        const d = b.querySelector('#st-date').value || t; const v = parseInt(b.querySelector('#st-n').value.replace(/[^\d]/g, ''), 10);
        if (isNaN(v)) { b.querySelector('#st-msg').textContent = 'Enter a number of steps.'; return; }
        S.steps[d] = v; persist('jd/steps'); closeSheet(sh); rerender(); toast(`${n0(v)} steps saved for ${fmtDate(d)}`);
      };
      b.querySelector('#st-import').onclick = () => {
        const p = parseStepText(b.querySelector('#st-paste').value); const k = Object.keys(p);
        if (!k.length) { b.querySelector('#st-msg').textContent = 'No dates with step counts found. Each line needs a date (2026-10-14) and a number.'; return; }
        Object.assign(S.steps, p); persist('jd/steps'); closeSheet(sh); rerender(); toast(`Imported steps for ${k.length} day${k.length > 1 ? 's' : ''}`);
      };
    },
  });
}

// ---------- exercise picker ----------
function pickExercise(onPick, opts = {}) {
  let q = '', mf = null;
  const recent = []; for (const w of ix().ws.slice().reverse()) for (const e of w.ex) { const b = baseName(e.name); if (!recent.includes(b)) recent.push(b); }
  const all = () => { const names = new Set([...LIB.map(e => e.name), ...(S.customEx || []).map(e => e.name)]); return [...names].map(exInfo); };
  const score = (n, q) => { n = n.toLowerCase(); q = q.toLowerCase().trim(); if (!q) return 1; if (n.includes(q)) return 100 - n.indexOf(q); let i = 0; for (const c of n) if (c === q[i]) i++; return i === q.length ? 10 : 0; };
  const list = () => {
    let l = all().filter(e => !mf || e.muscle === mf).map(e => ({ e, s: score(e.name, q) })).filter(x => x.s > 0);
    l.sort((a, b) => b.s - a.s || (recent.indexOf(a.e.name) + 1 || 999) - (recent.indexOf(b.e.name) + 1 || 999) || a.e.name.localeCompare(b.e.name));
    return l.map(x => x.e);
  };
  const rows = () => {
    const l = list(); const exact = l.some(e => e.name.toLowerCase() === q.trim().toLowerCase());
    if (!q.trim() && !mf) {
      const all2 = all(), rec = recent.slice(0, 6).map(n => all2.find(e => e.name === n)).filter(Boolean);
      const row = e => `<button class="li" data-pick="${esc(e.name)}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.muscle)} · ${esc(e.equip)}</div></div></button>`;
      return `<button class="li" data-pick-new="1"><div class="grow"><div class="t">New exercise</div><div class="s">Name it and pick its muscle group</div></div>${I.plus.replace('<svg', '<svg width="18" height="18"')}</button>`
        + (rec.length ? `<div class="grp">Recent</div>` + rec.map(row).join('') : '')
        + MUSCLES.map(m => { const g = all2.filter(e => e.muscle === m).sort((a, b) => a.name.localeCompare(b.name)); return g.length ? `<div class="grp">${esc(m)} <span>${g.length}</span></div>` + g.map(row).join('') : ''; }).join('');
    }
    return (q.trim() && !exact ? `<button class="li" data-pick-new="1"><div class="grow"><div class="t">Create “${esc(q.trim())}”</div><div class="s">Custom exercise${mf ? ' · ' + esc(mf) : ''}</div></div>${I.plus.replace('<svg', '<svg width="18" height="18"')}</button>` : '') +
      l.slice(0, 80).map(e => `<button class="li" data-pick="${esc(e.name)}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.muscle)} · ${esc(e.equip)}${recent.includes(e.name) ? ' · used before' : ''}</div></div></button>`).join('');
  };
  const sh = openSheet(`<div class="stack"><div class="eyebrow">${esc(opts.title || 'Add exercise')}</div><input class="input" id="pk-q" placeholder="Search exercises" autocomplete="off">
    <div class="chips" id="pk-m">${MUSCLES.map(m => `<button class="chip" data-m="${m}">${m}</button>`).join('')}</div>
    <label class="g2 row cap"><input type="checkbox" id="pk-side" style="accent-color:var(--accent)"> Log left and right sides separately</label>
    <div class="list" id="pk-list">${rows()}</div></div>`, {
    label: 'Exercise picker',
    mount: b => {
      const L = b.querySelector('#pk-list');
      b.querySelector('#pk-q').oninput = ev => { q = ev.target.value; L.innerHTML = rows(); };
      b.querySelector('#pk-m').onclick = ev => { const c = ev.target.closest('[data-m]'); if (!c) return; mf = mf === c.dataset.m ? null : c.dataset.m; b.querySelectorAll('#pk-m .chip').forEach(x => x.classList.toggle('on', x.dataset.m === mf)); L.innerHTML = rows(); };
      L.onclick = ev => {
        const p = ev.target.closest('[data-pick]'), nw = ev.target.closest('[data-pick-new]');
        let name = null;
        if (p) name = p.dataset.pick;
        if (nw) { const sides = b.querySelector('#pk-side').checked; openExForm(q.trim().replace(/\s+/g, ' '), { muscle: mf, onSave: n => { closeSheet(sh); if (sides) { onPick(n + ' (L)'); onPick(n + ' (R)'); } else onPick(n); } }); return; }
        if (!name) return;
        const sides = b.querySelector('#pk-side').checked;
        closeSheet(sh);
        if (sides) { onPick(name + ' (L)'); onPick(name + ' (R)'); } else onPick(name);
      };
    },
  });
}

// Create a custom exercise, or change its muscle group and equipment. Built-in lifts only swap between equipment that fits them.
function openExForm(name, o = {}) {
  const cur = name ? exInfo(name) : null, known = name && (LIB.some(e => e.name === name) || (S.customEx || []).some(e => e.name === name));
  const lib = !!(name && libEx(name));
  let mu = lib ? cur.muscle : o.muscle || (known ? cur.muscle : null), eq = known ? cur.equip : null;
  const sh = openSheet(`<div class="stack"><div class="eyebrow">${known ? 'Exercise group' : 'New exercise'}</div>
    <div class="field"><label for="ef-n">Name</label><input class="input" id="ef-n" value="${esc(name || '')}" placeholder="e.g. Hammer Curl" ${known ? 'disabled' : ''}></div>
    ${lib ? `<div class="field"><span class="lbl">Muscle group</span><div class="chips wrap"><span class="chip on" aria-disabled="true">${esc(mu)}</span></div><p class="cap m0">Built-in lifts keep their muscle group.</p></div>`
      : `<div class="field"><span class="lbl">Muscle group</span><div class="chips wrap" id="ef-m">${MUSCLES.map(m => `<button class="chip ${mu === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}</div></div>`}
    <div class="field"><span class="lbl">Equipment</span><div class="chips wrap" id="ef-e">${eqOptions(lib ? name : '').map(m => `<button class="chip ${eq === m ? 'on' : ''}" data-m="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>${lib && eqOptions(name).length === 1 ? `<p class="cap m0">This lift only uses this equipment.</p>` : ''}</div>
    <button class="btn primary block" id="ef-ok">Save</button>
    ${known && (S.customEx || []).some(e => e.name === name) && !LIB.some(e => e.name === name) ? '' : ''}
    <button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, { label: 'Exercise', mount: b => {
    const pick = (id, set) => b.querySelector(id).onclick = ev => { const c = ev.target.closest('[data-m]'); if (!c) return; set(c.dataset.m); b.querySelectorAll(id + ' .chip').forEach(x => x.classList.toggle('on', x === c)); };
    if (!lib) pick('#ef-m', v => mu = v); pick('#ef-e', v => eq = v);
    b.querySelector('#ef-ok').onclick = () => {
      const n = (b.querySelector('#ef-n').value || '').trim().replace(/\s+/g, ' ');
      if (!n) { toast('Give it a name'); return; }
      if (!mu) { toast('Pick a muscle group'); return; }
      S.customEx = (S.customEx || []).filter(e => e.name !== n);
      if (!lib || eq !== libEx(n).equip) S.customEx.push({ name: n, muscle: mu, equip: eq || (lib ? libEx(n).equip : 'other') });
      persist('jd/meta'); invalidate(); closeSheet(sh);
      if (o.onSave) o.onSave(n); else { rerender(); toast(`${esc(n)} · ${esc(mu)}`); }
    };
  } });
}
// Me → My exercises: everything you've logged or made, grouped by muscle, tap to re-group.
function openMyExercises() {
  const names = new Set((S.customEx || []).map(e => e.name)); for (const w of ix().ws) for (const e of w.ex) names.add(baseName(e.name));
  for (const sp of S.splits) for (const e of sp.ex) names.add(baseName(e.name));
  const list = [...names].map(exInfo);
  const other = list.filter(e => e.muscle === 'Other').length;
  const sh = openSheet(`<div class="stack"><div class="row between"><div class="eyebrow">My exercises</div><button class="btn sm" id="me-new">New exercise</button></div>
    ${other ? `<div class="cap">${other} still in “Other”. Tap one to give it a group.</div>` : ''}
    <div class="list">${['Other', ...MUSCLES.filter(m => m !== 'Other')].map(m => { const g = list.filter(e => e.muscle === m).sort((a, b) => a.name.localeCompare(b.name)); return g.length ? `<div class="grp">${esc(m)} <span>${g.length}</span></div>` + g.map(e => `<button class="li" data-ex="${esc(e.name)}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.equip)}</div></div>${I.right}</button>`).join('') : ''; }).join('')}</div></div>`, { label: 'My exercises', mount: b => {
    b.querySelector('#me-new').onclick = () => { closeSheet(sh); openExForm('', { onSave: () => { rerender(); openMyExercises(); } }); };
    b.onclick = ev => { const x = ev.target.closest('[data-ex]'); if (!x) return; closeSheet(sh); openExForm(x.dataset.ex, { onSave: () => { rerender(); openMyExercises(); } }); };
  } });
}

// ---------- start sheet ----------
function openStart() {
  if (A) { openWk(); return; }
  const nx = nextSplit();
  const act = S.splits.filter(s => !s.archived).sort((a, b) => (b === nx) - (a === nx));
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Start a workout</div><div class="list">${act.map(sp => { const l = lastOfSplit(sp); return `<button class="li" data-st="${sp.id}"><span class="tag" style="width:8px;height:36px;border-radius:4px;background:${sp.color};flex:none"></span><div class="grow"><div class="t">${esc(sp.name)} ${sp === nx ? '<span class="pill">Next up</span>' : ''}</div><div class="s">${plural(sp.ex.length, 'exercise')} · ${l ? relDay(l.date) : 'not done yet'}</div></div>${I.right}</button>`; }).join('')}
    <button class="li" data-st=""><span style="width:8px;flex:none"></span><div class="grow"><div class="t">Empty workout</div><div class="s">Pick exercises as you go</div></div>${I.right}</button></div></div>`, {
    label: 'Start workout',
    mount: b => { b.onclick = ev => { const x = ev.target.closest('[data-st]'); if (!x) return; closeSheet(sh); startWorkout(x.dataset.st || null); }; },
  });
}
function openRotation() {
  let order = S.rotation.slice();
  const html = () => `<div class="stack"><div class="eyebrow">Rotation</div><p class="m0 cap">Today suggests the split after the last one you did, in this order. Saving starts it again from the first split.</p>
    <div class="list dsort" data-sort="rot">${order.map((id, i) => { const sp = splitById(id); return sp ? `<div class="li" data-dragitem><button class="drag-h" data-drag aria-label="Drag to move">${I.grip}</button><span class="tag" style="width:8px;height:28px;border-radius:4px;background:${sp.color};flex:none"></span><div class="grow t">${i + 1}. ${esc(sp.name)}</div><button class="icon-btn" data-ro="rm" data-i="${i}" aria-label="Remove">${I.x}</button></div>` : ''; }).join('') || '<div class="empty">Add splits below.</div>'}</div>
    <div class="chips wrap">${S.splits.filter(s => !s.archived).map(s => `<button class="chip" data-ro="add" data-id="${s.id}">+ ${esc(s.name)}</button>`).join('')}</div>
    <button class="btn primary block" data-ro="save">Save rotation</button></div>`;
  const sh = openSheet(html(), {
    label: 'Rotation',
    mount: b => {
      b.addEventListener('dsort', ev => { const [x] = order.splice(ev.detail.from, 1); order.splice(ev.detail.to, 0, x); b.innerHTML = html(); });
      b.onclick = ev => {
        const x = ev.target.closest('[data-ro]'); if (!x) return; const i = +x.dataset.i;
        if (x.dataset.ro === 'save') { { const last = ix().ws.filter(w => !w.skipped).pop(); S.profile.rotReset = last ? last.id : null; } S.rotation = order; persist('jd/meta'); closeSheet(sh); rerender(); toast('Rotation saved'); return; }
        if (x.dataset.ro === 'add') order.push(x.dataset.id);
        if (x.dataset.ro === 'rm') order.splice(i, 1);
        if (x.dataset.ro === 'up' && i > 0) [order[i - 1], order[i]] = [order[i], order[i - 1]];
        if (x.dataset.ro === 'dn' && i < order.length - 1) [order[i + 1], order[i]] = [order[i], order[i + 1]];
        b.innerHTML = html();
      };
    },
  });
}
// Machine setup notes (seat height, pin, bench angle…) kept per exercise, with older versions.
const setupOf = name => { const l = (S.setup || {})[baseName(name)]; return l && l.length ? l[l.length - 1] : null; };
const setupHTML = name => { const s = setupOf(name); return `<button class="setup ${s ? '' : 'empty'}" data-a="setup" data-name="${esc(baseName(name))}">${I.wrench}<span>${s ? esc(s.t) : 'Add machine setup notes'}</span></button>`; };
function openSetup(name) {
  const hist = ((S.setup || {})[name] || []).slice().reverse();
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Machine setup notes · ${esc(name)}</div>
    <textarea class="input" id="su-t" maxlength="160" placeholder="For example: seat 4, pin 7, handles wide, slow on the way down">${hist[0] ? esc(hist[0].t) : ''}</textarea>
    <button class="btn primary block" id="su-s">Save setup notes</button>
    ${hist.length > 1 ? `<div class="cap">Earlier</div><div class="list">${hist.slice(1, 6).map(x => `<div class="li"><div class="grow"><div class="t f15">${esc(x.t)}</div><div class="s">${esc(fmtDate(x.d))}</div></div></div>`).join('')}</div>` : ''}</div>`, { label: 'Machine setup notes', mount: b => {
    b.querySelector('#su-s').onclick = () => {
      const t = b.querySelector('#su-t').value.trim(); S.setup = S.setup || {}; const l = S.setup[name] || [];
      if (t) { if (!l.length || l[l.length - 1].t !== t) l.push({ t, d: today() }); if (l.length > 10) l.splice(0, l.length - 10); S.setup[name] = l; }
      else delete S.setup[name];
      persist('jd/meta'); closeSheet(sh); if (A && A.open) renderWorkout(); else rerender(); toast(t ? 'Setup notes saved' : 'Setup notes cleared');
    };
  } });
}
// Drag the three-line handle to reorder today's exercises (Job, 15 Oct).
function openReorder() {
  const html = () => `<div class="stack"><div class="eyebrow">Reorder exercises</div><p class="m0 cap">Drag the handle up or down.</p>
    <div class="list dsort" data-sort="wk">${A.ex.map(e => `<div class="li" data-dragitem><button class="drag-h" data-drag aria-label="Drag to move ${esc(e.name)}">${I.grip}</button><div class="grow t">${esc(e.name)}</div><span class="cap">${plural(e.sets.length, 'set')}</span></div>`).join('')}</div>
    <button class="btn primary block" data-a="closeSheet">Done</button></div>`;
  openSheet(html(), { label: 'Reorder exercises', mount: b => b.addEventListener('dsort', ev => { const [x] = A.ex.splice(ev.detail.from, 1); A.ex.splice(ev.detail.to, 0, x); touchA(); b.innerHTML = html(); }) });
}
// Pointer drag for any .dsort list: grab a [data-drag] handle, the row follows your finger, the others make room.
// On drop a 'dsort' event bubbles with { from, to }; split lists save straight away.
function dragSort(ev) {
  const h = ev.target.closest('[data-drag]'); if (!h) return;
  const item = h.closest('[data-dragitem]'), box = item && item.parentElement; if (!box || !box.classList.contains('dsort')) return;
  ev.preventDefault();
  const items = [...box.children].filter(x => x.hasAttribute('data-dragitem')), from = items.indexOf(item);
  const rects = items.map(x => x.getBoundingClientRect()), y0 = ev.clientY, hgt = rects[from].height + (rects[1] ? Math.abs(rects[1].top - rects[0].bottom) : 8);
  let to = from;
  item.classList.add('dragging'); try { h.setPointerCapture(ev.pointerId); } catch (e) {}
  const scroller = item.closest('#screen, .sheet-body, .wk-body');
  const move = e => {
    const dy = e.clientY - y0; item.style.transform = `translateY(${dy}px)`;
    const mid = rects[from].top + rects[from].height / 2 + dy;
    to = from; items.forEach((x, i) => { if (i === from) return; const c = rects[i].top + rects[i].height / 2; let sh = 0;
      if (i > from && mid > c) { sh = -hgt; to = Math.max(to, i); } else if (i < from && mid < c) { sh = hgt; to = Math.min(to, i); }
      x.style.transform = sh ? `translateY(${sh}px)` : ''; });
    if (scroller) { const r = scroller.getBoundingClientRect(); if (e.clientY < r.top + 40) scroller.scrollTop -= 8; else if (e.clientY > r.bottom - 40) scroller.scrollTop += 8; }
  };
  const up = () => {
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    items.forEach(x => { x.style.transform = ''; }); item.classList.remove('dragging');
    if (to === from) return;
    if (box.dataset.sort === 'split') { const sp = splitById(box.dataset.id); const [x] = sp.ex.splice(from, 1); sp.ex.splice(to, 0, x); persist('jd/meta'); NAV.keepScroll = true; rerender(); return; }
    box.dispatchEvent(new CustomEvent('dsort', { bubbles: true, detail: { from, to } }));
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
}
document.addEventListener('pointerdown', dragSort);
function exMenu(ei) {
  const e = A.ex[ei];
  const sh = openSheet(`<div class="stack"><div class="eyebrow">${esc(e.name)}</div>
    <button class="btn block" data-m="note">${e.note ? 'Edit note' : 'Add note'}</button>
    <button class="btn block" data-m="order">${I.grip} Reorder exercises</button>
    <button class="btn block" data-m="setup">Machine setup notes</button>
    <button class="btn block" data-m="warm">${e.sets.some(x => x.t === 'warm') ? 'Remove warm-up sets' : 'Add warm-up sets'}</button>
    ${ei < A.ex.length - 1 ? `<button class="btn block" data-m="ss">${e.ss ? 'Unlink superset' : 'Superset with ' + esc(baseName(A.ex[ei + 1].name))}</button>` : ''}
    <button class="btn block" data-m="rest">Rest for this exercise: ${fmtRest(restFor(e.name))}${(S.profile.restBy || {})[baseName(e.name)] ? '' : ' (default)'}</button>
    <button class="btn block" data-m="swap">Swap exercise</button><button class="btn block" data-m="hist">See history</button>${howtoFor(e.name) ? '<button class="btn block" data-m="howto">How to do it</button>' : ''}
    <button class="btn block danger" data-m="rm">Remove from this workout</button></div>`, {
    label: 'Exercise options',
    onClose: () => { },
    mount: b => {
      b.onclick = ev => {
        const x = ev.target.closest('[data-m]'); if (!x) return; const m = x.dataset.m; closeSheet(sh);
        if (m === 'order') openReorder();
        if (m === 'rm') confirmSheet({ title: `Remove ${e.name}?`, body: 'Sets you logged for it in this workout are removed too.', ok: 'Remove', danger: true, onOk: () => { if (!A) return; const [gone] = A.ex.splice(ei, 1); touchA(); toast(esc(e.name) + ' removed', 0, () => { if (!A) return; A.ex.splice(Math.min(ei, A.ex.length), 0, gone); touchA(); }); } });
        if (m === 'swap') openSwap(ei);
        if (m === 'setup') openSetup(baseName(e.name));
        if (m === 'rest') openExRest(e.name);
        if (m === 'warm') addWarmups(ei);
        if (m === 'ss') { e.ss = !e.ss; touchA(); toast(e.ss ? `Superset: rest starts after each ${esc(baseName(A.ex[ei + 1].name))} set` : 'Superset unlinked'); }
        if (m === 'howto') return openHowto(e.name);
        if (m === 'hist') { minimizeWk(); NAV.stack.push({ v: 'exercise', name: e.name }); render(); }
        if (m === 'note') { const s2 = openSheet(`<div class="stack"><div class="eyebrow">Note for ${esc(e.name)}</div><textarea class="input" id="en-t">${esc(e.note)}</textarea><button class="btn primary block" id="en-s">Save note</button></div>`, { mount: bb => { bb.querySelector('#en-s').onclick = () => { e.note = bb.querySelector('#en-t').value.trim(); closeSheet(s2); touchA(); }; } }); }
      };
    },
  });
}

// Warm-ups (Job, 15 Oct): ramp to the first working weight, 50% x 8, 70% x 5, 85% x 3, rounded to the plates.
function addWarmups(ei) {
  const e = A.ex[ei];
  if (e.sets.some(x => x.t === 'warm')) { e.sets = e.sets.filter(x => x.t !== 'warm' || x.done); touchA(); return toast('Warm-up sets removed'); }
  const w0 = (e.sets.find(x => x.t !== 'warm' && x.w) || {}).w;
  if (!w0) return toast('Set the weight for your first working set, then add warm-ups.');
  const step = U() === 'lb' ? 5 / LB : 2.5, rd = v => Math.max(step, Math.round(v / step) * step);
  const ramp = [[.5, 8], [.7, 5], [.85, 3]].map(([f, r]) => ({ w: rd(w0 * f), r, t: 'warm', done: false })).filter((x, i, a) => x.w < w0 && (!i || x.w > a[i - 1].w));
  e.sets.unshift(...ramp); touchA(); toast(`${plural(ramp.length, 'warm-up set')} added, building to ${dw(w0)} ${U()}`);
}
function openExRest(name) {
  const b0 = baseName(name), cur = (S.profile.restBy || {})[b0] || 0;
  const opts = [[0, `Default (${fmtRest(S.profile.defaultRest || 120)})`], [60, '1:00'], [90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00'], [240, '4:00'], [300, '5:00']];
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Rest for ${esc(b0)}</div><p class="m0 cap">Short rests suit raises and curls; big lifts like more.</p><div class="list">${opts.map(([v, l]) => `<button class="li tl ${cur === v ? 'on' : ''}" data-r="${v}"><span class="grow t">${l}</span>${cur === v ? I.check : ''}</button>`).join('')}</div></div>`, { label: 'Rest', mount: b => {
    b.onclick = ev => { const x = ev.target.closest('[data-r]'); if (!x) return; const v = +x.dataset.r; S.profile.restBy = Object.assign({}, S.profile.restBy); if (v) S.profile.restBy[b0] = v; else delete S.profile.restBy[b0]; persist('jd/meta'); closeSheet(sh); toast(v ? `${esc(b0)}: ${fmtRest(v)} rest` : `${esc(b0)} uses your default rest`); };
  } });
}

// ---------- demo account (judge review, 15 Oct): sample history so the charts, PRs and badges show ----------
function demoState() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const st = freshState(), p = st.profile;
  Object.assign(p, { name: 'Alex', heightCm: 178, goalW: 76, unit: 'kg', weeklyTarget: 4, defaultRest: 120, stepGoal: 9000, theme: theme(), legacy: 0, rest5: true, music2: true, musicOk: true, soundSilent: false, cliffs1: true, demo: true, restBy: { 'Lateral Raise': 75, 'Dumbbell Curl': 75, 'Hammer Curl': 75, 'Face Pull': 75, 'Calf Raise': 60 } });
  st.created = Date.now(); st.imported = true;
  const PLAN = [['Push', [['Bench Press', 60], ['Incline Dumbbell Press', 20], ['Shoulder Press', 40], ['Lateral Raise', 8], ['Tricep Pushdown', 22.5]]],
    ['Pull', [['Lat Pulldown', 50], ['Seated Cable Row', 50], ['Face Pull', 17.5], ['Dumbbell Curl', 10], ['Hammer Curl', 12]]],
    ['Legs', [['Back Squat', 70], ['Romanian Deadlift', 60], ['Leg Press', 120], ['Leg Curl', 35], ['Calf Raise', 60]]]];
  for (const [n, ex] of PLAN) { const id = 'sp-demo-' + n.toLowerCase(); st.splits.push({ id, name: n, color: SPLIT_COLORS[n] || PALETTE[st.splits.length], archived: false, ex: ex.map(([e]) => ({ name: e, sets: 3, repMin: 6, repMax: 10, rest: 120, note: '' })) }); st.rotation.push(id); }
  const cur = {}; PLAN.forEach(([, ex]) => ex.forEach(([e, w]) => { cur[e] = { w, r: 6 }; }));
  const T = today(), start = addDays(T, -83); let k = 0, num = 0;
  for (let d = start; d < T; d = addDays(d, 1)) {
    const dow = (new Date(d + 'T12:00').getDay() + 6) % 7;   // Mon 0
    if (![0, 1, 3, 5].includes(dow)) continue;
    if (rnd() < .06 && daysBetween(d, T) > 7) continue;      // the odd missed day, never this week
    const [sn, ex] = PLAN[k % 3]; k++; num++;
    const t0 = new Date(d + 'T18:05').getTime() + Math.round(rnd() * 40) * 6e4, mins = 52 + Math.round(rnd() * 22);
    const w = { id: 'demo-' + num, date: d, splitId: 'sp-demo-' + sn.toLowerCase(), splitName: sn, start: t0, end: t0 + mins * 6e4, note: '', energy: null, src: 'native', planned: 15, ex: [] };
    for (const [e] of ex) {
      const c = cur[e], stall = e === 'Shoulder Press' && daysBetween(d, T) < 26, sets = [];
      for (let i = 0; i < 3; i++) sets.push({ w: c.w, r: Math.max(4, c.r - (i === 2 ? 1 : 0) - (rnd() < .2 ? 1 : 0)), t: 'work', done: true });
      w.ex.push({ name: e, note: '', sets });
      if (!stall) { c.r++; if (c.r > 10) { c.r = 6; c.w = Math.round((c.w + (c.w >= 40 ? 2.5 : c.w >= 15 ? 1.25 : 1)) * 100) / 100; } }
    }
    st.workouts[w.id] = w;
  }
  for (let d = start, i = 0; d <= T; d = addDays(d, 1), i++) {
    if (rnd() < .82) st.weights[d] = { w: Math.round((82.4 - i * .045 + (rnd() - .5) * .8) * 10) / 10, src: 'manual' };
    if (i > 23) st.steps[d] = Math.round(5200 + rnd() * 7400);
  }
  return st;
}
function startDemo() {
  DEMO = true; DB = null; mode = 'local'; A = null; S = demoState(); UI = { lastPrompt: today() }; invalidate();
  NAV = { tab: 'today', stack: [], prog: 'body', range: '6M' };
  ready = true; applyTheme(); render();
  toast('Demo account: Alex’s 12 weeks of training. Nothing you change is saved.', 5000);
}

// ---------- welcome / import ----------
function findSeedIdx(d, s) { return SEED_LOG.findIndex(o => o.d === d && o.s === s); }
function buildFromSeed() {
  const log = SEED_LOG.map((o, i) => { const ov = welcomeOv[i] || {}; return { ...o, d: ov.d || o.d, s: ov.s || o.s }; });
  const st = buildFromLog(log);
  for (const [d, w] of SEED_WEIGHTS) st.weights[d] = { w, src: 'estimated' };
  if (SEED.today) st.weights[SEED.today[0]] = { w: SEED.today[1], src: 'manual' };
  return st;
}
// log: [{d, s, skip, x: [[exercise, [[w, r], ...], note], ...]}] → state with splits built from each split's latest session
function buildFromLog(log) {
  const st = freshState();
  const names = [...new Set(log.map(o => o.s))];
  const order = ['Push', 'Pull', 'Upper', 'Legs', 'Anterior', 'Posterior'];
  names.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  for (const n of names) {
    const sessions = log.filter(o => o.s === n && !o.skip).sort((a, b) => a.d < b.d ? -1 : 1);
    const last = sessions[sessions.length - 1];
    st.splits.push({ id: 'sp-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: n, color: SPLIT_COLORS[n] || PALETTE[st.splits.length % PALETTE.length], archived: false, ex: last ? last.x.map(([name, sets]) => ({ name, sets: Math.max(2, sets.length), repMin: 6, repMax: 10, rest: 120, note: '' })) : [] });
  }
  const byName = n => st.splits.find(s => s.name === n);
  st.rotation = ['Push', 'Pull'].map(n => byName(n)).filter(Boolean).map(s => s.id);
  log.forEach((o, i) => {
    const id = 'imp-' + String(i).padStart(3, '0');
    st.workouts[id] = { id, date: o.d, splitId: byName(o.s) ? byName(o.s).id : null, splitName: o.s, start: null, end: null, note: '', energy: null, src: 'import', skipped: !!o.skip, ex: o.x.map(([name, sets, note]) => ({ name, note: note || '', sets: sets.map(([w, r]) => ({ w, r, t: 'work' })) })) };
  });
  st.imported = true;
  return st;
}
function renderWelcome() {
  if (PUBLIC) { renderWelcomePublic(); return; }
  const app = $('#app');
  const wk = SEED_LOG.filter(o => !o.skip).length, sets = SEED_LOG.reduce((a, o) => a + o.x.reduce((b, x) => b + x[1].length, 0), 0);
  const splitNames = [...new Set(SEED_LOG.map(o => o.s))];
  app.innerHTML = `<main id="screen" style="padding-bottom:calc(32px + env(safe-area-inset-bottom,0px))"><div class="g4 pt6 stack">
    <div class="wordmark">Job’s <span>Done</span></div>
    <div><h1>Welcome back, ${esc(firstName())}</h1><p class="m0 mt2 sec">Your profile and training log are ready to load. Check the guesses below, then import.</p></div>
    ${(() => { const w0 = SEED_WEIGHTS[0], t = SEED.today; if (!w0 || !t) return ''; const mo = daysBetween(w0[0], t[0]) / 30.44; return `<div class="card"><div class="mb3 eyebrow">Profile</div><div class="kpis"><div class="kpi"><b>${SEED.profile.heightCm || '—'} cm</b><span>height</span></div><div class="kpi"><b>${w0[1].toFixed(1)} → ${t[1].toFixed(1)}</b><span>kg since ${esc(fmtDate(w0[0]))}</span></div><div class="kpi"><b>${bwRaw((t[1] - w0[1]) / mo)}</b><span>kg per month</span></div></div><div class="mt3 cap">Monthly weights up to ${esc(fmtDate(SEED_WEIGHTS[SEED_WEIGHTS.length - 1][0]))} are marked as estimates (hollow dots) so you can correct them later. Today’s ${t[1].toFixed(1)} kg is logged as real.</div></div>`; })()}
    <div class="card"><div class="mb3 eyebrow">Training log</div><div class="kpis"><div class="kpi"><b>${wk}</b><span>workouts</span></div><div class="kpi"><b>${n0(sets)}</b><span>sets</span></div><div class="kpi"><b>${splitNames.length}</b><span>splits</span></div></div>
      <div class="mt3 cap">4 May to 13 Oct 2026, plus Legs on 23 May marked as skipped. Splits: ${esc(splitNames.join(', '))}. Each one uses the exercises from the last time you did it. Rotation starts as Push → Pull.</div></div>
    <div class="card stack"><div class="eyebrow">Check these guesses</div>
      <p class="m0 cap">Five dates were written twice, so each repeat moved to the next likely day. Change any that are wrong.</p>
      ${MOVED.map(m => { const i = findSeedIdx(m.d, m.s); if (i < 0) return ''; const cur = (welcomeOv[i] || {}).d || m.d; return `<label class="g3 row between"><span class="f15 grow">${esc(m.label)}</span><input class="input sm" type="date" style="width:160px" id="mv-${i}" data-in="wlDate" data-i="${i}" value="${cur}"></label>`; }).join('')}
      ${(() => { const i = findSeedIdx(NONAME.d, NONAME.s); if (i < 0) return ''; const cur = (welcomeOv[i] || {}).s || NONAME.s; return `<label class="g3 row between"><span class="f15 grow">${esc(fmtDate(NONAME.d))} had no split name. It matches</span><select class="input sm" style="width:160px" id="nn-${i}" data-in="wlSplit" data-i="${i}">${splitNames.map(s => `<option ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`; })()}
      <details><summary class="link">Other cleanup (${ASSUMPTIONS.length})</summary><ul class="assume">${ASSUMPTIONS.map(a => `<li>${esc(a)}</li>`).join('')}</ul><p class="cap">You can fix any single workout later from Progress → History → Edit.</p></details>
    </div>
    <button class="mh52 f17 btn primary block" data-a="doImport">Import and open Job’s Done</button>
    <button class="self-c link" data-a="skipImport">Start without my history</button>
  </div></main>`;
}
async function doImport(withHistory) {
  if (PUBLIC) { S = freshState(); S.imported = true; finishImport('Ready. Add a split to get started.'); return; }
  if (withHistory) S = buildFromSeed();
  else { S = buildFromSeed(); S.workouts = {}; }
  finishImport(withHistory ? `Imported ${plural(Object.values(S.workouts).filter(w => !w.skipped).length, 'workout')}` : 'Ready. Your splits are set up.');
}
function finishImport(msg) {
  invalidate(); OB = null; document.documentElement.classList.remove('ob-on');
  if (UI.a2hs && S && S.profile) S.profile.a2hs = UI.a2hs;
  UI.lastPrompt = today();
  $('#app').innerHTML = '';
  persist(...allPaths());
  NAV = { tab: 'today', stack: [], prog: 'body', range: '6M' };
  render();
  if (msg) { toast(msg); const tt = document.querySelector('.toast'); if (tt) tt.classList.add('low'); }
}
// Restore a Job’s Done JSON backup (Me → Export JSON) or start from a CSV log.
function stateFromBackup(o) {
  if (!o || typeof o !== 'object' || !o.workouts || typeof o.workouts !== 'object') return null;
  const st = freshState();
  for (const k of ['profile', 'splits', 'rotation', 'customEx', 'weights', 'steps', 'workouts']) if (o[k] != null) st[k] = k === 'profile' ? Object.assign(st.profile, o[k]) : o[k];
  st.imported = true; return st;
}
function logFromCsvList(list) {
  return list.sort((a, b) => a.date < b.date ? -1 : 1).map(w => ({ d: w.date, s: w.splitName, skip: w.skipped ? 1 : 0, x: w.ex.map(e => [e.name, e.sets.map(x => [x.w, x.r]), e.note || '']) }));
}
function restoreFile(file, replacing) {
  const rd = new FileReader();
  rd.onload = () => {
    const txt = String(rd.result); let st = null, what = '';
    if (/\.json$/i.test(file.name) || /^\s*\{/.test(txt)) {
      try { st = stateFromBackup(JSON.parse(txt)); } catch (e) { st = null; }
      if (!st) { toast('That file isn’t a Job’s Done backup. In the Claude version, use Me → Export JSON.', 4500); return; }
      what = 'Restored your backup';
    } else {
      const res = csvToWorkouts(txt); if (res.err) { toast(esc(res.err), 4500); return; }
      st = buildFromLog(logFromCsvList(res.list)); what = 'Imported your log';
    }
    const go = () => { const old = S ? allPaths() : []; S = st; renameLifts(S, null); invalidate(); if (DB) old.filter(p => !allPaths().includes(p)).forEach(p => dirty.add(p)); finishImport(`${what}: ${plural(Object.values(S.workouts).filter(w => !w.skipped).length, 'workout')}`); };
    if (replacing) confirmSheet({ title: 'Replace everything with this file?', body: 'Your current workouts, weights and splits are replaced by the ones in the file.', ok: 'Replace', danger: true, onOk: go }); else go();
  };
  rd.readAsText(file);
}
// Starter splits for new people; they can rename or edit everything later.
const TEMPLATES = {
  // Every preset is built from Job's own foundation lifts (Job, 19 Oct)
  ppl: { n: 'Push / Pull / Legs', d: '3 workouts you rotate; fits 3 to 6 days a week', s: [['Push', ['Chest Fly', 'Incline Press', 'Shoulder Press', 'Lateral Raise', 'Tricep Pushdown', 'Overhead Tricep Extension']], ['Pull', ['Lat Pulldown', 'Wide-Grip Row', 'Close-Grip Row', 'Preacher Curl']], ['Legs', ['Leg Press', 'Leg Extension', 'Leg Curl', 'Stiff-Leg Deadlift', 'Adductor', 'Abductor', 'Calf Raise']]] },
  ul: { n: 'Upper / Lower', d: '2 workouts you alternate; fits 4 days a week', s: [['Upper', ['Chest Fly', 'Incline Press', 'Lat Pulldown', 'Wide-Grip Row', 'Shoulder Press', 'Lateral Raise', 'Preacher Curl', 'Tricep Pushdown']], ['Lower', ['Leg Press', 'Leg Extension', 'Leg Curl', 'Stiff-Leg Deadlift', 'Adductor', 'Abductor', 'Calf Raise']]] },
  fb: { n: 'Full body', d: '1 workout you repeat; fits 1 to 3 days a week', s: [['Full Body', ['Incline Press', 'Lat Pulldown', 'Wide-Grip Row', 'Shoulder Press', 'Leg Press', 'Leg Curl']]] },
  fbab: { n: 'Full body A / B', d: '2 full-body workouts you alternate; fits 2 to 4 days a week', s: [['Full Body A', ['Incline Press', 'Lat Pulldown', 'Lateral Raise', 'Tricep Pushdown', 'Leg Press', 'Leg Curl']], ['Full Body B', ['Chest Fly', 'Wide-Grip Row', 'Shoulder Press', 'Preacher Curl', 'Stiff-Leg Deadlift', 'Leg Extension']]] },
  ap: { n: 'Anterior / Posterior', d: 'Front of the body, then the back; fits 4 days a week', s: [['Anterior', ['Chest Fly', 'Incline Press', 'Shoulder Press', 'Lateral Raise', 'Tricep Pushdown', 'Overhead Tricep Extension', 'Leg Press', 'Leg Extension', 'Adductor']], ['Posterior', ['Lat Pulldown', 'Wide-Grip Row', 'Close-Grip Row', 'Preacher Curl', 'Stiff-Leg Deadlift', 'Leg Curl', 'Abductor', 'Calf Raise']]] },
  tl: { n: 'Torso / Limbs', d: 'Chest, back and shoulders, then legs and arms; fits 4 days a week', s: [['Torso', ['Chest Fly', 'Incline Press', 'Lat Pulldown', 'Wide-Grip Row', 'Shoulder Press', 'Lateral Raise']], ['Limbs', ['Leg Press', 'Leg Extension', 'Leg Curl', 'Stiff-Leg Deadlift', 'Calf Raise', 'Preacher Curl', 'Tricep Pushdown', 'Overhead Tricep Extension']]] },
  phul: { n: 'PHUL', d: 'Power upper and lower, then muscle upper and lower; 4 days a week', s: [['Upper Power', ['Incline Press', 'Wide-Grip Row', 'Shoulder Press', 'Lat Pulldown', 'Preacher Curl', 'Tricep Pushdown']], ['Lower Power', ['Leg Press', 'Stiff-Leg Deadlift', 'Leg Curl', 'Calf Raise']], ['Upper Muscle', ['Chest Fly', 'Lat Pulldown', 'Close-Grip Row', 'Lateral Raise', 'Preacher Curl', 'Overhead Tricep Extension']], ['Lower Muscle', ['Leg Extension', 'Leg Curl', 'Leg Press', 'Adductor', 'Abductor', 'Calf Raise']]] },
  pplul: { n: 'Push / Pull / Legs + Upper / Lower', d: '5 workouts in a row; fits 5 days a week', s: [] },
  arnold: { n: 'Arnold split', d: 'Chest and back, shoulders and arms, legs; run twice for 6 days a week', s: [['Chest & Back', ['Chest Fly', 'Incline Press', 'Lat Pulldown', 'Wide-Grip Row', 'Close-Grip Row']], ['Shoulders & Arms', ['Shoulder Press', 'Lateral Raise', 'Preacher Curl', 'Tricep Pushdown', 'Overhead Tricep Extension']], ['Legs', ['Leg Press', 'Leg Extension', 'Leg Curl', 'Stiff-Leg Deadlift', 'Adductor', 'Abductor', 'Calf Raise']]] },
  bro: { n: 'Bro split', d: 'One muscle group a day; fits 5 days a week', s: [['Chest', ['Chest Fly', 'Incline Press', 'Chest Press']], ['Back', ['Lat Pulldown', 'Wide-Grip Row', 'Close-Grip Row']], ['Shoulders', ['Shoulder Press', 'Lateral Raise', 'Reverse Pec Deck']], ['Arms', ['Preacher Curl', 'Tricep Pushdown', 'Overhead Tricep Extension']], ['Leg Day', ['Leg Press', 'Leg Extension', 'Leg Curl', 'Stiff-Leg Deadlift', 'Adductor', 'Abductor', 'Calf Raise']]] },
  none: { n: 'I’ll build my own', d: 'Start empty and add splits yourself', s: [] },
};
TEMPLATES.pplul.s = [...TEMPLATES.ppl.s, ...TEMPLATES.ul.s];
// First sign-in for new people: a short, required intro (Job, 15 Oct). Home Screen first, then what Job’s Done does,
// then the few things it needs: you, your goal, your experience, a look, a plan.
let OB = null;
const OB_NAMES = { safe: 'Account safety', move: 'Moving from another app', home: 'Home Screen', tour: 'What it does', you: 'About you', goal: 'Your goal', days: 'Training days', exp: 'Experience', theme: 'Your look', prefs: 'Sounds and alerts', train: 'Training defaults', plan: 'Your plan' };
const OB_STEPS = ['home', 'tour', 'you', 'days', 'exp', 'theme', 'prefs', 'train', 'plan', 'safe', 'move'];
const OB_GOALS = { muscle: ['Build muscle', 'More size, rep ranges in the middle'], strength: ['Get stronger', 'Heavier lifts, fewer reps'], lean: ['Get leaner', 'Keep your strength while your weight drops'], fit: ['Stay fit', 'Train regularly and feel good'] };
const OB_EXP = { new: ['New to lifting', 'Less than 6 months', 8, 12], some: ['Some experience', '6 months to 2 years', 6, 10], pro: ['Experienced', 'More than 2 years', 5, 8] };
const OB_DAYS = [[1, 'Once a week', 'A full-body session to keep things ticking'], [2, '2 days a week', 'Full body, twice'], [3, '3 days a week', 'The classic starting point'], [4, '4 days a week', 'Upper and lower, twice each'], [5, '5 days a week', 'Room for a split per muscle group'], [6, '6 days a week', 'Push, pull and legs, twice'], [7, 'Every day', 'Make sure some days are light']];
const obPlan = () => !OB.days || OB.days <= 2 ? 'fb' : OB.days >= 5 ? 'ppl' : OB.days === 4 ? 'ul' : OB.exp === 'new' ? 'fb' : 'ppl';
function obTour() {
  const mock = (cls, inner) => `<div class="ob-mock ${cls}">${inner}</div>`;
  const slides = [
    ['Log a set in two taps', 'Last time’s numbers sit next to every set. Tap kg and load plates onto a bar instead of doing maths.',
      mock('m-log', `<div class="m-h">Bench Press</div><div class="m-row m-hd"><span>Set</span><span>Previous</span><span>kg</span><span>Reps</span><span></span></div><div class="m-row done"><span>1</span><span class="mu">60×8</span><b>62.5</b><b>8</b><i class="m-ck">${I.check}</i></div><div class="m-row"><span>2</span><span class="mu">60×7</span><b>62.5</b><b class="mu">–</b><i class="m-ck off">${I.check}</i></div><div class="m-plates"><i style="background:#D9342B;height:46px"></i><i style="background:#2F6FD6;height:40px"></i><i style="background:#F2B632;height:32px"></i><span></span><i style="background:#F2B632;height:32px"></i><i style="background:#2F6FD6;height:40px"></i><i style="background:#D9342B;height:46px"></i></div>`)],
    ['Beat last time, every time', 'A target for each lift, a bar that races your last session, and a message after every set.',
      mock('m-beat', `<div class="m-toast"><b>Strong set</b><span>Nearly time to add weight.</span></div><div class="m-tgt">Target: same weight, one more rep than last time.</div><div class="m-race"><i class="g" style="width:82%"></i><i class="me" style="width:64%"></i></div><div class="m-cap">240 kg to match last time</div>`)],
    ['Watch yourself get stronger', 'PRs, a monthly report card and a weight vs strength chart show what is working.',
      mock('m-prog', `<svg viewBox="0 0 260 110" class="m-chart"><path d="M6 96 C50 90 70 70 110 66 S170 40 200 30 S240 16 254 10" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><path d="M6 40 C60 46 110 56 160 62 S230 72 254 76" fill="none" stroke="var(--text2)" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/><circle cx="254" cy="10" r="6" fill="var(--accent)"/></svg><div class="m-leg"><span><i style="background:var(--accent)"></i>Strength</span><span><i style="background:var(--text2)"></i>Body weight</span></div><div class="m-pr"><span>Incline Press</span><b>60×8</b><em>PR</em></div>`)],
    ['Rest, recap, show it off', 'An hourglass rest timer that tells you when your next set starts, and a recap card to share when you’re done.',
      mock('m-rest', `<div class="m-hg">${hourglass(.45, false)}</div><div class="m-rt"><b>3:12</b><span>Next set at 3:00 pm</span></div><div class="m-done">Job’s done!</div>`)],
    ['No signal? Keep lifting', 'Gym basement or flight mode, it still logs. Your sets sync when you’re back online, and your account is backed up every day.',
      mock('m-off', `<div class="m-pill"><i class="m-dot off"></i>Offline · 3 sets saved on this phone</div><div class="m-pill"><i class="m-dot"></i>Back online · All synced</div><div class="m-cap">Daily backup · kept for 14 days</div>`)],
  ];
  return `<div class="ob-tour" id="ob-tour">${slides.map(([t, d, m]) => `<section class="ob-slide">${m}<h2>${t}</h2><p class="sec">${d}</p></section>`).join('')}</div>
    <div class="ob-dots" id="ob-dots">${slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
}
function obBody(k) {
  if (k === 'home') return `<div class="ob-hero"><h1>Add Job’s Done to your Home Screen</h1><p class="sec">It opens full screen like an app, keeps you signed in, and can notify you when rest is over.</p></div>
    ${isStandalone() ? `<div class="note ok">You’re already using Job’s Done from your Home Screen. Nice.</div>` : `<div class="seg"><button data-os="ios" class="${OB.os === 'ios' ? 'on' : ''}">iPhone</button><button data-os="android" class="${OB.os === 'android' ? 'on' : ''}">Android</button></div>
    ${OB.os === 'android' && installEvt ? '<button class="btn block" id="ob-inst">Install now</button>' : ''}${installSteps(OB.os)}<p class="cap">Then open Job’s Done from its new icon and sign in once more. You can find these steps again in Me.</p>`}`;
  if (k === 'tour') return `<h1 class="ob-t">Here’s what Job’s Done does</h1>${obTour()}`;
  if (k === 'you') return `<h1 class="ob-t">About you</h1><p class="sec ob-s">Used for your progress charts. Only you can see it.</p>
    <div class="field"><label for="ob-name">First name</label><input class="input" id="ob-name" maxlength="40" value="${esc(OB.name)}" placeholder="What should we call you?" autocomplete="given-name"></div>
    <div class="field"><span class="lbl">Units</span><div class="seg"><button data-unit="kg" class="${OB.unit === 'kg' ? 'on' : ''}">kg</button><button data-unit="lb" class="${OB.unit === 'lb' ? 'on' : ''}">lb</button></div></div>
    <div class="grid2"><div class="field"><label for="ob-w">Weight today (${OB.unit})</label><input class="input num" id="ob-w" inputmode="decimal" value="${esc(OB.w)}" placeholder="For example 72.5"></div>
    <div class="field"><label for="ob-gw">Goal weight (${OB.unit})</label><input class="input num" id="ob-gw" inputmode="decimal" value="${esc(OB.gw)}" placeholder="Optional"></div></div>
    <div class="field"><label for="ob-h">Height (cm)</label><input class="input num" id="ob-h" inputmode="decimal" value="${esc(OB.h)}" placeholder="Optional"></div>`;
  if (k === 'goal') return `<h1 class="ob-t">What’s your goal?</h1><p class="sec ob-s">It sets your rep ranges and the plan we suggest.</p>
    <div class="tmpl">${Object.entries(OB_GOALS).map(([g, [n, d]]) => `<button data-goal="${g}" class="${OB.goal === g ? 'on' : ''}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>`;
  if (k === 'days') return `<h1 class="ob-t">How often do you plan to train?</h1><p class="sec ob-s">Be realistic. This sets your weekly goal and the plan we suggest. You can change it any time.</p>
    <div class="tmpl">${OB_DAYS.map(([n, t, d]) => `<button data-days="${n}" class="${OB.days === n ? 'on' : ''}"><b>${t}</b><span>${d}</span></button>`).join('')}</div>`;
  if (k === 'exp') return `<h1 class="ob-t">How long have you been lifting?</h1><p class="sec ob-s">Newer lifters get higher reps to learn the moves. You can change any target later.</p>
    <div class="tmpl">${Object.entries(OB_EXP).map(([e, [n, d, lo, hi]]) => `<button data-exp="${e}" class="${OB.exp === e ? 'on' : ''}"><b>${n}</b><span>${d} · ${lo} to ${hi} reps</span></button>`).join('')}</div>`;
  if (k === 'theme') return `<h1 class="ob-t">Pick your look</h1><p class="sec ob-s">Tap one to try it on this screen. Each theme has its own scenery and its own voice when you finish a set. You can switch any time in Me.</p>
    <div class="ob-themes">${THEMES.map(t => `<button data-th="${t.k}" class="${OB.theme === t.k ? 'on' : ''}"><i class="thp thp-${t.k}"></i><b>${t.name}</b><em class="ob-desc">${t.desc}</em><span>“${esc(pick(THEME_MSG[t.k].great))}”</span></button>`).join('')}</div>`;
  if (k === 'prefs') {
    const P = OB.prefs, row = (f, t, d) => `<div class="xr"><span class="grow">${t}<span class="s">${d}</span></span>${swi(!!P[f], '', `data-pf="${f}"`)}</div>`;
    return `<h1 class="ob-t">Sounds and alerts</h1><p class="sec ob-s">Pick what you want. You can change any of these later in Me.</p>
    <section><div class="sgh">Sound</div><div class="sgrp">${row('sound', 'Sounds', 'A short chime when you finish a set or a rest. Plays over your music. Turn silent mode off (the switch on the side of your iPhone) to hear it')}
    <section><div class="sgh">Notifications</div><div class="sgrp">${HOSTED ? row('push', 'Rest finished', pushReady() ? 'A notification when the timer ends, even when your phone is locked' : 'Available once Job’s Done is on your Home Screen. Turn it on later in Me') : ''}
    ${row('weigh', 'Daily weigh-in', 'Asks for your weight the first time you open the app each day')}</div></section>
    <section><div class="sgh">During workouts</div><div class="sgrp">${row('autoRest', 'Start rest automatically', 'The timer starts when you tick off a set')}
    ${row('wake', 'Keep screen awake', 'While a workout is open')}
    ${row('confetti', 'Celebrations', 'Confetti for PRs and finished workouts')}</div></section>`;
  }
  if (k === 'train') {
    const P = OB.prefs, seg = (f, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-pv="${f}" data-v="${v}" class="${String(P[f]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return `<h1 class="ob-t">How you train</h1><p class="sec ob-s">A few defaults for your workouts. All of them live in Me if you change your mind.</p>
    <div class="field"><span class="lbl">Rest between sets</span>${seg('rest', [[90, '1:30'], [120, '2:00'], [180, '3:00'], [240, '4:00'], [300, '5:00']])}</div>
    <div class="field"><span class="lbl">How you count weight on a barbell</span>${seg('bar', [[0, 'Plates only'], [1, 'Include the bar']])}<p class="m0 mt1 cap">${P.bar ? 'Two 20 kg plates on a 20 kg bar logs as 60 kg.' : 'Two 20 kg plates logs as 40 kg, whatever the bar.'}</p></div>
    <div class="field"><span class="lbl">Rep range <span class="cap">(optional)</span></span><p class="m0 cap">Your desired rep range before you move up to a heavier weight. Not sure? Skip it and we’ll use 6 to 9.</p>${repPick(P.repLo, P.repHi, 'ob')}</div>
    <div class="field"><span class="lbl">Daily step goal</span>${seg('steps', [[6000, '6k'], [8000, '8k'], [10000, '10k'], [12000, '12k'], [15000, '15k']])}</div>
    <div class="sgrp"><div class="xr"><span class="grow">Today’s targets<span class="s">Suggests the weight and reps to beat last time on every set</span></span>${swi(!!P.targets, '', 'data-pf="targets"')}</div></div>`;
  }
  if (k === 'safe') return `<h1 class="ob-t">Keep your account safe</h1><p class="sec ob-s">Optional. Two-step sign-in asks for a 6-digit code from an authenticator app when you sign in on a new device, so your password alone isn’t enough.</p>
    <div class="ob-code" aria-hidden="true"><span>4</span><span>8</span><span>2</span><i></i><span>9</span><span>1</span><span>7</span></div>
    <div class="seg"><button data-mfa="1" class="${OB.mfa ? 'on' : ''}">Set it up after this</button><button data-mfa="0" class="${OB.mfa ? '' : 'on'}">Not now</button></div>
    <p class="m0 cap">It takes about a minute with Apple Passwords or Google Authenticator. You can turn it on or off any time in Me → Account.</p>`;
  if (k === 'move') {
    const f = OB.importFile;
    return `<h1 class="ob-t">Coming from another app?</h1><p class="sec ob-s">If you logged workouts in Strong, Hevy or another app, bring them with you so your history, PRs and charts start where you left off.</p>
    <div class="seg"><button data-mv="1" class="${OB.move === true ? 'on' : ''}">Yes, I have a log</button><button data-mv="0" class="${OB.move === false ? 'on' : ''}">No, starting fresh</button></div>
    ${OB.move ? `<div class="card stack"><p class="m0">In your old app, find Export data in its settings and save your workouts as a CSV file, then choose it here.</p>
      <label class="btn block ${f ? '' : 'primary'}" for="ob-file">${f ? 'Chosen: ' + esc(f.name) : 'Choose CSV file'}</label><input type="file" id="ob-file" accept=".csv,text/csv" hidden>
      <p class="m0 cap">${f ? 'It will be added when you tap Start training.' : 'No file yet? Skip it for now.'}</p></div>` : ''}
    <p class="m0 cap">You can import any time later in Me → Import workouts from CSV.</p>
    <details><summary class="link">Have a Job’s Done backup? Restore it</summary><div class="mt3 stack"><p class="m0 cap">A JSON file from Me → Export.</p>
      <label class="btn block" for="wl-file">Choose backup file</label><input type="file" id="wl-file" accept=".json,.csv,application/json,text/csv" data-in="wlFile" hidden></div></details>`;
  }
  const rec = obPlan();
  return `<h1 class="ob-t">Pick a starting plan</h1><p class="sec ob-s">You said ${OB_DAYS[(OB.days || 3) - 1][1].toLowerCase()}, so we’ve suggested one. Every split can be renamed and edited later.</p>
    <div class="tmpl">${Object.entries(TEMPLATES).map(([k2, t]) => `<button data-t="${k2}" class="${(OB.plan || rec) === k2 ? 'on' : ''}"><b>${esc(t.n)}${k2 === rec ? ' <em class="ob-rec">Suggested</em>' : ''}</b><span>${esc(t.d)}</span></button>`).join('')}</div>`;
}
function renderWelcomePublic() {
  if (!OB) OB = { step: 0, os: devOS(), name: firstName() === 'there' ? '' : firstName(), unit: 'kg', w: '', gw: '', h: '', goal: 'muscle', days: null, exp: 'some', theme: theme(), plan: null, prefs: { sound: true, music: true, push: !!(HOSTED && pushReady()), autoRest: true, wake: true, weigh: true, confetti: true, rest: 120, bar: 1, steps: 10000, targets: true, plateau: true } };
  const k = OB_STEPS[OB.step], last = OB.step === OB_STEPS.length - 1;
  if (k === 'theme') { document.documentElement.classList.remove('ob-on'); applyTheme(OB.theme); } else { document.documentElement.classList.add('ob-on'); document.documentElement.dataset.theme = 'mono'; delete document.documentElement.dataset.tod; }
  const next = k === 'home' ? (isStandalone() ? 'Continue' : 'I’ve added it') : k === 'tour' ? 'Next' : last ? 'Start training' : 'Continue';
  $('#app').innerHTML = `<main id="screen" class="ob"><div class="ob-top"><button class="icon-btn ${OB.step ? '' : 'hide'}" id="ob-back" aria-label="Back">${I.left}</button><div class="ob-prog"><i style="width:${(OB.step + 1) / OB_STEPS.length * 100}%"></i></div></div>
    <div class="ob-body stack" data-k="${k}"><div class="ob-eb">Step ${OB.step + 1} of ${OB_STEPS.length} · ${OB_NAMES[k]}</div>${obBody(k)}</div>
    <div class="ob-foot"><div class="ob-err cap" id="ob-err"></div><button class="mh52 f17 btn primary block" id="ob-next">${next}</button>${k === 'home' && !isStandalone() ? '<button class="self-c link" id="ob-later">I’ll do it later</button>' : ''}</div></main>`;
  const q = x => $('#app').querySelector(x), qa = x => $('#app').querySelectorAll(x);
  const keep = () => { const f = id => { const e = q(id); return e ? e.value.trim() : null; }; const n = f('#ob-name'); if (n != null) { OB.name = n; OB.w = f('#ob-w'); OB.gw = f('#ob-gw'); OB.h = f('#ob-h'); } };
  const go = d => { keep(); OB.step = Math.max(0, Math.min(OB_STEPS.length - 1, OB.step + d)); renderWelcomePublic(); const sc = $('#screen'); if (sc) sc.scrollTop = 0; };
  q('#ob-back').onclick = () => go(-1);
  qa('#app input').forEach(i => i.addEventListener('input', () => { const e = q('#ob-err'); if (e) e.textContent = ''; }));
  qa('[data-os]').forEach(b => b.onclick = () => { OB.os = b.dataset.os; renderWelcomePublic(); });
  const ib = q('#ob-inst'); if (ib) ib.onclick = async () => { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; renderWelcomePublic(); };
  qa('[data-unit]').forEach(b => b.onclick = () => { keep(); OB.unit = b.dataset.unit; renderWelcomePublic(); });
  qa('[data-goal]').forEach(b => b.onclick = () => { OB.goal = b.dataset.goal; if (OB.goal === 'strength' && OB.exp !== 'new') OB.exp = 'pro'; renderWelcomePublic(); });
  qa('[data-days]').forEach(b => b.onclick = () => { OB.days = +b.dataset.days; OB.plan = null; renderWelcomePublic(); });
  qa('[data-exp]').forEach(b => b.onclick = () => { OB.exp = b.dataset.exp; OB.plan = null; renderWelcomePublic(); });
  qa('[data-th]').forEach(b => b.onclick = () => { OB.theme = b.dataset.th; const y = $('#screen') ? $('#screen').scrollTop : 0; renderWelcomePublic(); if ($('#screen')) $('#screen').scrollTop = y; });
  qa('[data-rr]').forEach(el => el.onchange = () => { OB.prefs[el.dataset.rr === '0' ? 'repLo' : 'repHi'] = +el.value || null; fixRR(OB.prefs, 'repLo', 'repHi'); renderWelcomePublic(); });
  qa('[data-pv]').forEach(b => b.onclick = () => { const v = +b.dataset.v; OB.prefs[b.dataset.pv] = v; renderWelcomePublic(); });
  qa('[data-pf]').forEach(b => b.onclick = async () => {
    const f = b.dataset.pf, on = !OB.prefs[f];
    if (f === 'push' && on) { if (!pushReady()) { toast('Add Job’s Done to your Home Screen first. You can turn this on later in Me.'); return; } if (!(await pushOn())) return; }
    OB.prefs[f] = on; renderWelcomePublic();
  });
  qa('[data-mv]').forEach(b => b.onclick = () => { OB.move = b.dataset.mv === '1'; renderWelcomePublic(); });
  qa('[data-mfa]').forEach(b => b.onclick = () => { OB.mfa = b.dataset.mfa === '1'; renderWelcomePublic(); });
  const of = q('#ob-file'); if (of) of.onchange = () => { if (of.files && of.files[0]) { OB.importFile = of.files[0]; renderWelcomePublic(); } };
  qa('[data-t]').forEach(b => b.onclick = () => { OB.plan = b.dataset.t; qa('[data-t]').forEach(x => x.classList.toggle('on', x === b)); });
  const tr = q('#ob-tour'); if (tr) tr.onscroll = () => { const i = Math.round(tr.scrollLeft / tr.clientWidth); qa('#ob-dots i').forEach((d, j) => d.classList.toggle('on', i === j)); q('#ob-next').textContent = i >= tr.children.length - 1 ? 'Set me up' : 'Next'; };
  const lt = q('#ob-later'); if (lt) lt.onclick = () => { OB.skippedHome = true; go(1); };
  q('#ob-next').onclick = () => {
    keep(); const err = m => { q('#ob-err').textContent = m; };
    if (k === 'tour' && tr && Math.round(tr.scrollLeft / tr.clientWidth) < tr.children.length - 1) { tr.scrollBy({ left: tr.clientWidth, behavior: 'smooth' }); return; }
    if (k === 'days' && !OB.days) return err('Pick how often you plan to train.');
    if (k === 'prefs' && OB.prefs.push && HOSTED && pushReady() && !(window.Notification && Notification.permission === 'granted')) { pushOn().then(ok => { if (!ok) OB.prefs.push = false; go(1); }); return; }
    if (k === 'you') { if (!OB.name) return err('Add your first name.'); const w = parseFloat(OB.w); if (!(w > 20 && w < 700)) return err('Add your weight today so your charts have a starting point.'); }
    if (!last) return go(1);
    obFinish();
  };
}
function obFinish() {
  S = freshState(); S.imported = true; S.profile.legacy = 0;
  const p = S.profile, num = x => { const v = parseFloat(x); return isNaN(v) ? null : v; };
  p.name = OB.name.slice(0, 40); p.unit = OB.unit; p.weeklyTarget = OB.days || 3; p.goal = OB.goal; p.exp = OB.exp; p.theme = OB.theme; p.cliffs1 = true; p.onboarded = today();
  if (!OB.skippedHome) p.a2hs = today();
  const pf = OB.prefs || {}; p.sound = pf.sound !== false; p.soundSilent = false; p.music2 = true; p.musicOk = true; p.restPush = !!pf.push; p.noAutoRest = pf.autoRest === false; p.noWake = pf.wake === false; p.noWeighPrompt = pf.weigh === false; p.noConfetti = pf.confetti === false; if (pf.rest) p.defaultRest = pf.rest; p.rest5 = true; if (pf.bar === 0) p.barW = 0; if (pf.steps) p.stepGoal = pf.steps; p.noTargets = pf.targets === false; if (pf.plateau === false) p.noPlateau = true; if (pf.repLo && pf.repHi > pf.repLo) p.repRange = [pf.repLo, pf.repHi];
  const toKg2 = v => v == null ? null : Math.round((OB.unit === 'lb' ? v / LB : v) * 100) / 100;
  const w = toKg2(num(OB.w)), gw = toKg2(num(OB.gw)), h = num(OB.h);
  if (w) S.weights[today()] = { w, src: 'manual' };
  if (gw) p.goalW = gw; if (h && h > 90 && h < 250) p.heightCm = Math.round(h);
  const [, , lo, hi] = OB_EXP[OB.exp]; const lo2 = OB.goal === 'strength' ? lo - 1 : lo, hi2 = OB.goal === 'strength' ? hi - 2 : hi;
  for (const [name, ex] of TEMPLATES[OB.plan || obPlan()].s) { const id = 'sp-' + uid(); S.splits.push({ id, name, color: SPLIT_COLORS[name] || PALETTE[S.splits.length % PALETTE.length], archived: false, ex: ex.map(n => ({ name: n, sets: 3, repMin: lo2, repMax: hi2, rest: (OB.prefs && OB.prefs.rest) || 120, note: '' })) }); S.rotation.push(id); }
  if (UI) UI.lastPrompt = today();
  const imp = OB.move && OB.importFile, mfa = OB.mfa && HOSTED;
  if (mfa) setTimeout(() => openMfa(), imp ? 4000 : 1200);
  applyTheme(OB.theme); OB = null; document.documentElement.classList.remove('ob-on');
  if (imp) { finishImport(''); setTimeout(() => importCSVFile(imp), 500); return; }
  finishImport(S.splits.length ? `You’re all set, ${p.name}. Your first workout is ready.` : 'Ready. Add a split to get started.');
}

// ---------- CSV import / export ----------
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function csvToWorkouts(text) {
  const rows = parseCSV(text); if (rows.length < 2) return { err: 'That file has no rows.' };
  const h = rows[0].map(x => x.trim().toLowerCase());
  const col = (...names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = { date: col('date', 'start_time'), split: col('split', 'split_name', 'workout name', 'title'), ex: col('exercise', 'exercise name', 'exercise_title'), w: col('weight_kg', 'weight', 'weight (kg)'), lb: col('weight_lbs', 'weight (lbs)', 'weight (lb)'), r: col('reps'), t: col('set_type', 'set order'), note: col('notes', 'note', 'exercise_notes') };
  if (c.date < 0 || c.ex < 0) return { err: 'Couldn’t find date and exercise columns. Expected Job’s Done, Strong or Hevy CSV headers.' };
  const map = {};
  for (const r of rows.slice(1)) {
    const raw = (r[c.date] || '').trim(); let d = (raw.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
    if (!d) { const p = Date.parse(raw); if (!isNaN(p)) d = ymd(new Date(p)); }
    if (!d) continue;
    const sp = c.split >= 0 ? (r[c.split] || '').trim() || 'Workout' : 'Workout';
    const key = d + '|' + sp; const w = map[key] || (map[key] = { date: d, splitName: sp, ex: [], skipped: false });
    const ex = (r[c.ex] || '').trim();
    if (!ex) { if (/skip/i.test(r[c.note] || '')) w.skipped = true; continue; }
    let e = w.ex[w.ex.length - 1]; if (!e || e.name !== ex) { e = { name: ex, note: '', sets: [] }; w.ex.push(e); }
    // Strong and Hevy export pounds in a separate column; set types come as warmup/dropset/failure (Hevy) or W/D/F (Strong).
    const wkg = parseFloat(r[c.w]), wlb = parseFloat(r[c.lb]), wt = !isNaN(wkg) ? wkg : isNaN(wlb) ? NaN : Math.round(wlb / LB * 4) / 4, rp = parseInt(r[c.r], 10);
    const ty = (r[c.t] || '').trim().toLowerCase(), t = /^(w|warm)/.test(ty) ? 'warm' : /^(d|drop)/.test(ty) ? 'drop' : /^(f|fail)/.test(ty) ? 'fail' : 'work';
    e.sets.push({ w: isNaN(wt) ? null : wt, r: isNaN(rp) ? null : rp, t });
    const nt = c.note >= 0 ? (r[c.note] || '').trim() : ''; if (nt && !e.note) e.note = nt;
  }
  return { list: Object.values(map), lb: c.w < 0 && c.lb >= 0 };
}
function importCSVFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    const res = csvToWorkouts(String(rd.result));
    if (res.err) { toast(esc(res.err), 4000); return; }
    const existing = new Set(Object.values(S.workouts).map(w => w.date + '|' + w.splitName));
    const fresh = res.list.filter(w => !existing.has(w.date + '|' + w.splitName));
    const known = new Set([...LIB.map(e => e.name), ...S.customEx.map(e => e.name), ...Object.keys(ix().hist).map(baseName)]);
    const unknown = [...new Set(fresh.flatMap(w => w.ex.map(e => baseName(e.name))))].filter(n => !known.has(n));
    const dates = fresh.map(w => w.date).sort();
    const sh = openSheet(`<div class="stack"><div class="eyebrow">Import preview</div>
      <div class="kpis"><div class="kpi"><b>${fresh.length}</b><span>new workouts</span></div><div class="kpi"><b>${fresh.reduce((a, w) => a + wSets(w), 0)}</b><span>sets</span></div><div class="kpi"><b>${res.list.length - fresh.length}</b><span>already here</span></div></div>
      ${dates.length ? `<div class="cap">${fmtDate(dates[0], { y: true })} to ${fmtDate(dates[dates.length - 1], { y: true })}. ${res.lb ? 'Pounds are converted to kg.' : 'Weights are read as kg.'}</div>` : ''}
      ${unknown.length ? `<div class="note">New exercise names (added as custom): ${esc(unknown.join(', '))}</div>` : ''}
      <button class="btn primary block" id="ci-go" ${fresh.length ? '' : 'disabled'}>Import ${plural(fresh.length, 'workout')}</button><button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, {
      label: 'Import preview',
      mount: b => {
        b.querySelector('#ci-go').onclick = () => {
          const months = new Set();
          for (const w of fresh) { const id = 'csv-' + uid(); const sp = S.splits.find(s => s.name === w.splitName); S.workouts[id] = { id, date: w.date, splitId: sp ? sp.id : null, splitName: w.splitName, start: null, end: null, note: '', energy: null, src: 'import', skipped: w.skipped, ex: w.ex }; months.add(monthPath(w.date)); }
          for (const n of unknown) S.customEx.push({ name: n, muscle: 'Other', equip: 'other' });
          invalidate(); persist('jd/meta', ...months); closeSheet(sh); rerender(); toast(`Imported ${plural(fresh.length, 'workout')}`);
        };
      },
    });
  };
  rd.readAsText(file);
}
function exportCSV() {
  const lines = ['date,split,exercise,set_number,weight_kg,reps,notes'];
  const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  for (const w of Object.values(S.workouts).sort(sortW)) {
    if (w.skipped) { lines.push([w.date, q(w.splitName), '', '', '', '', 'skipped'].join(',')); continue; }
    for (const e of w.ex) e.sets.forEach((s, i) => lines.push([w.date, q(w.splitName), q(e.name), i + 1, s.w == null ? '' : s.w, s.r == null ? '' : s.r, q(e.note || '')].join(',')));
  }
  return lines.join('\n') + '\n';
}
async function doExport(kind) {
  const data = kind === 'json' ? JSON.stringify({ exportedAt: new Date().toISOString(), ...S }, null, 2) : exportCSV();
  const filename = `jobdone-${today()}.${kind}`;
  if (HOSTED) {
    const url = URL.createObjectURL(new Blob([data], { type: kind === 'json' ? 'application/json' : 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast('Export downloaded'); return;
  }
  if (DL) {
    try { await DL.save({ filename, data }); toast('Export saved'); return; }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('A save prompt is already open.'); return; } }
  }
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Export</div><p class="m0 cap">Saving files isn’t available here. Copy the text below instead.</p><textarea class="f13 input num" style="min-height:240px" readonly id="ex-t"></textarea><button class="btn primary block" id="ex-c">Copy</button></div>`, {
    mount: b => { const t = b.querySelector('#ex-t'); t.value = data; b.querySelector('#ex-c').onclick = () => { navigator.clipboard.writeText(data).then(() => toast('Copied'), () => { t.focus(); t.select(); }); }; },
  });
}
async function eraseAll() {
  const paths = allPaths();
  S = null; A = null; REST = null; invalidate();
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
  if (DB) for (const p of paths) { try { await DB.doc(p).delete(); } catch (e) {} }
  welcomeOv = {}; NAV = { tab: 'today', stack: [], prog: 'body', range: '6M' };
  $('#app').innerHTML = ''; renderWelcome();
}

// ---------- events ----------
const ACT = {
  closeSheet: () => closeSheet(),
  glossary: el => openGlossary(el.dataset.k),
  tab: el => { if (el.dataset.k === 'today' && NAV.tab === 'today' && !NAV.stack.length) VIEWDAY = null; NAV.tab = el.dataset.k; NAV.stack = []; render(); },
  back: () => back(),
  start: () => { if (S && S.profile && !S.profile.hint1 && S.profile.onboarded) { S.profile.hint1 = true; persist('jd/meta'); const c = document.getElementById('coach'); if (c) c.remove(); } openStart(); },
  resume: () => openWk(),
  weigh: el => openWeighIn(el.dataset.k || today()),
  viewDay: el => setViewDay(el.dataset.k || null),
  logDay: el => startWorkout(el.dataset.id || null, el.dataset.k),
  openW: el => go({ v: 'workout', id: el.dataset.id }),
  weighDate: el => openWeighIn(el.dataset.d || null, false),
  weights: () => go({ v: 'weights' }),
  steps: el => openSteps(el && el.dataset.k),
  syncKey: () => openSyncKey(),
  setPassword: () => openSetPassword(),
  mfa: () => openMfa(),
  prog: el => { NAV.tab = 'progress'; NAV.stack = []; NAV.prog = el.dataset.k; render(); },
  range: el => { NAV.range = el.dataset.k; rerender(); },
  startSplit: el => startWorkout(el.dataset.id),
  day: el => setViewDay(el.dataset.k || null),
  wkDay: () => openWkDay(),
  openSplit: el => go({ v: 'split', id: el.dataset.id }),
  editSplit: el => go({ v: 'splitEdit', id: el.dataset.id }),
  openEx: el => go({ v: 'exercise', name: el.dataset.name }),
  openWk: el => go({ v: 'workout', id: el.dataset.id }),
  exSel: el => { NAV.stack[NAV.stack.length - 1].sel = el.dataset.k; rerender(); },
  exMetric: el => { NAV.stack[NAV.stack.length - 1].metric = el.dataset.k; rerender(); },
  rotation: () => openRotation(),
  plates: () => openPlates(0, null),
  // Hevy/Strong users ask for "repeat this workout": same lifts and set count, numbers filled from the latest time
  goal: el => openGoal(el.dataset.k),
  restWeek: el => { const k = el.dataset.k, r = S.profile.restWeeks || []; S.profile.restWeeks = r.includes(k) ? r.filter(x => x !== k) : [...r, k]; persist('jd/meta'); rerender(); },
  repeatWk: () => { const w = S.workouts[NAV.stack[NAV.stack.length - 1].id]; if (!w) return;
    if (A) return toast('Finish or discard the workout in progress first.');
    const sp = w.splitId && splitById(w.splitId);
    A = { id: uid(), splitId: sp ? sp.id : null, splitName: w.splitName || 'Workout', start: Date.now(), touched: Date.now(), ex: w.ex.map(e => { const se = sp && sp.ex.find(x => x.name === e.name) || {}; return newExEntry(e.name, e.sets.length, se.rest, se.note); }), orig: w.ex.map(e => e.name), view: 'log' };
    persist('jd/active'); NAV.stack = []; NAV.tab = 'today'; render(); openWk(); },
  recap: el => showRecap(el.dataset.id || NAV.stack[NAV.stack.length - 1].id),
  exCat: el => openExForm(el.dataset.k),
  myEx: () => openMyExercises(),
  newSplit: () => openNewSplit(),
  newBlankSplit: () => { closeSheet(); const id = 'sp-' + uid(); S.splits.push({ id, name: 'New split', color: PALETTE[S.splits.length % PALETTE.length], archived: false, ex: [] }); persist('jd/meta'); NAV.tab = 'splits'; NAV.stack = [{ v: 'split', id }, { v: 'splitEdit', id }]; render(); },
  spColor: el => { splitById(el.dataset.id).color = el.dataset.c; persist('jd/meta'); rerender(); },
  spMove: el => { const sp = splitById(el.dataset.id), i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= sp.ex.length) return; [sp.ex[i], sp.ex[j]] = [sp.ex[j], sp.ex[i]]; persist('jd/meta'); rerender(); },
  spRemove: el => { const sp = splitById(el.dataset.id); sp.ex.splice(+el.dataset.i, 1); persist('jd/meta'); rerender(); },
  spAdd: el => { const sp = splitById(el.dataset.id); pickExercise(name => { const l = lastSession(name); sp.ex.push({ name, sets: l ? Math.max(2, l.sets.length) : 3, repMin: 6, repMax: 10, rest: S.profile.defaultRest, note: '' }); persist('jd/meta'); rerender(); }); },
  spDup: el => { const sp = splitById(el.dataset.id); const id = 'sp-' + uid(); S.splits.push({ ...clone(sp), id, name: sp.name + ' copy', archived: false }); persist('jd/meta'); NAV.stack = [{ v: 'split', id }, { v: 'splitEdit', id }]; render(); toast('Split duplicated'); },
  spShare: el => shareSplit(splitById(el.dataset.id)),
  spDelete: el => { const sp = splitById(el.dataset.id); if (!sp) return; if (A && A.splitId === sp.id) return toast('Finish or discard the workout using this split first.');
    confirmSheet({ title: 'Delete ' + sp.name + '?', body: 'The split is removed. Workouts you already logged with it stay in your history.', ok: 'Delete split', danger: true, onOk: () => { const was = S.splits.slice(), rot = S.rotation.slice(); S.splits = S.splits.filter(x => x.id !== sp.id); S.rotation = S.rotation.filter(x => x !== sp.id); persist('jd/meta'); NAV.stack = []; render(); toast(esc(sp.name) + ' deleted', 0, () => { S.splits = was; S.rotation = rot; persist('jd/meta'); render(); toast(esc(sp.name) + ' restored'); }); } }); },
  spArchive: el => { const sp = splitById(el.dataset.id); sp.archived = !sp.archived; if (sp.archived) S.rotation = S.rotation.filter(x => x !== sp.id); persist('jd/meta'); NAV.stack = []; render(); toast(sp.archived ? sp.name + ' archived' : sp.name + ' restored'); },
  wkEdit: () => { const t = NAV.stack[NAV.stack.length - 1]; t.edit = !t.edit; rerender(); },
  wsDel: el => { const t = NAV.stack[NAV.stack.length - 1], w = S.workouts[t.id]; const e = w.ex[+el.dataset.e]; e.sets.splice(+el.dataset.s, 1); if (!e.sets.length) w.ex.splice(+el.dataset.e, 1); invalidate(); persist(monthPath(w.date)); rerender(); },
  wkDelete: el => { const t = NAV.stack[NAV.stack.length - 1], id = (el && el.dataset.id) || (t && t.id), w = S.workouts[id]; if (!w) return; confirmSheet({ title: 'Delete this workout?', body: `${esc(w.splitName)} on ${esc(fmtDate(w.date, { wd: true }))}. `, ok: 'Delete', danger: true, onOk: () => { delete S.workouts[w.id]; invalidate(); persist(monthPath(w.date)); if (t && t.id === w.id) back(); else render(); toast('Workout deleted', 0, () => { S.workouts[w.id] = w; invalidate(); persist(monthPath(w.date)); render(); toast('Workout restored'); }); } }); },
  unit: el => { S.profile.unit = el.dataset.k; persist('jd/meta'); rerender(); },
  theme: el => { S.profile.theme = el.dataset.k; applyTheme(el.dataset.k); persist('jd/meta'); rerender(); },
  export: el => doExport(el.dataset.k),
  reset: () => confirmSheet({ title: 'Erase everything?', body: 'Workouts, weights, steps and splits are deleted from your account and this device. Export first if you want a copy.', ok: 'Erase all data', danger: true, onOk: eraseAll }),
  signOut: () => DEMO ? (location.hash = '', location.reload()) : confirmSheet({ title: 'Sign out?', body: 'Your data stays in your account. Sign in again to see it.', ok: 'Sign out', onOk: async () => { await flushNow(); try { localStorage.removeItem(LS_KEY); } catch (e) {} await SB.auth.signOut(); } }),
  doImport: () => doImport(true),
  skipImport: () => doImport(false),
  // workout
  minWk: () => minimizeWk(),
  finish: () => {
    const work = A.ex.flatMap(e => e.sets.filter(s => s.t !== 'warm')), left = work.filter(s => !s.done).length;
    const go = () => { A.view = 'summary'; touchA(); if (!left) setTimeout(() => confetti(90), 250); };
    if (left && work.length - left > 0) confirmSheet({ title: `${plural(left, 'set')} left. Finish anyway?`, body: 'Sets you didn’t tick off aren’t saved. You can keep going instead.', ok: 'Finish workout', onOk: go });
    else go();
  },
  sumBack: () => { A.view = 'log'; touchA(); },
  saveWk: () => saveWorkout(),
  energy: el => { A.energy = +el.dataset.k; touchA(); },
  key: el => el.dataset.f === 'w' && usesPlates(A.ex[+el.dataset.e].name) ? openSetPlates(+el.dataset.e, +el.dataset.s) : openKeypad(+el.dataset.e, +el.dataset.s, el.dataset.f),
  done: el => logSet(+el.dataset.e, +el.dataset.s),
  rpe: el => { const st = A.ex[+el.dataset.e].sets[+el.dataset.s], k = +el.dataset.k; st.rpe = st.rpe === k ? null : k; A.rpeAsk = null; touchA(); },
  setType: el => { const s = A.ex[+el.dataset.e].sets[+el.dataset.s]; const o = ['work', 'warm', 'drop', 'fail']; s.t = o[(o.indexOf(s.t) + 1) % o.length]; touchA(); },
  addSet: el => { const e = A.ex[+el.dataset.e]; const p = e.sets[e.sets.length - 1]; e.sets.push({ w: p ? p.w : null, r: p ? p.r : null, t: 'work', done: false }); touchA(); },
  rmSet: el => { const e = A.ex[+el.dataset.e]; if (e.sets.length < 2) return; const gone = e.sets.pop(); touchA(); if (gone.done) toast('Logged set removed', 0, () => { if (A && A.ex.includes(e)) { e.sets.push(gone); touchA(); } }); },
  exMenu: el => exMenu(+el.dataset.e),
  swapEx: el => openSwap(+el.dataset.e),
  foldEx: el => { const ei = +el.dataset.e, e = A.ex[ei], shut = !!document.querySelector('#ex-' + ei + '.folded'); e.fold = !shut; persist('jd/active'); renderWorkout(); },
  plHide: el => { UI.plHide = UI.plHide || {}; UI.plHide[el.dataset.name] = today(); lsSave(); rerender(); toast('Hidden for 2 weeks'); },
  month: el => showMonth(el.dataset.k),
  allBadges: () => openBadges(),
  meas: () => openMeas(),
  a2hs: () => openInstallGuide(false),
  feedback: () => openFeedback(),
  fbInbox: () => openInbox(),
  delAccount: () => openDeleteAccount(),
  photos: () => openPhotos(),
  setup: el => openSetup(el.dataset.name),
  wkAddEx: () => pickExercise(name => { A.ex.push(newExEntry(name)); touchA(); const b = $('#wk .wk-body'); if (b) setTimeout(() => b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }), 50); }),
  wkDiscard: () => confirmSheet({ title: 'Discard this workout?', body: 'Nothing from it will be saved.', ok: 'Discard', danger: true, onOk: () => { A = null; REST = null; persist('jd/active'); if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } render(); } }),
  rest: el => { const d = +el.dataset.d; if (!REST) return; if (d === 0) REST = null; else { if (REST.paused) REST.left = Math.max(1, REST.left + d); else REST.end += d * 1000; REST.total = Math.max(REST.total + d, restLeft(), 1); } renderWorkout(); },
  restPause: () => { if (!REST) return; if (REST.paused) { REST.end = Date.now() + REST.left * 1000; REST.paused = false; } else { REST.left = restLeft(); REST.paused = true; } renderWorkout(); },
  restMin: () => { if (REST) { REST.min = true; renderWorkout(); } },
  restOpen: () => { if (REST) { REST.min = false; renderWorkout(); } },
  soundSilent: el => { S.profile.soundSilent = !!el.dataset.k; persist('jd/meta'); if (!S.profile.soundSilent) { if (navigator.audioSession) try { navigator.audioSession.type = 'auto'; } catch (e) {} if (Sound.media) { try { Sound.media.pause(); } catch (e) {} Sound.media = null; } } Sound.unlock(); rerender(); },
  soundTest: () => { const was = S.profile.sound; S.profile.sound = true; sfxLast = null; const p = SOUNDS.amazing(); S.profile.sound = was; Promise.resolve(p).then(() => toast(sfxLast ? `Sound blocked (${esc(sfxLast.name || String(sfxLast))}). Tap again.` : 'Played a test sound. Heard nothing? Your phone is on silent.', 4200)); },
  restPush: async () => {
    if (S.profile.restPush) { S.profile.restPush = false; persist('jd/meta'); rerender(); pushOff(); return; }
    if (!pushReady()) { toast('Add Job’s Done to your Home Screen first, then open it from there.'); openInstallGuide(false); return; }
    const ok = await pushOn(); if (ok) { S.profile.restPush = true; persist('jd/meta'); toast('Rest alerts are on. Sending a test now.'); restFn({ action: 'test' }); } rerender();
  },
  pset: el => { const f = el.dataset.f; S.profile[f] = !S.profile[f]; persist('jd/meta'); rerender(); },
  soundToggle: () => { S.profile.sound = S.profile.sound === false; persist('jd/meta'); rerender(); if (S.profile.sound) SOUNDS.nice(); },
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]'); if (!el || el.disabled) return;
  const f = ACT[el.dataset.a]; if (f) { ev.preventDefault(); f(el, ev); }
});
const IN = {
  viewDay: el => { if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) setViewDay(el.value); },
  spName: (el, live) => { const sp = splitById(el.dataset.id); const v = el.value.trim(); if (!v) return; sp.name = v; Object.values(S.workouts).forEach(w => { if (w.splitId === sp.id) w.splitName = v; }); persist('jd/meta', ...(live ? [] : allPaths().filter(p => p.startsWith('months/')))); },
  spEx: el => { const sp = splitById(el.dataset.id), e = sp.ex[+el.dataset.i], f = el.dataset.f; if (f === 'note') e.note = el.value; else { const v = parseInt(el.value, 10); if (!isNaN(v) && v >= 0) e[f] = v; if (e.repMax < e.repMin) e.repMax = e.repMin; } persist('jd/meta'); },
  profT: el => { const v = el.value.trim().slice(0, 30); if (v) { S.profile.name = v; persist('jd/meta'); } },
  profW: el => { const v = parseFloat(el.value); S.profile.goalW = !isNaN(v) && v > 0 ? Math.round(toKg(v) * 100) / 100 : null; persist('jd/meta'); },
  repR: el => { const r = (S.profile.repRange || [null, null]).slice(); r[+el.dataset.rr] = +el.value || null; const o = { lo: r[0], hi: r[1] }; fixRR(o, 'lo', 'hi'); S.profile.repRange = o.lo && o.hi ? [o.lo, o.hi] : o.lo || o.hi ? [o.lo, o.hi] : null; persist('jd/meta'); rerender(); },
  prof: el => { const v = parseInt(el.value, 10); if (!isNaN(v) && v > 0) { S.profile[el.dataset.f] = v; persist('jd/meta'); } },
  wkDate: el => { const t = NAV.stack[NAV.stack.length - 1], w = S.workouts[t.id]; if (!/^\d{4}-\d{2}-\d{2}$/.test(el.value)) return; const old = monthPath(w.date); w.date = el.value; invalidate(); persist(old, monthPath(w.date)); rerender(); },
  wkSplit: el => { const t = NAV.stack[NAV.stack.length - 1], w = S.workouts[t.id]; const sp = splitById(el.value); w.splitId = sp.id; w.splitName = sp.name; invalidate(); persist(monthPath(w.date)); rerender(); },
  wkNote: el => { const t = NAV.stack[NAV.stack.length - 1], w = S.workouts[t.id]; w.note = el.value; persist(monthPath(w.date)); },
  wsSet: el => { const t = NAV.stack[NAV.stack.length - 1], w = S.workouts[t.id]; const s = w.ex[+el.dataset.e].sets[+el.dataset.s]; const v = parseFloat(el.value); if (el.dataset.f === 'w') s.w = isNaN(v) ? null : Math.round(toKg(v) * 1000) / 1000; else s.r = isNaN(v) ? null : Math.round(v); invalidate(); persist(monthPath(w.date)); },
  sumNote: el => { A.note = el.value; A.touched = Date.now(); persist('jd/active'); },
  sumUpd: el => { A.updSplit = el.checked; },
  wlFile: el => { const f = el.files && el.files[0]; if (f) restoreFile(f, false); el.value = ''; },
  bkFile: el => { const f = el.files && el.files[0]; if (f) restoreFile(f, true); el.value = ''; },
  csvFile: el => { const f = el.files && el.files[0]; if (f) importCSVFile(f); el.value = ''; },
  wlDate: el => { const i = +el.dataset.i; if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) welcomeOv[i] = { ...(welcomeOv[i] || {}), d: el.value }; },
  wlSplit: el => { const i = +el.dataset.i; welcomeOv[i] = { ...(welcomeOv[i] || {}), s: el.value }; },
};
document.addEventListener('change', ev => { const el = ev.target.closest('[data-in]'); if (el && IN[el.dataset.in]) IN[el.dataset.in](el, false); });
document.addEventListener('input', ev => { const el = ev.target.closest('[data-in]'); if (el && ['spName', 'spEx', 'sumNote', 'wkNote'].includes(el.dataset.in)) IN[el.dataset.in](el, true); });
// chart scrubbing
let scrubEl = null;
document.addEventListener('pointerdown', ev => { const c = ev.target.closest('.chart'); if (c && !c.closest('button')) { scrubEl = c; scrub(c, ev.clientX); } });
document.addEventListener('pointermove', ev => { const c = scrubEl || (ev.pointerType === 'mouse' && ev.target.closest('.chart')); if (c && !c.closest('button')) scrub(c, ev.clientX); });
document.addEventListener('pointerup', () => { if (scrubEl) { const c = scrubEl; setTimeout(() => endScrub(c), 1400); scrubEl = null; } });
document.addEventListener('pointerout', ev => { if (ev.pointerType === 'mouse') { const c = ev.target.closest('.chart'); if (c && !c.contains(ev.relatedTarget)) endScrub(c); } });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && SHEETS.length) closeSheet(); });
let rsT = null; window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { if (ready && S && $('#screen') && !SHEETS.length) rerender(); }, 200); });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !DB || !S || dirty.size || inflight.size || SHEETS.length) return;
  try { if (await loadCloud()) { lsSave(); rerender(); } } catch (e) {}
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ready) setTimeout(maybeStale, 400); });
setInterval(tick, 500);
document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active styles show on iPhone
// Swipe a set row right to log it; swipe in from the left edge to go back.
let sw = null;
document.addEventListener('touchstart', e => {
  const t = e.touches[0], row = e.target.closest('#wk tr[id^="row-"]');
  if (row && !e.target.closest('.cell')) sw = { kind: 'set', el: row, x: t.clientX, y: t.clientY, dx: 0 };
  else if (t.clientX < 24 && NAV.stack.length && !SHEETS.length && !(A && A.open) && e.target.closest('#screen')) sw = { kind: 'back', x: t.clientX, y: t.clientY, dx: 0 };
  else sw = null;
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!sw) return; const t = e.touches[0]; sw.dx = t.clientX - sw.x; const dy = Math.abs(t.clientY - sw.y);
  if (dy > 30 && Math.abs(sw.dx) < dy) { if (sw.el) sw.el.style.transform = ''; sw = null; return; }
  if (sw.kind === 'set' && sw.dx > 0) { sw.el.style.transition = 'none'; sw.el.style.transform = `translateX(${Math.min(90, sw.dx)}px)`; }
  if (sw.kind === 'back' && sw.dx > 0) { const sc = $('#screen'); sc.style.transition = 'none'; sc.style.transform = `translateX(${Math.min(120, sw.dx * 0.6)}px)`; }
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!sw) return; const s0 = sw; sw = null;
  if (s0.kind === 'set') {
    s0.el.style.transition = 'transform .2s ease'; s0.el.style.transform = '';
    if (s0.dx > 70) { const [, ei, si] = s0.el.id.split('-').map(Number); logSet(ei, si); }
  } else {
    const sc = $('#screen'); sc.style.transition = 'transform .2s ease'; sc.style.transform = '';
    if (s0.dx > 90) back();
  }
});

// ---------- boot ----------
// ---------- Feedback and account deletion ----------
function openFeedback() {
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Send feedback</div><div class="cap">Ideas, bugs, anything that felt off. It goes straight to the person who builds Job’s Done.</div>
    <textarea class="input" id="fb-t" maxlength="2000" rows="5" placeholder="What happened, or what would make Job’s Done better?"></textarea>
    <button class="btn primary block" id="fb-s">Send</button></div>`, { label: 'Send feedback', mount: b => {
    b.querySelector('#fb-s').onclick = async ev => {
      const t = b.querySelector('#fb-t').value.trim(); if (!t) return;
      if (!(HOSTED && USER && SB)) { toast('Sign in to send feedback.'); return; }
      ev.currentTarget.disabled = true;
      const { error } = await SB.from('jobdone_feedback').insert({ user_id: USER.id, email: USER.email || null, body: t.slice(0, 2000) });
      if (error) { ev.currentTarget.disabled = false; toast('Couldn’t send it. Check your signal and try again.'); return; }
      closeSheet(sh); toast('Thanks! Feedback sent.');
    };
  } });
}
async function openInbox() {
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Feedback inbox</div><div id="ib" class="cap">Loading…</div></div>`, { label: 'Feedback inbox', mount: async b => {
    const { data, error } = await SB.from('jobdone_feedback').select('email,body,created_at').order('created_at', { ascending: false }).limit(100);
    b.querySelector('#ib').innerHTML = error ? 'Couldn’t load feedback.' : !data.length ? 'No feedback yet.' : `<div class="list">${data.map(f => `<div class="li"><div class="grow"><div class="t f15 pre">${esc(f.body)}</div><div class="s">${esc(f.email || 'unknown')} · ${esc(fmtDate(f.created_at.slice(0, 10)))}</div></div></div>`).join('')}</div>`;
  } });
}
function openDeleteAccount() {
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Delete account</div>
    <p class="m0 f15">This permanently deletes your account and everything in it: workouts, weights, steps, splits, measurements and photos. It can’t be undone.</p>
    <p class="m0 cap">Want a copy first? Use Me → Your data → Export backup.</p>
    <div class="field"><label for="da-t">Type DELETE to confirm</label><input class="input" id="da-t" autocomplete="off" autocapitalize="characters"></div>
    <button class="btn block danger-fill" id="da-go" disabled>Delete my account</button><button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, { label: 'Delete account', mount: b => {
    const go = b.querySelector('#da-go');
    b.querySelector('#da-t').oninput = e => { go.disabled = e.target.value.trim().toUpperCase() !== 'DELETE'; };
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Deleting…';
      try {
        const { data } = await SB.auth.getSession(); const tok = data && data.session && data.session.access_token;
        const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: CFG.supabaseAnonKey } });
        if (!r.ok) throw new Error('failed');
        try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_KEY + ':pending'); } catch (e) {}
        closeSheet(sh); await SB.auth.signOut().catch(() => {}); toast('Your account and data were deleted.', 4000);
      } catch (e) { go.disabled = false; go.textContent = 'Delete my account'; toast('Couldn’t delete it. Check your signal and try again.'); }
    };
  } });
}
// ---------- Add to Home Screen guide (shown once after first sign-in, and in Me) ----------
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const devOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'ios';
const A2HS_SHARE = '<svg class="a2-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const A2HS_ADD = '<svg class="a2-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const A2HS_DOTS = '<svg class="a2-ic" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
function installSteps(os) {
  const st = os === 'ios' ? [
    ['Open this page in <b>Safari</b>.', ''],
    [`Tap the <b>Share</b> button at the bottom of the screen.`, A2HS_SHARE],
    ['Scroll down and tap <b>Add to Home Screen</b>.', A2HS_ADD],
    ['Tap <b>Add</b> in the top right corner.', ''],
  ] : [
    ['Open this page in <b>Chrome</b>.', ''],
    ['Tap the <b>menu</b> in the top right corner.', A2HS_DOTS],
    ['Tap <b>Add to Home screen</b> or <b>Install app</b>.', A2HS_ADD],
    ['Tap <b>Install</b> to confirm.', ''],
  ];
  return `<ol class="a2-steps">${st.map(([t, ic], i) => `<li><span class="a2-n">${i + 1}</span><span class="grow">${t}</span>${ic}</li>`).join('')}</ol>`;
}
function openInstallGuide(first) {
  let os = devOS();
  const sh = openSheet(`<div class="stack"><div class="a2-hero"><div><div class="f22 fw7">${first ? 'Put Job’s Done on your Home Screen' : 'Add to Home Screen'}</div><div class="mt1 cap">It opens full screen like a normal app, and you stay signed in.</div></div></div>
    ${isStandalone() ? '<div class="note">You’re already using Job’s Done from your Home Screen.</div>' : ''}
    <div class="seg"><button data-os="ios">iPhone</button><button data-os="android">Android</button></div>
    <div id="a2-body"></div>
    <button class="btn primary block" id="a2-ok">${first ? 'Got it' : 'Done'}</button></div>`, { label: 'Add to Home Screen', mount: b => {
    const draw = () => {
      b.querySelectorAll('[data-os]').forEach(x => x.classList.toggle('on', x.dataset.os === os));
      b.querySelector('#a2-body').innerHTML = (os === 'android' && installEvt ? '<button class="btn block" id="a2-inst">Install now</button><div class="mt3 mb2 cap tc">or do it yourself:</div>' : '') + installSteps(os)
        + `<div class="mt3 cap">${os === 'ios' ? 'Then open Job’s Done from its new icon. If you added it before, remove the old icon first to get the newest one.' : 'Then open Job’s Done from its new icon on your Home Screen.'} You can find these steps again in Me.</div>`;
      const ib = b.querySelector('#a2-inst'); if (ib) ib.onclick = async () => { installEvt.prompt(); try { const r = await installEvt.userChoice; if (r.outcome === 'accepted') { closeSheet(sh); toast('Installed. Open Job’s Done from your Home Screen.'); } } catch (e) {} installEvt = null; draw(); };
    };
    b.querySelectorAll('[data-os]').forEach(x => x.onclick = () => { os = x.dataset.os; draw(); });
    b.querySelector('#a2-ok').onclick = () => closeSheet(sh);
    draw();
  } });
}
// Once per account on this device, on the first sign-in, unless already opened from the Home Screen.
function maybeInstallGuide() {
  if (S && UI.a2hs && !S.profile.a2hs) { S.profile.a2hs = UI.a2hs; persist('jd/meta'); }
  // Shown after the first saved workout, not during setup (review, 15 Oct).
  if (!HOSTED || UI.a2hs || (S && S.profile.a2hs) || isStandalone() || !S || !Object.keys(S.workouts || {}).length) return false;
  UI.a2hs = today(); lsSave(); if (S) { S.profile.a2hs = UI.a2hs; persist('jd/meta'); }
  setTimeout(() => openInstallGuide(true), 600);
  return true;
}
// A workout left open (forgot to tap Finish) is the top complaint about Strong and Hevy: their timers run for hours.
// After 2 hours with no set logged, ask once; "Finish at last set" saves the real duration.
const STALE_MS = 2 * 3600e3;
function lastSetAt() { return A ? Math.max(A.start, ...A.ex.flatMap(e => e.sets.map(s => (s.done && s.at) || 0))) : 0; }
function maybeStale() {
  if (!A || A.endAt || SHEETS.length) return false;
  const last = lastSetAt(), idle = Date.now() - Math.max(last, A.staleOk || 0);
  if (idle < STALE_MS) return false;
  const any = A.ex.some(e => e.sets.some(s => s.done));
  const day = ymd(new Date(A.start)) === today() ? '' : fmtDate(ymd(new Date(A.start)), { wd: true }) + ', ';
  const sh = openSheet(`<div class="stack"><h2>Still training?</h2>
    <p class="m0 sec">${esc(A.splitName)} has been open since ${day}${hm(A.start)}.${any ? ` Your last set was at ${hm(last)}.` : ' No sets logged yet.'}</p>
    ${any ? `<button class="btn block primary" id="st-fin">Finish at ${hm(last)}</button>` : ''}
    <button class="btn block ${any ? '' : 'primary'}" id="st-keep">Keep going</button>
    <button class="btn block ghost c-neg" id="st-del">Discard workout</button></div>`, { label: 'Still training?' });
  sh.el.querySelector('#st-keep').onclick = () => { A.staleOk = Date.now(); closeSheet(sh); touchA(); openWk(); };
  sh.el.querySelector('#st-del').onclick = () => { closeSheet(sh); ACT.wkDiscard(); };
  const f = sh.el.querySelector('#st-fin');
  if (f) f.onclick = () => { closeSheet(sh); A.endAt = last; if (!A.date && ymd(new Date(A.start)) !== today()) A.date = ymd(new Date(A.start)); A.view = 'summary'; A.open = true; touchA(); };
  return true;
}
function maybePrompt() {
  if (maybeStale()) return;
  if (maybeImportSplit()) return;
  if (maybeInstallGuide()) return;
  if (!S || !S.imported && !S.splits.length) return;
  const t = today();
  if (S.profile.noWeighPrompt || S.weights[t] || UI.lastPrompt === t || (A && A.open)) return;
  UI.lastPrompt = t; lsSave();
  setTimeout(() => openWeighIn(t, true), 500);
}
// ---------- hosted: Supabase accounts ----------
function firstName() {
  const m = USER && USER.user_metadata || {};
  const n = (m.full_name || m.name || '').trim().split(/\s+/)[0];
  if (n) return n;
  if (PUBLIC) { const e = ((USER && USER.email) || '').split('@')[0].split(/[._+-]/)[0].replace(/\d+/g, ''); return e ? e[0].toUpperCase() + e.slice(1).toLowerCase() : 'there'; }
  return 'Job';
}
const TABLE = 'jobdone_docs';
function supaDB() {
  const fail = error => { const e = new Error(error.message || 'Request failed'); e.code = /quota|limit/i.test(error.message || '') ? 'resource_exhausted' : 'unavailable'; return e; };
  return {
    doc: path => ({
      get: async () => { const { data, error } = await SB.from(TABLE).select('body').eq('path', path).maybeSingle(); if (error) throw fail(error); return { exists: !!data, data: () => data ? data.body : undefined }; },
      set: async body => { const { error } = await SB.from(TABLE).upsert({ user_id: USER.id, path, body, updated_at: new Date().toISOString() }); if (error) throw fail(error); },
      delete: async () => { const { error } = await SB.from(TABLE).delete().eq('path', path); if (error) throw fail(error); },
    }),
    collection: c => ({
      get: async () => { const { data, error } = await SB.from(TABLE).select('path,body').like('path', c + '/%'); if (error) throw fail(error); const docs = (data || []).map(r => ({ id: r.path.split('/').pop(), exists: true, data: () => r.body })); return { docs, size: docs.length, empty: !docs.length }; },
    }),
  };
}
function renderSignIn(stage = 'start', email = '', msg = '') {
  ready = false; S = null; A = null;
  applyTheme('mono'); // Job (16 Oct): signed out always looks like Agent, whatever the last account used
  $('#wk').hidden = true;
  const make = stage === 'create';
  $('#app').innerHTML = `<main id="screen" class="pb8"><div class="g3 pt6 stack" style="max-width:420px;margin:0 auto">
    <div class="wordmark">Job’s <span>Done</span></div>
    <div><h1>${make ? 'Create account' : 'Sign in'}</h1><p class="m0 mt2 sec">Your workouts, weights and splits are saved to your account, so they’re on every device you sign in on.</p></div>
    ${make ? `<div class="field"><label for="si-name">Your first name</label><input class="input" id="si-name" autocomplete="given-name" maxlength="40" placeholder="Alex"></div>` : ''}
    <div class="field"><label for="si-email">Email</label><input class="input" id="si-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="${esc(email)}"></div>
    <div class="field"><label for="si-pw">Password</label><div class="pw-wrap"><input class="input" id="si-pw" type="password" autocomplete="${make ? 'new-password' : 'current-password'}" placeholder="${make ? 'At least 8 characters' : ''}"><button type="button" class="pw-eye link" id="si-eye" aria-label="Show password">Show</button></div></div>
    ${make ? `<p class="m0 sec pw-meter" id="si-str" aria-live="polite"></p>` : ''}
    ${make ? `<div class="field"><label for="si-pw2">Confirm password</label><input class="input" id="si-pw2" type="password" autocomplete="new-password" placeholder="Type it again"></div>
    <p class="m0 cap">Want extra protection? You can turn on two-step sign-in once you’re in. It’s optional.</p>` : ''}
    ${make ? `<label class="g2 row cap si-age"><input type="checkbox" id="si-age" class="cbox"><span>I’m 13 or older and I agree to the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="terms.html" target="_blank" rel="noopener">Terms</a>.</span></label>
    <input id="si-web" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">` : ''}
    <button class="btn primary block" id="si-go">${make ? 'Create account' : 'Sign in'}</button>
    <div class="row between"><button class="link" id="si-switch">${make ? 'I have an account' : 'Create account'}</button>${make ? '' : '<button class="link" id="si-forgot">Forgot password?</button>'}</div>
    <div class="c-neg cap" id="si-msg" role="alert" style="min-height:18px">${esc(msg)}</div>
    <div class="tc cap legal"><a href="about.html" target="_blank" rel="noopener">About</a> · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms</a></div>
  </div></main>`;
  const shownAt = Date.now();
  const m = (t, ok) => { const e = $('#si-msg'); e.textContent = t; e.style.color = ok ? 'var(--text2)' : 'var(--neg)'; };
  const emailOk = () => { const em = $('#si-email').value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { m('Enter your email address.'); return null; } return em; };
  const go = async () => {
    const em = emailOk(); if (!em) return;
    const pw = $('#si-pw').value; if (pw.length < (make ? 8 : 6)) { m(make ? 'Use a password of at least 8 characters.' : 'Enter your password.'); return; }
    if (make && $('#si-pw2').value !== pw) { m('The two passwords don’t match.'); return; }
    if (make && !$('#si-age').checked) { m('Please confirm you’re 13 or older and agree to the Privacy Policy and Terms.'); return; }
    const b = $('#si-go'); b.disabled = true; b.textContent = make ? 'Creating…' : 'Signing in…';
    if (make) {
      // Accounts are made by the "signup" function, ready to use with no confirmation email.
      try {
        const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: pw, name: $('#si-name').value.trim(), age: true, website: $('#si-web').value, ms: Date.now() - shownAt }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { b.disabled = false; b.textContent = 'Create account'; return m(j.error || 'Could not create the account. Try again.'); }
      } catch (e) { b.disabled = false; b.textContent = 'Create account'; return m('No connection. Check your signal and try again.'); }
    }
    const { data, error } = await SB.auth.signInWithPassword({ email: em, password: pw });
    if (error) {
      b.disabled = false; b.textContent = make ? 'Create account' : 'Sign in';
      return m(make && /invalid login/i.test(error.message) ? 'That email may already have an account. Sign in instead, or reset your password.' : /invalid login/i.test(error.message) ? 'Wrong email or password.' : /not confirmed/i.test(error.message) ? 'Confirm your email first: open the link Supabase emailed you, then sign in here.' : /rate/i.test(error.message) ? 'Too many tries. Wait a minute, then try again.' : error.message);
    }
    if (make && !data.session) { b.textContent = 'Create account'; b.disabled = false; m('Almost done: open the confirmation email, tap its link, then sign in here.', true); }
  };
  $('#si-go').onclick = go;
  // Password strength hint on Create account: length and variety, plus a few very common passwords.
  if (make) $('#si-pw').oninput = () => { const v = $('#si-pw').value, e = $('#si-str'); if (!v) { e.textContent = ''; return; }
    const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(v)).length, common = /^(password|12345678|123456789|qwerty|iloveyou|11111111|abc12345|password1)$/i.test(v);
    const sc = common || v.length < 8 ? 0 : v.length >= 14 || (v.length >= 10 && kinds >= 3) ? 2 : 1;
    e.textContent = ['Too weak: use 8 or more characters, not a common password.', 'Okay. Longer or mixed characters make it stronger.', 'Strong password.'][sc]; e.dataset.s = sc; };
  $('#si-eye').onclick = () => { const show = $('#si-pw').type === 'password'; for (const id of ['#si-pw', '#si-pw2']) { const e = $(id); if (e) e.type = show ? 'text' : 'password'; } $('#si-eye').textContent = show ? 'Hide' : 'Show'; $('#si-eye').setAttribute('aria-label', show ? 'Hide password' : 'Show password'); };
  for (const id of ['#si-email', '#si-pw', ...(make ? ['#si-pw2'] : [])]) $(id).onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#si-switch').onclick = () => renderSignIn(make ? 'start' : 'create', $('#si-email').value.trim());
  if (!make) $('#si-forgot').onclick = async () => {
    const em = emailOk(); if (!em) return;
    const { error } = await SB.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    m(error && /rate/i.test(error.message) ? 'Too many reset emails. Wait an hour, then try again.' : 'If that email has an account, a reset link is on its way (check spam too). If nothing arrives within 10 minutes, ask whoever shared Job’s Done with you to reset it.', !(error && /rate/i.test(error.message)));
  };
}
function openSetPassword(recovery = false) {
  // Changing a password asks for the current one; a reset link (recovery) has already proved who you are.
  const title = recovery ? 'Set a new password' : 'Change password';
  openSheet(`<div class="stack"><div class="eyebrow">${esc(title)}</div>
    <p class="m0 f15 sec">Use this with your email to sign in on any device.</p>
    ${recovery ? '' : `<div class="field"><label for="pw-cur">Current password</label><input class="input" id="pw-cur" type="password" autocomplete="current-password"></div>`}
    ${!recovery && MFA_ON ? `<div class="field"><label for="pw-code">Code from your authenticator app</label><input class="input num" id="pw-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>` : ''}
    <div class="field"><label for="pw-new">New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
    <div class="field"><label for="pw-new2">New password again</label><input class="input" id="pw-new2" type="password" autocomplete="new-password"></div>
    <button class="btn primary block" id="pw-save">Save password</button><div class="c-neg cap" id="pw-msg"></div>
    <button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, { label: title, mount: el => {
    const msg = t => { el.querySelector('#pw-msg').textContent = t; };
    el.querySelector('#pw-save').onclick = async ev => {
      const btn = ev.currentTarget, pw = el.querySelector('#pw-new').value, pw2 = el.querySelector('#pw-new2').value;
      if (pw.length < 8) return msg('Use at least 8 characters.');
      if (pw !== pw2) return msg('The two new passwords don’t match.');
      btn.disabled = true;
      if (!recovery) {
        const cur = el.querySelector('#pw-cur').value;
        const { error: e1 } = await SB.auth.signInWithPassword({ email: USER.email, password: cur });
        if (e1) { btn.disabled = false; return msg('Your current password isn’t right.'); }
        if (await needMfa()) { const code = (el.querySelector('#pw-code') || {}).value || ''; const e2 = await mfaVerify(code.replace(/\D/g, '')); if (e2) { btn.disabled = false; return msg(e2); } }
      }
      const { error } = await SB.auth.updateUser({ password: pw });
      if (error) { btn.disabled = false; return msg(error.message); }
      try { await SB.auth.signOut({ scope: 'others' }); } catch (e) {}
      closeSheet(); toast('Password saved. Other devices were signed out.');
    };
  } });
}
// ---------- Two-step sign-in (optional; authenticator app codes through Supabase MFA) ----------
// When it's on, the database only opens to sessions that passed the code (a restrictive RLS policy checks 'aal2').
let MFA_ON = false;
async function mfaFactor() { try { const { data } = await SB.auth.mfa.listFactors(); return (data && data.totp || []).find(x => x.status === 'verified') || null; } catch (e) { return null; } }
async function needMfa() { try { const { data } = await SB.auth.mfa.getAuthenticatorAssuranceLevel(); return !!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'; } catch (e) { return false; } }
async function mfaVerify(code, factorId) {
  if (!factorId) { const f = await mfaFactor(); if (!f) return 'Two-step sign-in isn’t set up.'; factorId = f.id; }
  const { error } = await SB.auth.mfa.challengeAndVerify({ factorId, code });
  return error ? (/invalid|expired/i.test(error.message) ? 'That code isn’t right. Check the app and try again.' : 'Couldn’t check the code. Try again.') : null;
}
function renderMfa() {
  ready = false; applyTheme('mono'); $('#wk').hidden = true;
  $('#app').innerHTML = `<main id="screen" class="pb8"><div class="g3 pt6 stack" style="max-width:420px;margin:0 auto">
    <div class="wordmark">Job’s <span>Done</span></div>
    <div><h1>Enter your code</h1><p class="m0 mt2 sec">Open your authenticator app and type the 6-digit code for Job’s Done.</p></div>
    <div class="field"><label for="mfa-code">Code</label><input class="input num" id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></div>
    <button class="btn primary block" id="mfa-go">Continue</button><p class="m0 c-neg cap" id="mfa-msg"></p>
    <button class="btn ghost block" id="mfa-out">Sign out</button></div></main>`;
  let busy = false;
  const go = async () => {
    const c = $('#mfa-code').value.replace(/\D/g, ''); if (c.length !== 6) { $('#mfa-msg').textContent = 'Enter the 6 digits.'; return; }
    if (busy) return; busy = true; $('#mfa-go').disabled = true;
    const err = await mfaVerify(c); busy = false;
    if (err) { $('#mfa-go').disabled = false; $('#mfa-msg').textContent = err; return; }
    MFA_ON = true; openedFor = null; $('#app').innerHTML = ''; openData();
  };
  $('#mfa-go').onclick = go; $('#mfa-code').oninput = e => { if (e.target.value.replace(/\D/g, '').length === 6) go(); };
  $('#mfa-out').onclick = () => SB.auth.signOut();
  setTimeout(() => { const e = $('#mfa-code'); if (e) e.focus(); }, 150);
}
async function openMfa() {
  const on = await mfaFactor();
  if (on) {
    return openSheet(`<div class="stack"><div class="eyebrow">Two-step sign-in</div><p class="m0 f15 sec">On. Signing in on a new device asks for a code from your authenticator app as well as your password.</p>
      <button class="btn block danger-fill" id="mfa-off">Turn off</button><p class="m0 c-neg cap" id="mfa-m"></p><button class="btn ghost block" data-a="closeSheet">Close</button></div>`, { label: 'Two-step sign-in', mount: (el, sh) => {
      el.querySelector('#mfa-off').onclick = async ev => { ev.currentTarget.disabled = true; const { error } = await SB.auth.mfa.unenroll({ factorId: on.id });
        if (error) { ev.currentTarget.disabled = false; el.querySelector('#mfa-m').textContent = 'Couldn’t turn it off. Try again.'; return; }
        MFA_ON = false; closeSheet(sh); toast('Two-step sign-in is off.'); rerender(); };
    } });
  }
  try { const { data } = await SB.auth.mfa.listFactors(); for (const x of (data && data.all || []).filter(x => x.status !== 'verified')) await SB.auth.mfa.unenroll({ factorId: x.id }); } catch (e) {}
  const { data, error } = await SB.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Job’s Done' });
  if (error || !data) { toast('Couldn’t start setup. Check your signal and try again.'); return; }
  openSheet(`<div class="stack"><div class="eyebrow">Two-step sign-in</div>
    <p class="m0 f15 sec">After your password, Job’s Done will also ask for a 6-digit code from an authenticator app, so a stolen password isn’t enough.</p>
    <ol class="m0 f15 sec mfa-steps"><li>Add Job’s Done to an authenticator app: tap the button on this phone, or scan the code from another device.</li><li>Type the 6-digit code it shows.</li></ol>
    <a class="btn block" id="mfa-link" href="${esc(data.totp.uri)}">Add to authenticator on this phone</a>
    <img class="mfa-qr" alt="QR code for your authenticator app">
    <p class="m0 cap sec">Or type this key: <span class="num mfa-key">${esc(data.totp.secret)}</span></p>
    <div class="field"><label for="mfa-new">6-digit code</label><input class="input num" id="mfa-new" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></div>
    <button class="btn primary block" id="mfa-on">Turn on</button><p class="m0 c-neg cap" id="mfa-m"></p>
    <button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, { label: 'Two-step sign-in', mount: (el, sh) => {
    const q = String(data.totp.qr_code || ''), i = q.indexOf(','); // some versions send raw SVG after the comma; encode it so '#' and quotes survive
    el.querySelector('.mfa-qr').src = i > 0 && q.slice(i + 1).trim().startsWith('<') ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(q.slice(i + 1)) : q;
    el.querySelector('#mfa-on').onclick = async ev => {
      const c = el.querySelector('#mfa-new').value.replace(/\D/g, ''); if (c.length !== 6) { el.querySelector('#mfa-m').textContent = 'Enter the 6 digits.'; return; }
      ev.currentTarget.disabled = true; const err = await mfaVerify(c, data.id);
      if (err) { ev.currentTarget.disabled = false; el.querySelector('#mfa-m').textContent = err; return; }
      MFA_ON = true; closeSheet(sh); toast('Two-step sign-in is on.'); rerender();
    };
  } });
}
// ---------- Crash notes: errors on a signed-in phone are saved (message + where), so they can be found and fixed ----------
const ERR_SEEN = new Set();
function reportError(msg, src) {
  try {
    if (!HOSTED || !SB || !USER || mode !== 'cloud' || ERR_SEEN.size >= 5) return;
    msg = String(msg || '').slice(0, 500); if (!msg || /^Script error\.?$/.test(msg) || ERR_SEEN.has(msg)) return; ERR_SEEN.add(msg);
    SB.from('jobdone_errors').insert({ user_id: USER.id, msg, src: String(src || '').slice(0, 300), ver: APP_VER, ua: navigator.userAgent.slice(0, 200) }).then(() => {}, () => {});
  } catch (e) {}
}
addEventListener('error', e => reportError(e.message, (e.filename || '').split('/').pop() + ':' + (e.lineno || 0) + ':' + (e.colno || 0)));
addEventListener('unhandledrejection', e => { const r = e.reason; reportError(r && (r.message || String(r)), r && r.stack ? String(r.stack).split('\n')[1] : ''); });
async function startHosted() {
  SB = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  SB.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_IN' && session && (!USER || USER.id !== session.user.id)) { USER = session.user; openData(); }
    if (ev === 'TOKEN_REFRESHED') { reconnect(); if (pend().size) retrySoon(300); }
    if (ev === 'PASSWORD_RECOVERY') setTimeout(() => openSetPassword(true), 600);
    if (ev === 'SIGNED_OUT') { USER = null; openedFor = null; DB = null; mode = 'local'; renderSignIn(); }
  });
  const { data, error } = await SB.auth.getSession();
  if (data && data.session) { USER = data.session.user; await openData(); }
  else if (!USER) {
    // No signal and the sign-in token is due a refresh: open this phone's saved data instead of the sign-in page.
    const u = savedUser();
    if (u && (error || navigator.onLine === false)) { USER = u; await openData(); } else renderSignIn();
  }
}
function savedUser() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sb-.*-auth-token$/.test(k)) { const v = JSON.parse(localStorage.getItem(k)); if (v && v.user && v.user.id) return v.user; } } } catch (e) {}
  return null;
}
// Opened without signal: once it's back, send what was saved on this phone and load the account.
let reconnecting = false;
function reconnect() { if (reconnecting || mode !== 'local' || !SB || !USER || openedFor !== USER.id) return; reconnecting = true; connect(supaDB()).finally(() => { reconnecting = false; }); }
addEventListener('online', () => setTimeout(reconnect, 1500));
let openedFor = null;
async function openData() {
  if (openedFor === USER.id) return;
  if (navigator.onLine !== false && await needMfa()) { renderMfa(); return; }
  openedFor = USER.id; mfaFactor().then(f => { if (!!f !== MFA_ON) { MFA_ON = !!f; if (ready) rerender(); } });
  LS_KEY = 'jobdone.v1:' + USER.id;
  const cached = lsLoad();
  ready = false; S = null; A = null; invalidate();
  if (cached && cached.S) { S = cached.S; A = cached.A || null; renameLifts(S, A); UI = cached.UI || UI; ready = true; $('#app').innerHTML = ''; render(); maybePrompt(); }
  else $('#app').innerHTML = skeleton();
  await connect(supaDB());
}
async function connect(db) {
  if (!db) { mode = 'local'; if (!ready) { ready = true; S = null; renderWelcome(); } else rerender(); return; }
  DB = db; mode = 'cloud';
  if (S && pend().size) {
    try { for (const p of [...pend()]) { const body = docBody(p); if (body) await db.doc(p).set(body); else await db.doc(p).delete(); pend().delete(p); } pendSave(); }
    catch (e) { pendSave(); syncState = 'offline'; ready = true; rerender(); retrySoon(); toast('No signal. Using what’s saved on this phone; it will sync when you’re back online.', 3500); return; }
  }
  try {
    const had = await loadCloud();
    if (had) { lsSave(); const first = !ready; ready = true; if (first) $('#app').innerHTML = ''; rerender(); if (first) maybePrompt(); }
    else if (S && (S.imported || S.splits.length)) persist(...allPaths());
    else { ready = true; S = null; renderWelcome(); }
  } catch (e) {
    mode = 'local';
    if (!ready) { ready = true; S = null; renderWelcome(); }
    toast('Couldn’t reach your account. Working offline on this device for now.', 4000);
  }
}
function skeleton() {
  const b = (w, h, m = 0) => `<i style="width:${w};height:${h}px;margin-top:${m}px"></i>`;
  return `<div class="skel" aria-busy="true" aria-label="Loading your log">${b('38%', 12, 8)}${b('80%', 44)}${b('62%', 96, 18)}${b('40%', 14)}${b('100%', 48, 4)}<hr>${b('30%', 12)}${b('48%', 80)}${b('100%', 70)}<hr>${b('100%', 40)}</div>`;
}
// Icon-only buttons get a tooltip from their label (shows on hover and long-press on desktop).
new MutationObserver(() => { for (const el of document.querySelectorAll('button[aria-label]:not([title])')) el.title = el.getAttribute('aria-label'); })
  .observe(document.documentElement, { childList: true, subtree: true });
// ---------- Background: a still X-ray skeleton over a soft volt and blue glow ----------
// The skeleton art is drawn by tools/skeleton.py and inlined by build.py.
function livingBackground() {
  if (document.getElementById('bg')) return;
  document.body.insertAdjacentHTML('afterbegin', `<div id="bg" aria-hidden="true"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="noise"></div><i class="sky-stars"></i><i class="sky-sun"></i><i class="l1"></i><i class="land"></i><i class="tint"></i><i class="l2"></i></div>`);
}
async function boot() {
  applyTheme();
  livingBackground();
  if (HOSTED) {
    if ('serviceWorker' in navigator && location.protocol === 'https:') swRegister();
    $('#app').innerHTML = `<div class="splash"><div class="wordmark">Job’s <span>Done</span></div></div>`;
    try { await startHosted(); } catch (e) { renderSignIn('start', '', 'Couldn’t reach the sign-in service. Check your connection and reload.'); }
    return;
  }
  if (CFG && !HOSTED && location.protocol !== 'file:') {
    if ('serviceWorker' in navigator && location.protocol === 'https:') swRegister();
  }
  const cached = lsLoad();
  if (cached && cached.S) { S = cached.S; A = cached.A || null; renameLifts(S, A); UI = cached.UI || UI; ready = true; render(); maybePrompt(); }
  else $('#app').innerHTML = skeleton();
  let db = null;
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
  try { DL = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { DL = null; }
  await connect(db);
}
boot();

// Date fields: iPhone shows native date inputs in the phone's region format (often 10/15/2026).
// Show our own day-first label on top and keep the native picker underneath for tapping.
function dayFirst(root = document) {
  root.querySelectorAll('input[type=date].input:not([data-df])').forEach(inp => {
    inp.dataset.df = '1';
    const w = document.createElement('span'); w.className = 'dwrap';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const t = document.createElement('span'); t.className = 'dtext input'; t.setAttribute('aria-hidden', 'true'); w.appendChild(t);
    const set = () => { t.textContent = inp.value ? fmtDate(inp.value, { wd: true, y: inp.value.slice(0, 4) !== String(new Date().getFullYear()) }) : 'Pick a date'; };
    inp.addEventListener('input', set); inp.addEventListener('change', set); set();
  });
}
new MutationObserver(() => dayFirst()).observe(document.documentElement, { childList: true, subtree: true });
