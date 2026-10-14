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
const fmtDur = ms => { const m = Math.max(0, Math.floor(ms / 6e4)); return m >= 60 ? Math.floor(m / 60) + 'h ' + pad2(m % 60) + 'm' : m + ' min'; };
const clock = s => Math.floor(s / 60) + ':' + pad2(Math.floor(s % 60));
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
Tricep Vulken|Triceps|machine;Single-Arm Tricep|Triceps|cable;Tricep Bar|Triceps|cable;Tricep Pushdown|Triceps|cable;Rope Pushdown|Triceps|cable;Overhead Tricep Extension|Triceps|cable;Skull Crusher|Triceps|barbell;Close-Grip Bench Press|Triceps|barbell;Dumbbell Kickback|Triceps|dumbbell;Tricep Dip Machine|Triceps|machine;
Cable Crunch|Abs|cable;Oblique Crunch|Abs|cable;Hanging Leg Raise|Abs|bodyweight;Ab Wheel|Abs|bodyweight;Crunch Machine|Abs|machine;Plank|Abs|bodyweight;Russian Twist|Abs|bodyweight;Pallof Press|Abs|cable;Woodchopper|Abs|cable;
Leg Press|Quads|machine;Leg Extension|Quads|machine;Back Squat|Quads|barbell;Front Squat|Quads|barbell;Hack Squat|Quads|machine;Smith Squat|Quads|smith;Goblet Squat|Quads|dumbbell;Bulgarian Split Squat|Quads|dumbbell;Walking Lunge|Quads|dumbbell;Pendulum Squat|Quads|machine;Step-Up|Quads|dumbbell;Sissy Squat|Quads|bodyweight;
Stiff-Leg Deadlift|Hamstrings|barbell;Romanian Deadlift|Hamstrings|barbell;Dumbbell RDL|Hamstrings|dumbbell;Leg Curl|Hamstrings|machine;Seated Leg Curl|Hamstrings|machine;Lying Leg Curl|Hamstrings|machine;Nordic Curl|Hamstrings|bodyweight;Good Morning|Hamstrings|barbell;
Hip Thrust|Glutes|barbell;Glute Bridge|Glutes|barbell;Cable Kickback|Glutes|cable;Abductor|Glutes|machine;Glute Drive|Glutes|machine;Adductor|Adductors|machine;Copenhagen Plank|Adductors|bodyweight;
Calf Raise|Calves|machine;Seated Calf Raise|Calves|machine;Standing Calf Raise|Calves|machine;Leg Press Calf Raise|Calves|machine;Donkey Calf Raise|Calves|machine`;
const LIB = LIB_RAW.split(';').map(s => s.trim()).filter(Boolean).map(s => { const [name, muscle, equip] = s.split('|'); return { name, muscle, equip }; });
const EQUIP = ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'bodyweight', 'band', 'kettlebell', 'other'];
const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves', 'Other'];
const baseName = n => n.replace(/\s*\((L|R)\)$/, '');
const sideOf = n => (n.match(/\((L|R)\)$/) || [])[1] || null;
function exInfo(name) {
  const b = baseName(name);
  return (S.customEx || []).find(e => e.name === b) || LIB.find(e => e.name === b) || { name: b, muscle: 'Other', equip: 'other' };
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
const HOSTED = !!(CFG && CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
let SB = null, USER = null;
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
let welcomeOv = {};   // assumption overrides on the welcome screen

function freshState() {
  return {
    v: 1,
    profile: Object.assign({ name: firstName(), heightCm: null, unit: 'kg', stepGoal: 10000, weeklyTarget: 4, defaultRest: 300, sound: true }, SEED.profile),
    splits: [], rotation: [], customEx: [], weights: {}, steps: {}, workouts: {}, imported: false, created: Date.now(),
  };
}
const invalidate = () => { IX = null; };

// ---------- storage ----------
function lsLoad() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function lsSave() { try { localStorage.setItem(LS_KEY, JSON.stringify({ S, A, UI })); } catch (e) {} }
const dirty = new Set(), inflight = new Set();
let flushT = null;
function persist(...paths) {
  lsSave();
  if (!DB || !S) return;
  paths.forEach(p => dirty.add(p));
  clearTimeout(flushT); flushT = setTimeout(flush, 450);
}
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
  if (p === 'jd/meta') return { v: S.v, profile: S.profile, splits: S.splits, rotation: S.rotation, customEx: S.customEx, imported: S.imported, created: S.created, updated: Date.now() };
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
    if (!dirty.size) setSync('ok');
  } catch (e) {
    const code = e && e.code;
    if ((code === 'unavailable' || code === 'resource_exhausted') && attempt < 5) { await sleep(700 * 2 ** attempt + Math.random() * 400); return writeDoc(p, attempt + 1); }
    setSync('err', code);
  }
}
function setSync(s, code) {
  syncState = s;
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
  const ns = Object.assign(freshState(), { v: md.v, profile: Object.assign(freshState().profile, md.profile), splits: md.splits || [], rotation: md.rotation || [], customEx: md.customEx || [], imported: md.imported, created: md.created });
  ns.weights = w.exists ? clone(w.data().e || {}) : {};
  ns.steps = s.exists ? clone(s.data().e || {}) : {};
  ns.workouts = {};
  for (const d of months.docs) Object.assign(ns.workouts, clone(d.data().w || {}));
  const ca = a.exists ? clone(a.data().a || null) : null;
  // keep whichever in-progress workout was touched last
  if (!A || (ca && (ca.touched || 0) > (A.touched || 0))) A = ca;
  else if (A && !ca && a.exists && (a.data().t || 0) > (A.touched || 0)) A = null;
  S = ns; invalidate();
  return true;
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
  if (s.w * s.r > b.vol + 1e-9) t.push('Volume');
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
  for (const w of ws) {
    if (w.skipped) continue;
    for (const e of w.ex) {
      const b = best[e.name] || (best[e.name] = emptyBest());
      (hist[e.name] || (hist[e.name] = [])).push({ date: w.date, wid: w.id, sets: e.sets, note: e.note, top: topSet(e.sets), vol: exVol(e.sets), e1: maxE1(e.sets) });
      const types = new Set(); let star = null;
      for (const s of e.sets) { const t = prTypes(s, b); if (t.length) { t.forEach(x => types.add(x)); if (!star || e1(s) > e1(star)) star = s; } }
      if (types.size) prs.push({ date: w.date, wid: w.id, ex: e.name, set: star, types: [...types] });
      e.sets.forEach(s => applyBest(s, b));
      b.n++;
    }
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
  const ws = ix().ws;
  for (let i = ws.length - 1; i >= 0; i--) {
    const w = ws[i]; if (w.skipped) continue;
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
  if (Math.abs(d) < 1e-6) return `<span class="neu">= ${fmt(0)}${unit}</span>`;
  return `<span class="${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${unit}</span>`;
}
const fmtW = v => dw(v);
// body weight: always one decimal, real minus sign
function bw(kg, signed) { if (kg == null) return '—'; const v = U() === 'lb' ? kg * LB : kg; const t = Math.abs(v).toFixed(1); return (v < -0.05 ? '−' : signed && v > 0.05 ? '+' : '') + t; }
const e1f = kg => kg ? trim(Math.round((U() === 'lb' ? kg * LB : kg) * 10) / 10) : '—';
function wdelta(a, b) { if (a == null || b == null) return ''; const d = a - b; if (Math.abs(d) < 0.05) return '<span class="neu">= 0.0</span>'; return `<span class="sec">${d > 0 ? '▲' : '▼'} ${bw(Math.abs(d))}</span>`; }

// ---------- icons ----------
const I = {
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
function toast(html, ms = 2600) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = html;
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), ms);
}
const SHEETS = [];
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
function confirmSheet({ title, body = '', ok = 'Confirm', danger = false, onOk }) {
  const sh = openSheet(`<div class="stack"><h2>${esc(title)}</h2>${body ? `<p class="sec" style="margin:0">${body}</p>` : ''}
    <button class="btn block ${danger ? 'danger' : 'primary'}" id="cf-ok">${esc(ok)}</button><button class="btn block ghost" data-a="closeSheet">Cancel</button></div>`, { label: title });
  sh.el.querySelector('#cf-ok').onclick = () => { closeSheet(sh); onOk(); };
}

// ---------- render shell ----------
function render() {
  if (!ready) return;
  // Oct 2026: Job made Cliffs the default look; switch everyone over once, then their own pick sticks.
  // Oct 2026: Job removed the Miles theme; anyone on it moves to Cliffs.
  if (S && S.profile && S.profile.theme === 'miles') { S.profile.theme = 'cliffs'; persist('jd/meta'); }
  if (S && S.profile && !S.profile.cliffs1) { S.profile.theme = 'cliffs'; S.profile.cliffs1 = true; persist('jd/meta'); }
  if ((document.documentElement.dataset.theme || 'climb') !== theme()) applyTheme();
  // Oct 2026: rest timer default went from 2 to 5 minutes (Job's ask); move the old default over once.
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
    `<button class="tab-start ${A ? 'live' : ''}" data-a="start" aria-label="${A ? 'Resume workout' : 'Start workout'}">${A ? I.play : I.plus}</button>` +
    tab('progress', 'Progress', I.progress) + tab('me', 'Me', I.me);
  renderWorkout();
}
// Screen entrance: panels rise in, charts draw, headline numbers count up.
// Looks Job can pick under Me. The choice is saved with the profile (so it follows the account)
// and in localStorage (so the right colours show before the data loads).
const THEMES = [
  { k: 'cliffs', name: 'Cliffs', bar: '#6FB3E6', sw: 'linear-gradient(90deg, #6FB3E6 0% 20%, #F6C9A8 20% 40%, #8A5A40 40% 60%, #1F7A99 60% 80%, #FFF9F2 80% 100%)' },
  { k: 'climb', name: 'Climbing', bar: '#EFEBE5', sw: 'linear-gradient(90deg, #EFEBE5 0% 20%, #6C3FD6 20% 40%, #F4B728 40% 60%, #2E8B4E 60% 80%, #E0412F 80% 100%)' },
  { k: 'mono', name: 'Venom', bar: '#050507', sw: 'linear-gradient(90deg, #050507 0% 25%, #1C1D26 25% 50%, #6C7AA8 50% 75%, #F4F5FA 75% 100%)' },
  { k: 'spidey', name: 'Spider', bar: '#0D1A45', sw: 'linear-gradient(90deg, #0D1A45 0% 25%, #15275F 25% 50%, #E2231A 50% 75%, #FFFFFF 75% 100%)' },
];
const theme = () => (S && S.profile && S.profile.theme) || (() => { try { return localStorage.getItem('jobdone-theme'); } catch (e) { return null; } })() || 'cliffs';
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
function applySky() {
  const R = document.documentElement; if (R.dataset.theme !== 'cliffs') { delete R.dataset.tod; return; }
  const n = new Date(), h = n.getHours() + n.getMinutes() / 60, k = skyNow(h), st = R.style;
  st.setProperty('--sky1', k.s1); st.setProperty('--sky2', k.s2); st.setProperty('--sky3', k.s3); st.setProperty('--tint', k.tint); st.setProperty('--stars', k.stars.toFixed(2));
  const day = h >= 6 && h < 19, p = day ? (h - 6) / 13 : ((h + 24 - 19) % 24) / 11;
  st.setProperty('--sunx', (10 + p * 80).toFixed(1) + '%'); st.setProperty('--suny', (58 - Math.sin(Math.PI * p) * 46).toFixed(1) + '%');
  const sun = document.querySelector('#bg .sky-sun'); if (sun) sun.classList.toggle('moon', !day);
  R.dataset.tod = h >= 19.5 || h < 5.5 ? 'night' : 'day';
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
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cols = ({ mono: ['#F4F5FA', '#6C7AA8', '#1C1D26'], spidey: ['#E2231A', '#FFFFFF', '#5B8CFF'], miles: ['#E3262E', '#FFE94D', '#FFFFFF', '#7FD8FF'], cliffs: ['#1F7A99', '#F2A93B', '#D2553A', '#3F8F5A', '#FFFFFF'] })[document.documentElement.dataset.theme] || ['#6C3FD6', '#F4B728', '#2E8B4E', '#E0412F', '#4A78E0'], box = document.createElement('div'); box.className = 'confetti';
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
function viewToday() {
  const t = today(), lw = latestWeight(), a7 = avg7();
  const p = S.profile, fw = firstWeight(), since = lw && fw ? lw.w - fw.w : null;
  const loggedToday = S.weights[t];
  const recent = weightList().filter(e => daysBetween(e.d, t) <= 120);
  const wchart = recent.length > 1 ? lineChart({ series: [{ pts: recent.map(e => ({ x: ts(e.d), y: e.w, hollow: e.src === 'estimated' })), color: 'var(--accent)', dots: true, width: 2.4 }], h: 96, yfmt: v => bw(v), area: true }) : '';
  const nx = nextSplit();
  const lastNx = nx && lastOfSplit(nx);
  const steps = S.steps[t] || 0, goal = p.stepGoal || 10000, frac = Math.min(1, steps / goal);
  const ws = mondayOf(t); let done = 0;
  const strip = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = addDays(ws, i); const wk = Object.values(S.workouts).filter(w => w.date === d);
    const trained = wk.some(w => !w.skipped), skipped = wk.some(w => w.skipped);
    if (trained) done++;
    const cls = trained ? 'done' : skipped ? 'miss' : d > t ? 'future' : d === t ? 'today' : '';
    const sp = wk.find(w => !w.skipped);
    return `<button class="d" data-a="day" data-k="${d}" aria-label="${esc(fmtDate(d, { wd: true }))}"><span>${WD[parseYmd(d).getDay()].slice(0, 1)}</span><span class="dot ${cls}" ${sp && wSplit(sp) ? `style="background:${wSplit(sp).color};border-color:${wSplit(sp).color}"` : ''} title="${esc(fmtDate(d, { wd: true }))}${sp ? ': ' + esc(sp.splitName) : skipped ? ': skipped' : ''}">${sp ? esc(sp.splitName.slice(0, 1)) : skipped ? '×' : ''}</span></button>`;
  }).join('');
  const prs = ix().prs.slice(-3).reverse();
  return `<div class="stack">
  <div class="top"><div><div class="eyebrow">${esc(fmtDate(t, { wd: true }).replace(/^(\w+) /, (m, d) => ({ Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }[d] + ', ')))}</div><h1>${greeting()}, ${esc(p.name)}</h1></div></div>
  ${A ? `<button class="card row between" data-a="resume" style="text-align:left;border-color:var(--text2)"><div><div class="eyebrow">In progress</div><h3 style="margin-top:4px">${esc(A.splitName)} · <span class="num" data-elapsed>${fmtDur(Date.now() - A.start)}</span></h3></div><span class="btn sm primary">Resume</span></button>` : ''}
  <div class="card nextup" style="--split:${nx ? nx.color : 'var(--accent)'};--ink:${nx ? inkOn(nx.color) : '#fff'}">
    <div class="card-h"><span class="eyebrow">Next up</span><button class="cap" data-a="tab" data-k="splits" style="min-height:32px">Rotation: ${esc(S.rotation.map(splitById).filter(Boolean).map(s => s.name).join(' → ') || 'not set')}</button></div>
    ${nx ? `<div class="hero"><i class="sdot" style="background:${nx.color}"></i>${esc(nx.name)}</div><div class="cap" style="margin-top:10px">${nx.ex.length} exercises · ${lastNx ? 'last done ' + relDay(lastNx.date) : 'not done yet'}</div>
      <button class="btn primary block" style="margin-top:18px" data-a="startSplit" data-id="${nx.id}" ${A ? 'disabled' : ''}>Start ${esc(nx.name)}</button>
      <div class="list nextlist">${nx.ex.slice(0, 4).map(e => { const l = lastSession(e.name); return `<div class="row between"><span class="sec">${esc(e.name)}</span><span class="num muted">${l ? l.sets.map(setStr).join(', ') : '—'}</span></div>`; }).join('')}${nx.ex.length > 4 ? `<div class="cap" style="padding-top:10px">+ ${nx.ex.length - 4} more</div>` : ''}</div>`
      : `<div class="empty">Create a split to get started.</div>`}
  </div>
  <button class="card" data-a="weigh" style="text-align:left;width:100%">
    <div class="card-h"><span class="eyebrow">Body weight</span><span class="cap">${loggedToday ? 'Logged today' : lw ? 'Last ' + relDay(lw.d) + ' · tap to weigh in' : 'Tap to weigh in'}</span></div>
    <div class="row between" style="align-items:flex-end"><div class="big">${lw ? bw(lw.w) : '—'}<span class="unit">${U()}</span></div>
    <div class="cap" style="text-align:right">${loggedToday && weightOn(addDays(t, -1)) ? 'vs last ' + wdelta(lw.w, weightOn(addDays(t, -1)).w) : ''}</div></div>
    <div class="kpis" style="margin-top:14px"><div class="kpi"><b>${a7 ? bw(a7) : '—'}</b><span>7-day avg</span></div><div class="kpi"><b>${since == null ? '—' : bw(since, true)}</b><span>since ${fw ? esc(fmtDate(fw.d)) : 'start'}</span></div><div class="kpi"><b>${(() => { const r = ratePerMonth(); return r == null ? '—' : bw(r, true); })()}</b><span>per month</span></div></div>
    <div style="margin-top:12px">${wchart}</div>
  </button>
  <div class="grid2">
    <button class="card" data-a="steps" style="text-align:left">
      <div class="eyebrow">Steps</div>
      <div class="row" style="margin-top:10px"><div class="ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="36" fill="none" stroke="var(--raised)" stroke-width="8"/>${frac > 0 ? `<circle cx="42" cy="42" r="36" fill="none" stroke="${frac >= 1 ? 'var(--pos)' : 'var(--text)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 36 * frac).toFixed(1)} 999"/>` : ''}</svg><div class="c">${Math.round(frac * 100)}%</div></div></div>
      <div class="mid" style="margin-top:10px;font-size:24px">${n0(steps)}</div><div class="cap">of ${n0(goal)} · tap to add</div>
    </button>
    <div class="card">
      <div class="eyebrow">This week</div>
      <div class="mid" style="margin-top:10px">${done}<span class="unit">/ ${p.weeklyTarget}</span></div>
      <div class="cap">workouts</div>
      <div class="cap" style="margin-top:12px">${streakText()}</div>
    </div>
  </div>
  <div class="card"><div class="card-h"><span class="eyebrow">This week</span><button class="cap" data-a="day" data-k="" style="min-height:32px">Log or edit another day</button></div><div class="week">${strip}</div></div>
  ${prs.length ? `<div class="card"><div class="card-h"><span class="eyebrow">Latest PRs</span><button class="cap" data-a="prog" data-k="strength" style="min-height:32px">All PRs</button></div>${prs.map(prRow).join('')}</div>` : ''}
</div>`;
}
function ratePerMonth() {
  const l = weightList(); if (l.length < 2) return null;
  const a = l[0], b = l[l.length - 1]; const d = daysBetween(a.d, b.d); if (d < 14) return null;
  return (b.w - a.w) / d * 30.44;
}
function streakText() {
  const ws = ix().ws.filter(w => !w.skipped); if (!ws.length) return 'No workouts yet';
  const weeks = new Set(ws.map(w => mondayOf(w.date)));
  let k = 0, m = mondayOf(today());
  if (!weeks.has(m)) m = addDays(m, -7);
  while (weeks.has(m)) { k++; m = addDays(m, -7); }
  return k ? `${k}-week streak` : 'Train this week to start a streak';
}
function prRow(p) {
  return `<button class="li" data-a="openEx" data-name="${esc(p.ex)}"><div class="grow"><div class="t">${esc(p.ex)}</div><div class="s">${esc(fmtDate(p.date, { wd: true }))} · ${p.types.map(t => esc(t)).join(', ')}</div></div><span class="num" style="font-weight:650">${setStr(p.set)}</span><span class="pill pr">PR</span></button>`;
}

// ---------- Splits ----------
// The muscle groups a split hits most, as small labels.
function splitMuscles(sp, n = 3) {
  const c = {}; for (const e of sp.ex) { const m = exInfo(e.name).muscle; if (m !== 'Other') c[m] = (c[m] || 0) + (e.sets || 1); }
  const top = Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, n);
  return top.length ? `<div class="mus">${top.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : '';
}
function viewSplits() {
  const act = S.splits.filter(s => !s.archived), arc = S.splits.filter(s => s.archived);
  const nx = nextSplit();
  const card = sp => {
    const l = lastOfSplit(sp);
    const vols = ix().ws.filter(w => !w.skipped && (w.splitId === sp.id || (!w.splitId && w.splitName === sp.name))).slice(-8).map(wVol);
    return `<button class="card split" data-a="openSplit" data-id="${sp.id}" style="--split:${sp.color}"><span class="tag" style="background:${sp.color}"></span><div class="grow"><div class="row" style="gap:8px"><h3>${esc(sp.name)}</h3>${nx && nx.id === sp.id ? '<span class="pill">Next up</span>' : ''}</div><div class="cap" style="margin-top:3px">${sp.ex.length} exercises · ${l ? relDay(l.date) : 'never done'}</div>${splitMuscles(sp)}</div>${sparkline(vols, sp.color)}${I.right}</button>`;
  };
  return `<div class="stack">
  <div class="top"><h1>Splits</h1><button class="btn sm" data-a="newSplit">New split</button></div>
  <button class="card tight row between" data-a="rotation" style="text-align:left"><div><div class="eyebrow">Rotation</div><div style="margin-top:4px;font-weight:600">${esc(S.rotation.map(splitById).filter(Boolean).map(s => s.name).join(' → ') || 'Not set')}</div></div><span class="cap">Edit</span></button>
  ${act.map(card).join('')}
  ${arc.length ? `<details><summary class="link">Archived (${arc.length})</summary><div class="stack" style="margin-top:8px">${arc.map(card).join('')}</div></details>` : ''}
</div>`;
}
const targetStr = e => `${e.sets} × ${e.repMin}${e.repMax !== e.repMin ? '–' + e.repMax : ''} · ${clock(e.rest)} rest`;
function viewSplit({ id }) {
  const sp = splitById(id); if (!sp) return backBtn();
  const l = lastOfSplit(sp);
  return `<div class="stack">${backBtn('Splits')}
  <div class="top" style="padding-top:0"><div class="grow"><div class="eyebrow" style="color:${sp.color}">Split</div><h1>${esc(sp.name)}</h1><div class="cap" style="margin-top:6px">${sp.ex.length} exercises · ${l ? 'last done ' + fmtDate(l.date, { wd: true }) : 'never done'}</div></div></div>
  <div class="row"><button class="btn primary grow" data-a="startSplit" data-id="${sp.id}" ${A ? 'disabled' : ''}>${A ? 'Workout in progress' : 'Start ' + esc(sp.name)}</button><button class="btn" data-a="editSplit" data-id="${sp.id}">Edit</button></div>
  <div class="card"><div class="list">${sp.ex.map(e => { const ls = lastSession(e.name); return `<button class="li" data-a="openEx" data-name="${esc(e.name)}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${targetStr(e)}</div><div class="s num" style="margin-top:2px">Last time: ${ls ? ls.sets.map(setStr).join(', ') + ' · ' + relDay(ls.date) : '—'}</div>${e.note ? `<div class="s" style="font-style:italic">${esc(e.note)}</div>` : ''}</div>${I.right}</button>`; }).join('') || '<div class="empty">No exercises yet. Tap Edit to add some.</div>'}</div></div>
</div>`;
}
function viewSplitEdit({ id }) {
  const sp = splitById(id); if (!sp) return backBtn();
  return `<div class="stack"><div class="row between"><h2 style="margin:0">Edit split</h2><button class="btn sm primary" data-a="back">Done</button></div>
  <div class="field"><label for="sp-name">Name</label><input class="input" id="sp-name" data-in="spName" data-id="${sp.id}" value="${esc(sp.name)}" maxlength="30"></div>
  <div class="field"><span class="lbl">Colour</span><div class="chips">${PALETTE.map(c => `<button class="chip ${sp.color === c ? 'on' : ''}" data-a="spColor" data-id="${sp.id}" data-c="${c}" aria-label="Colour ${c}"><span style="width:14px;height:14px;border-radius:50%;background:${c};display:inline-block"></span></button>`).join('')}</div></div>
  <h2>Exercises</h2>
  ${sp.ex.map((e, i) => `<div class="card tight stack" style="gap:8px">
    <div class="row"><div class="grow ex-name" style="font-size:16px">${esc(e.name)}</div>
      <button class="icon-btn" data-a="spMove" data-id="${sp.id}" data-i="${i}" data-d="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${I.up1}</button>
      <button class="icon-btn" data-a="spMove" data-id="${sp.id}" data-i="${i}" data-d="1" aria-label="Move down" ${i === sp.ex.length - 1 ? 'disabled' : ''}>${I.dn1}</button>
      <button class="icon-btn" data-a="spRemove" data-id="${sp.id}" data-i="${i}" aria-label="Remove ${esc(e.name)}">${I.x}</button></div>
    <div class="row wrap" style="gap:8px">
      <label class="row cap" style="gap:6px">Sets <input class="input sm num" style="width:52px" inputmode="numeric" id="se-${i}-sets" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="sets" value="${e.sets}"></label>
      <label class="row cap" style="gap:6px">Reps <input class="input sm num" style="width:48px" inputmode="numeric" id="se-${i}-min" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="repMin" value="${e.repMin}">–<input class="input sm num" style="width:48px" inputmode="numeric" id="se-${i}-max" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="repMax" value="${e.repMax}"></label>
      <label class="row cap" style="gap:6px">Rest <input class="input sm num" style="width:60px" inputmode="numeric" id="se-${i}-rest" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="rest" value="${e.rest}">s</label>
    </div>
    <input class="input sm" placeholder="Note: seat height, grip, cue" id="se-${i}-note" data-in="spEx" data-id="${sp.id}" data-i="${i}" data-f="note" value="${esc(e.note || '')}">
  </div>`).join('')}
  <button class="btn block" data-a="spAdd" data-id="${sp.id}">Add exercise</button>
  <div class="row"><button class="btn grow" data-a="spDup" data-id="${sp.id}">Duplicate</button><button class="btn grow" data-a="spArchive" data-id="${sp.id}">${sp.archived ? 'Unarchive' : 'Archive'}</button></div>
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
    <div class="chips" style="margin-bottom:10px">${Object.keys(ranges).map(k => `<button class="chip ${NAV.range === k ? 'on' : ''}" data-a="range" data-k="${k}">${k}</button>`).join('')}</div>
    ${lineChart({ series: [{ pts: list.map(e => ({ x: ts(e.d), y: e.w, hollow: e.src === 'estimated' })), color: 'var(--text2)', dots: true, dotsOnly: list.length > 1, noArea: true, noEnd: true }, { pts: trend, color: 'var(--accent)', width: 2.6 }], h: 190, yfmt: v => bw(v) })}
    <div class="legend" style="margin-top:8px"><span><i style="background:var(--accent)"></i>Trend</span><span><i style="background:var(--text2);width:6px;height:6px;border-radius:50%"></i>Logged</span><span><i style="background:transparent;border:1.5px solid var(--text2);width:7px;height:7px;border-radius:50%"></i>Estimated</span></div>
  </div>
  <div class="card"><div class="kpis"><div class="kpi"><b>${fw ? bw(fw.w) : '—'}</b><span>${fw ? esc(fmtDate(fw.d)) : 'start'}</span></div><div class="kpi"><b>${lw ? bw(lw.w) : '—'}</b><span>now</span></div><div class="kpi"><b>${lw && fw ? bw(lw.w - fw.w, true) : '—'}</b><span>total change</span></div></div>
    <div class="cap" style="margin-top:12px">${p.heightCm && fw ? `BMI ${bmi(fw.w)} → ${lw ? bmi(lw.w) : '—'} · ` : ''}${(() => { const r = ratePerMonth(); return r == null ? '' : 'about ' + bw(Math.abs(r)) + ' ' + U() + (r < 0 ? ' down' : ' up') + ' per month'; })()}</div>
    <button class="link" data-a="weights">All weight entries</button></div>
  <div class="card"><div class="card-h"><span class="eyebrow">Steps · last 30 days</span><button class="cap" data-a="steps" style="min-height:32px">Add</button></div>
    ${st.any ? barChart({ bars: st.bars, line: st.avg, h: 140 }) + '<div class="legend" style="margin-top:8px"><span><i style="background:var(--text2)"></i>Daily</span><span><i style="background:var(--accent)"></i>7-day average</span></div>' : '<div class="empty">No steps logged yet. Tap Add, or import from an Apple Shortcut (see Me → Apple Health).</div>'}
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
  return `<div class="stack">${backBtn('Progress')}<div class="top" style="padding-top:0"><h1>Weight log</h1><button class="btn sm" data-a="weighDate">Add entry</button></div>
  <p class="cap" style="margin:0">Hollow points on the chart are estimates from your starting numbers. Tap any entry to correct it.</p>
  <div class="card"><div class="list">${l.map(e => `<button class="li" data-a="weighDate" data-d="${e.d}"><div class="grow"><div class="t">${esc(fmtDate(e.d, { wd: true, y: true }))}</div><div class="s">${e.src === 'estimated' ? 'Estimated' : e.src === 'import' ? 'Imported' : 'Logged'}</div></div><span class="num" style="font-weight:650">${bw(e.w)} ${U()}</span>${I.right}</button>`).join('')}</div></div></div>`;
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
function progStrength() {
  const prs = ix().prs.slice(-10).reverse();
  const groups = exerciseGroups();
  return `<div class="card"><div class="card-h"><span class="eyebrow">PR wall</span><span class="cap">${ix().prs.length} PR sessions since May</span></div>${prs.map(prRow).join('') || '<div class="empty">PRs appear here as you beat your bests.</div>'}</div>
  <div class="card"><div class="card-h"><span class="eyebrow">Exercises</span><span class="cap">best e1RM</span></div><div class="list">${groups.map(g => {
    const n = g.names.find(x => sideOf(x) === 'R') || g.names[0];
    const h = ix().hist[n]; const cur = ix().best[n] ? ix().best[n].e1 : 0;
    const old = h.filter(s => daysBetween(s.date, today()) >= 28 && s.e1 > 0).map(s => s.e1);
    const prev = old.length ? Math.max(...old) : null;
    return `<button class="li" data-a="openEx" data-name="${esc(g.names[0])}"><div class="grow"><div class="t">${esc(g.b)}${g.names.length > 1 ? ' <span class="cap">L / R</span>' : ''}</div><div class="s">${g.n} sessions · last ${relDay(g.last)}</div></div><div style="text-align:right"><div class="num" style="font-weight:650">${e1f(cur)}</div><div class="cap">${prev && cur ? delta(cur, prev, v => e1f(v)) + ' vs 4 wk' : ''}</div></div>${I.right}</button>`;
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
    note = `This week: ${esc(hi)} leads with ${trim(cur[hi])} sets.` + (zero.length ? ` No sets yet for ${esc(zero.join(', '))}.` : '');
  }
  return `<div class="card"><div class="card-h"><span class="eyebrow">Weekly volume</span><span class="cap">${U()} lifted, last 12 weeks</span></div>${barChart({ bars, h: 160, yfmt: v => v >= 1000 ? trim(v / 1000) + 'k' : n0(v) })}</div>
  <div class="card"><div class="card-h"><span class="eyebrow">Sets per muscle</span><span class="cap">this week · <span style="color:var(--muted)">▮</span> 4-week avg</span></div>
    <div class="stack" style="gap:8px">${musc.map(m => `<div class="hbar"><span class="sec">${m}</span><div class="b" style="position:relative"><i style="width:${(cur[m] || 0) / mx * 100}%;background:var(--text)"></i><span style="position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--muted);left:${(prev4[m] || 0) / mx * 100}%"></span></div><span class="num" style="text-align:right">${trim(cur[m] || 0)}</span></div>`).join('') || '<div class="empty">No sets this week yet.</div>'}</div>
    ${note ? `<div class="note" style="margin-top:12px">${note}</div>` : ''}
    <div class="cap" style="margin-top:10px">Left and right sides of one exercise count as one set together.</div></div>`;
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
    if (m !== lastM) { list += `${lastM ? '</div></div>' : ''}<div class="card"><div class="eyebrow" style="margin-bottom:4px">${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}</div><div class="list">`; lastM = m; }
    const sp = wSplit(w);
    list += `<button class="li" data-a="openWk" data-id="${w.id}"><span class="tag" style="width:6px;height:32px;border-radius:3px;background:${sp ? sp.color : 'var(--muted)'};flex:none"></span><div class="grow"><div class="t">${esc(w.splitName || 'Workout')}${w.skipped ? ' <span class="pill" style="color:var(--neg)">Skipped</span>' : ''}</div><div class="s">${esc(fmtDate(w.date, { wd: true }))}${w.skipped ? '' : ' · ' + w.ex.length + ' exercises · ' + wSets(w) + ' sets'}${w.end && w.start ? ' · ' + fmtDur(w.end - w.start) : ''}</div></div><span class="num sec">${w.skipped ? '' : dvol(wVol(w))}</span>${I.right}</button>`;
  }
  if (lastM) list += '</div></div>';
  const trained = ws.filter(w => !w.skipped).length;
  return `<div class="card"><div class="card-h"><span class="eyebrow">Training days</span><span class="cap">${trained} workouts since ${fmtDate(start)}</span></div><div class="heat" aria-label="Calendar of training days">${cells}</div>
  <div class="legend" style="margin-top:8px"><span><i style="background:var(--accent);height:8px;width:8px;border-radius:2px"></i>Heavier day</span><span><i style="background:#3a4a1a;height:8px;width:8px;border-radius:2px"></i>Lighter day</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--neg);height:8px;width:8px;border-radius:2px"></i>Skipped</span></div></div>
  ${list || '<div class="empty">No workouts yet.</div>'}`;
}

// ---------- exercise detail ----------
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
  <div class="top" style="padding-top:0"><div><button class="eyebrow" data-a="exCat" data-k="${esc(b)}" style="min-height:28px">${esc(info.muscle)} · ${esc(info.equip)} ▾</button><h1>${esc(b)}</h1></div></div>
  ${opts.length > 1 ? `<div class="seg">${opts.map(o => `<button class="${v.sel === o ? 'on' : ''}" data-a="exSel" data-k="${esc(o)}">${sideOf(o) ? (sideOf(o) === 'L' ? 'Left' : 'Right') : opts.length > 2 ? 'Two-arm' : 'Both'}</button>`).join('')}${sides.length === 2 ? `<button class="${v.sel === 'both' ? 'on' : ''}" data-a="exSel" data-k="both">L + R</button>` : ''}</div>` : ''}
  <div class="card"><div class="kpis"><div class="kpi"><b>${e1f(B.e1)}</b><span>best e1RM</span></div><div class="kpi"><b>${B.maxW ? dw(B.maxW) : '—'}</b><span>heaviest</span></div><div class="kpi"><b>${B.vol ? dvol(B.vol) : '—'}</b><span>best set vol</span></div></div>
  ${bw && B.e1 ? `<div class="cap" style="margin-top:10px">Strength-to-weight: e1RM is <b class="num" style="color:var(--text)">${(B.e1 / bw.w).toFixed(2)}×</b> your body weight${(() => { const old = sessions.filter(s => daysBetween(s.date, today()) >= 60 && s.e1 > 0); if (!old.length) return ''; const o = old[old.length - 1]; const ow = weightOn(o.date); return ow ? ` (was ${(Math.max(...old.map(s => s.e1)) / ow.w).toFixed(2)}× two months ago)` : ''; })()}.</div>` : ''}</div>
  <div class="card"><div class="seg" style="margin-bottom:12px">${[['e1', 'e1RM'], ['top', 'Top set'], ['vol', 'Volume']].map(([k, l]) => `<button class="${v.metric === k ? 'on' : ''}" data-a="exMetric" data-k="${k}">${l}</button>`).join('')}</div>
    ${lineChart({ series, h: 180, yfmt: x => v.metric === 'vol' ? n0(x) : trim(Math.round(x * 10) / 10) })}
    ${sel.length > 1 ? `<div class="legend" style="margin-top:8px">${sel.map((n, i) => `<span><i style="background:${colors[i]}"></i>${sideOf(n) === 'L' ? 'Left' : 'Right'}</span>`).join('')}</div>` : ''}
  </div>
  <div class="card"><div class="card-h"><span class="eyebrow">Best sets${sel.length > 1 ? ' · right side' : ''}</span><span class="cap">heaviest weight for at least N reps</span></div>
    <table class="tbl"><tr><th>Reps</th><th class="r">Weight</th><th class="r">Set</th><th class="r">Date</th></tr>${[1, 3, 5, 8, 10, 12].map(n => { const s = bestFor(n); return `<tr><td>${n}+</td><td class="r num">${s ? dw(s.w) + ' ' + U() : '—'}</td><td class="r num sec">${s ? setStr(s) : ''}</td><td class="r sec">${s ? fmtDate(s.date) : ''}</td></tr>`; }).join('')}</table></div>
  <div class="card"><div class="card-h"><span class="eyebrow">History</span><span class="cap">${sessions.length} sessions</span></div><div class="list">${histSessions.map(s => `<button class="li" data-a="openWk" data-id="${s.wid}"><div class="grow"><div class="t">${esc(fmtDate(s.date, { wd: true }))}${sel.length > 1 ? ` <span class="cap">${sideOf(s.n)}</span>` : ''}</div><div class="s num">${s.sets.map(setStr).join(', ')}${s.note ? ' · ' + esc(s.note) : ''}</div></div><span class="num sec">${s.vol ? dvol(s.vol) : ''}</span></button>`).join('')}</div></div>
</div>`;
}

// ---------- workout detail (history) ----------
function viewWorkout(v) {
  const w = S.workouts[v.id]; if (!w) return backBtn();
  const pr = new Map(ix().prs.filter(p => p.wid === w.id).map(p => [p.ex, p]));
  const ed = !!v.edit;
  return `<div class="stack"><div class="row between">${backBtn()}<div class="row" style="gap:8px">${!ed && !w.skipped ? '<button class="btn sm" data-a="recap">Recap</button>' : ''}<button class="btn sm" data-a="wkEdit">${ed ? 'Done' : 'Edit'}</button></div></div>
  <div class="top" style="padding-top:0"><div><div class="eyebrow">${esc(fmtDate(w.date, { wd: true, y: true }))}${w.src === 'import' ? ' · imported' : ''}</div><h1>${esc(w.splitName || 'Workout')}</h1></div></div>
  ${ed ? `<div class="grid2"><div class="field"><label for="wk-date">Date</label><input class="input" type="date" id="wk-date" data-in="wkDate" value="${w.date}"></div><div class="field"><label for="wk-split">Split</label><select class="input" id="wk-split" data-in="wkSplit">${S.splits.map(s => `<option value="${s.id}" ${wSplit(w) === s ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div></div>` : ''}
  ${w.skipped ? `<div class="card"><div class="empty">This session was skipped.</div></div>` : `<div class="card"><div class="kpis"><div class="kpi"><b>${dvol(wVol(w))}</b><span>${U()} volume</span></div><div class="kpi"><b>${wSets(w)}</b><span>sets</span></div><div class="kpi"><b>${w.end && w.start ? fmtDur(w.end - w.start) : '—'}</b><span>duration</span></div></div>${w.energy ? `<div class="cap" style="margin-top:10px">Energy ${w.energy}/5</div>` : ''}${w.note ? `<div class="note" style="margin-top:10px">${esc(w.note)}</div>` : ''}</div>`}
  ${w.ex.map((e, ei) => `<div class="card tight"><div class="row between"><button class="ex-name" data-a="openEx" data-name="${esc(e.name)}" style="font-size:16px">${esc(e.name)}</button>${pr.has(e.name) ? `<span class="pill pr">PR · ${esc(pr.get(e.name).types[0])}</span>` : ''}</div>
    ${e.note ? `<div class="cap" style="margin-top:2px">${esc(e.note)}</div>` : ''}
    ${ed ? `<div class="stack" style="gap:6px;margin-top:8px">${e.sets.map((s, si) => `<div class="row" style="gap:6px"><span class="cap" style="width:22px">${si + 1}</span><input class="input sm num" style="width:84px" inputmode="decimal" id="ws-${ei}-${si}-w" data-in="wsSet" data-e="${ei}" data-s="${si}" data-f="w" value="${s.w == null ? '' : dw(s.w)}" aria-label="Weight"><span class="cap">${U()} ×</span><input class="input sm num" style="width:60px" inputmode="numeric" id="ws-${ei}-${si}-r" data-in="wsSet" data-e="${ei}" data-s="${si}" data-f="r" value="${s.r == null ? '' : s.r}" aria-label="Reps"><button class="icon-btn" data-a="wsDel" data-e="${ei}" data-s="${si}" aria-label="Delete set">${I.x}</button></div>`).join('')}</div>`
      : `<div class="num sec" style="margin-top:6px;font-size:15px">${e.sets.map(setStr).join('  ·  ')}</div>`}
  </div>`).join('')}
  ${ed ? `<div class="field"><label for="wk-note">Note</label><textarea class="input" id="wk-note" data-in="wkNote">${esc(w.note || '')}</textarea></div><button class="btn block danger" data-a="wkDelete">Delete this workout</button>` : ''}
</div>`;
}

// ---------- Me ----------
function viewMe() {
  const p = S.profile, lw = latestWeight(), fw = firstWeight();
  return `<div class="stack"><div class="top"><div><div class="eyebrow">Profile</div><h1>${esc(p.name)}</h1></div></div>
  <div class="card"><div class="kpis"><div class="kpi"><b>${p.heightCm ? p.heightCm + ' cm' : '—'}</b><span>height</span></div><div class="kpi"><b>${lw ? bw(lw.w) + ' ' + U() : '—'}</b><span>current</span></div><div class="kpi"><b>${lw && fw ? bw(lw.w - fw.w, true) : '—'}</b><span>since ${fw ? esc(fmtDate(fw.d)) : 'start'}</span></div></div>
    <div class="cap" style="margin-top:12px">${ix().ws.filter(w => !w.skipped).length} workouts logged · BMI ${lw && p.heightCm ? (lw.w / (p.heightCm / 100) ** 2).toFixed(1) : '—'}</div></div>
  <h2>Settings</h2>
  <div class="card stack">
    <div class="field"><span>Theme</span><div class="themes">${THEMES.map(t => `<button class="theme-opt ${theme() === t.k ? 'on' : ''}" data-a="theme" data-k="${t.k}"><i style="background:${t.sw}"></i>${t.name}</button>`).join('')}</div></div>
    <div class="row between"><span>Sounds</span><div class="seg" style="width:140px"><button class="${S.profile.sound !== false ? 'on' : ''}" data-a="soundToggle" ${S.profile.sound !== false ? 'disabled' : ''}>On</button><button class="${S.profile.sound === false ? 'on' : ''}" data-a="soundToggle" ${S.profile.sound === false ? 'disabled' : ''}>Off</button></div></div>
    <button class="row between" data-a="plates" style="width:100%;min-height:44px;text-align:left"><span>Plate loader</span>${I.right}</button>
    <button class="row between" data-a="myEx" style="width:100%;min-height:44px;text-align:left"><span>My exercises and muscle groups</span>${I.right}</button>
    <div class="row between"><span>Units</span><div class="seg" style="width:140px"><button class="${U() === 'kg' ? 'on' : ''}" data-a="unit" data-k="kg">kg</button><button class="${U() === 'lb' ? 'on' : ''}" data-a="unit" data-k="lb">lb</button></div></div>
    <label class="row between"><span>Daily step goal</span><input class="input sm num" style="width:110px;text-align:right" inputmode="numeric" id="set-steps" data-in="prof" data-f="stepGoal" value="${p.stepGoal}"></label>
    <label class="row between"><span>Workouts per week</span><input class="input sm num" style="width:110px;text-align:right" inputmode="numeric" id="set-week" data-in="prof" data-f="weeklyTarget" value="${p.weeklyTarget}"></label>
    <label class="row between"><span>Rest timer (seconds)</span><input class="input sm num" style="width:110px;text-align:right" inputmode="numeric" id="set-rest" data-in="prof" data-f="defaultRest" value="${p.defaultRest}"></label>
    <label class="row between"><span>Height (cm)</span><input class="input sm num" style="width:110px;text-align:right" inputmode="numeric" id="set-h" data-in="prof" data-f="heightCm" value="${p.heightCm || ''}" placeholder="170"></label>
  </div>
  <h2>Steps from QWatch</h2>
  <div class="card stack">
    ${HOSTED && USER ? `<p class="sec" style="margin:0;font-size:14px">QWatch Pro sends your steps to Apple Health. An evening Apple Shortcut then sends them from Health to JobDone by itself, with no app opening. It needs a sync key, which you make once here.</p>
    <button class="btn block" data-a="syncKey">Create sync key</button>
    <details><summary class="link">Set up the evening Shortcut (one time)</summary>
      <ol class="sec" style="font-size:14px;padding-left:20px;display:flex;flex-direction:column;gap:6px;margin:6px 0 0">
        <li>Make a sync key above and copy it.</li>
        <li>Open Shortcuts, tap +, and name it “JobDone steps”.</li>
        <li>Add <b>Find Health Samples</b>: Type is Steps, Start Date is in the last 3 days, Group By Day.</li>
        <li>Add <b>Repeat with Each</b>. Inside it, add <b>Text</b> containing the item’s Start Date (format: Custom, <span class="num">yyyy-MM-dd</span>), a space, then the item’s Value.</li>
        <li>After the repeat, add <b>Combine Text</b> with New Lines.</li>
        <li>Add <b>Get Contents of URL</b> with the address shown with your key. Method POST. Header <b>Authorization</b> = <span class="num">Bearer</span>, a space, then your key. Request Body JSON with one Text field <b>text</b> set to Combined Text.</li>
        <li>Optional: add <b>Show Notification</b> with Contents of URL, so you see “Saved…”.</li>
        <li>Run it once. Then in the Automation tab add a daily Time of Day automation at 9:30 PM, set to Run Immediately, that runs “JobDone steps”.</li>
      </ol></details>` : `<p class="sec" style="margin:0;font-size:14px">Your QWatch steps reach Apple Health. Type them on Today, or copy them from an Apple Shortcut and paste them here. Sign in on the JobDone website to have a Shortcut send them automatically every evening.</p>`}
    <button class="btn ${HOSTED && USER ? 'ghost ' : ''}block" data-a="steps">Add or paste steps by hand</button>
  </div>
  ${HOSTED && USER ? `<h2>Account</h2><div class="card stack"><div class="row between"><div class="grow"><div class="cap">Signed in as</div><div style="font-weight:600;overflow-wrap:anywhere">${esc(USER.email || 'your account')}</div></div><button class="btn sm" data-a="signOut">Sign out</button></div><button class="btn block" data-a="setPassword">Set or change password</button></div>` : ''}
  <h2>Your data</h2>
  <div class="card stack">
    <div class="note">${HOSTED ? (mode === 'cloud' ? 'Saved to your JobDone account. Sign in on any device and your log is there.' : 'Not signed in. Changes are kept on this device until you sign in.') : mode === 'cloud' ? 'Saved to your Claude account. Open this same link on any device signed in as you and your log is there.' : 'Saved in this browser only. Sign in to Claude and open the link there to keep it in your account.'}</div>
    <label class="btn block" for="csv-file">Import workouts from CSV</label><input type="file" id="csv-file" accept=".csv,text/csv" data-in="csvFile" hidden>
    <label class="btn block" for="bk-file">Restore from a backup (JSON)</label><input type="file" id="bk-file" accept=".json,application/json" data-in="bkFile" hidden>
    <div class="row"><button class="btn grow" data-a="export" data-k="json">Export JSON</button><button class="btn grow" data-a="export" data-k="csv">Export CSV</button></div>
    <button class="btn block ghost danger" data-a="reset">Erase all data</button>
  </div>
  <p class="cap" style="text-align:center">JobDone · built from your build prompt, Oct 2026</p>
</div>`;
}

// ---------- active workout ----------
function newExEntry(name, nSets, rest, tip) {
  const last = lastSession(name);
  const src = last ? last.sets : [];
  const n = Math.max(nSets || 0, src.length) || 2;
  const sets = [];
  for (let i = 0; i < n; i++) {
    const p = src[i] || src[src.length - 1];
    sets.push({ w: p ? p.w : null, r: p ? p.r : null, t: 'work', done: false });
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
      b.querySelector('#dy-list').innerHTML = `<div class="stack" style="gap:10px">
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
  try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
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
  const el = $('#wk'); if (!el) return;
  if (!A || !A.open) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  if (A.view === 'summary') { el.innerHTML = summaryHTML(); return; }
  const body = el.querySelector('.wk-body'); const keep = body ? body.scrollTop : 0;
  const gv = ghostVol(), dv = doneVol(), totalSets = A.ex.reduce((a, e) => a + e.sets.length, 0), doneSets = A.ex.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const scale = Math.max(gv, dv, 1);
  el.innerHTML = `<div class="wk-head"><div class="row between"><button class="icon-btn" data-a="minWk" aria-label="Minimise workout">${I.down}</button>
      <div style="text-align:center" class="grow"><div class="wkname">${esc(A.splitName)}</div>${A.date ? `<button class="cap daychip" data-a="wkDay">${esc(fmtDate(A.date, { wd: true }))} ▾</button>` : `<div class="cap num"><span data-elapsed>${fmtDur(Date.now() - A.start)}</span> · <button class="cap daychip" data-a="wkDay">Today ▾</button></div>`}</div>
      <button class="btn sm primary" data-a="finish">Finish</button></div>
    <div class="row between" style="margin-top:8px;font-size:13px"><span class="sec"><b class="num" style="color:var(--text)">${dvol(dv)}</b> ${U()} lifted</span><span class="sec"><b class="num" style="color:var(--text)">${doneSets}</b> / ${totalSets} sets</span>${gv ? `<span class="${dv >= gv ? 'pos' : 'sec'}">${dv >= gv ? 'Past last time' : dvol(gv - dv) + ' to match last'}</span>` : ''}</div>
    ${gv ? `<div class="race" aria-hidden="true"><i class="ghost" style="width:${gv / scale * 100}%"></i><i class="me ${dv >= gv ? 'ahead' : ''}" style="width:${dv / scale * 100}%"></i></div>` : ''}
  </div>
  <div class="wk-body">${A.ex.map(exCardHTML).join('')}
    <button class="btn block" data-a="wkAddEx">Add exercise</button>
    <button class="link" data-a="wkDiscard" style="align-self:center;color:var(--neg)">Discard workout</button>
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
  if (tgt && last && last.top && last.sets.filter(validSet).length && last.sets.filter(validSet).every(s => s.r >= tgt.repMax)) sugg = `Hit ${tgt.repMax}+ on every set last time. Try ${dw(last.top.w + 2.5)} ${U()}.`;
  else if (last && /marked UP/i.test(last.note || '')) sugg = `You marked this UP last time. Try ${dw(last.top ? last.top.w + 2.5 : 0)} ${U()}.`;
  const dsets = e.sets.filter(s => s.done);
  const cmp = dsets.length && last ? `<div class="cmp"><span class="sec">vs last:</span><span>top ${delta(topSet(dsets) ? topSet(dsets).w : null, last.top ? last.top.w : null, v => dw(v))}</span><span>vol ${delta(exVol(dsets), exVol(last.sets.slice(0, dsets.length)), v => dvol(v))}</span><span class="sec">(${dsets.length} set${dsets.length > 1 ? 's' : ''})</span></div>` : '';
  return `<section class="card tight" id="ex-${ei}" aria-label="${esc(e.name)}">
    <div class="row between"><div class="grow"><div class="ex-name">${esc(e.name)}</div>${e.tip ? `<div class="cap">${esc(e.tip)}</div>` : ''}</div><button class="icon-btn" data-a="exMenu" data-e="${ei}" aria-label="Options for ${esc(e.name)}">${I.more}</button></div>
    ${sugg ? `<div class="cap" style="margin:4px 0 2px;color:var(--text)">↗ ${esc(sugg)}</div>` : ''}
    ${e.note ? `<div class="cap" style="font-style:italic">${esc(e.note)}</div>` : ''}
    <table class="sets" style="margin-top:6px"><thead><tr><th>Set</th><th>Previous</th><th>${U()}</th><th>Reps</th><th><span class="sr" style="position:absolute;left:-9999px">Done</span></th></tr></thead><tbody>
    ${e.sets.map((s, si) => { const pv = last && last.sets[si]; const pr = prs[si] || []; const lbl = s.t === 'warm' ? 'W' : s.t === 'drop' ? 'D' : s.t === 'fail' ? 'F' : si + 1 - e.sets.slice(0, si).filter(x => x.t === 'warm').length; return `<tr class="${s.done ? 'done' : ''}" id="row-${ei}-${si}">
      <td><button class="setno ${s.t}" data-a="setType" data-e="${ei}" data-s="${si}" aria-label="Set ${si + 1}, ${s.t === 'work' ? 'working' : s.t === 'warm' ? 'warm-up' : s.t === 'drop' ? 'drop' : 'failure'} set. Tap to change type">${lbl}</button></td>
      <td class="prev">${pv ? setStr(pv) : '—'}${pr.length ? ' <span class="pill pr" title="' + esc(pr.join(', ')) + '">PR</span>' : ''}</td>
      <td><button class="cell ${s.ed || s.done ? 'edited' : ''}" data-a="key" data-e="${ei}" data-s="${si}" data-f="w" aria-label="Weight">${s.w == null ? '–' : dw(s.w)}</button></td>
      <td><button class="cell ${s.ed || s.done ? 'edited' : ''}" data-a="key" data-e="${ei}" data-s="${si}" data-f="r" aria-label="Reps">${s.r == null ? '–' : s.r}</button></td>
      <td><button class="check" data-a="done" data-e="${ei}" data-s="${si}" aria-label="${s.done ? 'Undo set' : 'Log set'}" aria-pressed="${s.done}">${I.check}</button></td></tr>`; }).join('')}
    </tbody></table>
    <div class="row between" style="margin-top:6px"><button class="btn sm ghost" data-a="addSet" data-e="${ei}">+ Add set</button>${e.sets.length > 1 ? `<button class="btn sm ghost" data-a="rmSet" data-e="${ei}" style="color:var(--text2)">Remove last</button>` : ''}</div>
    ${cmp}
  </section>`;
}
function restLeft() { return REST ? Math.max(0, REST.paused ? REST.left : (REST.end - Date.now()) / 1000) : 0; }
function restHTML() {
  const left = restLeft(), p = 1 - left / REST.total;
  if (REST.min) return `<button class="restpill" data-a="restOpen" aria-label="Show rest timer"><span class="hg-mini">${hourglass(p, REST.paused)}</span><span class="t" data-rest>${clock(left)}</span></button>`;
  return `<div class="restpop ${REST.paused ? 'paused' : ''}" role="timer" aria-label="Rest timer">
    <div class="row between"><span class="eyebrow">${REST.paused ? 'Paused' : 'Rest'}</span><button class="icon-btn" data-a="restMin" aria-label="Shrink rest timer">${I.down}</button></div>
    <div class="hg" data-hg style="--p:${p.toFixed(4)}">${hourglass(p, REST.paused)}</div>
    <div class="t" data-rest>${clock(left)}</div>
    <div class="row" style="gap:8px;justify-content:center"><button class="btn sm" data-a="rest" data-d="-30">−30s</button><button class="btn sm primary" data-a="restPause">${REST.paused ? 'Resume' : 'Pause'}</button><button class="btn sm" data-a="rest" data-d="30">+30s</button></div>
    <button class="link" data-a="rest" data-d="0" style="align-self:center">Skip rest</button>
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
let audioCtx = null;
// Short synth sounds (no files). Cheers play even on silent and briefly duck music; dial clicks follow the silent switch.
function tones(notes, type = 'sine', vol = .22) {
  if (S && S.profile && S.profile.sound === false) return;
  try {
    if (navigator.audioSession) navigator.audioSession.type = type === 'tick' ? 'ambient' : 'transient';
    if (type === 'tick') type = 'sine';
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    for (const [f, at, len = .18] of notes) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol, t0 + at + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + at + len);
      o.connect(g).connect(audioCtx.destination); o.start(t0 + at); o.stop(t0 + at + len + .05);
    }
  } catch (e) {}
}
// iPhone only allows audio after a tap, so wake the audio engine on the first touch (needed for dial clicks that fire while scrolling).
document.addEventListener('touchend', function unlock() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {} document.removeEventListener('touchend', unlock); }, { passive: true });
const SOUNDS = {
  low: () => tones([[392, 0, .22], [330, .16, .3]], 'triangle', .18),
  nice: () => tones([[659, 0, .2], [880, .1, .3]]),
  great: () => tones([[523, 0], [659, .09], [784, .18, .35]], 'triangle'),
  amazing: () => tones([[523, 0], [659, .08], [784, .16], [1047, .26, .5], [1319, .26, .5]], 'triangle', .2),
  next: () => tones([[784, 0, .12], [988, .1, .12], [1175, .2, .12], [1568, .3, .45]], 'square', .08),
  tick: () => tones([[1800, 0, .025]], 'tick', .05),
  rest: () => tones([[880, 0, .15], [880, .2, .15], [1175, .42, .4]]),
};
// What a finished set says, by reps.
function setVerdict(r) {
  if (r <= 4) return { k: 'low', title: 'Easy, champ', sub: 'Drop the weight a little. Good form beats ego lifting.', bits: 0 };
  if (r <= 6) return { k: 'nice', title: 'Nice!', sub: 'Solid set.', bits: 24 };
  if (r <= 8) return { k: 'great', title: 'Great set!', sub: 'Almost time to move up.', bits: 45 };
  return { k: 'amazing', title: 'Amazing!', sub: 'Time to add weight next session.', bits: 90 };
}
function celebrate(v, delay = 0) {
  setTimeout(() => {
    document.querySelectorAll('.cele').forEach(c => c.remove());
    const c = document.createElement('div'); c.className = 'cele cele-' + v.k; c.setAttribute('role', 'status');
    c.innerHTML = `<b>${esc(v.title)}</b><span>${esc(v.sub)}</span>`;
    document.body.appendChild(c); setTimeout(() => c.remove(), v.ms || 2200);
    if (v.bits) confetti(v.bits);
    (SOUNDS[v.k] || (() => {}))();
  }, delay);
}

function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach(t => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.15); o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.16); });
  } catch (e) {}
}
function tick() {
  document.querySelectorAll('[data-elapsed]').forEach(n => { if (A) n.textContent = fmtDur(Date.now() - A.start); });
  if (REST) {
    const left = restLeft();
    if (left <= 0) { REST = null; SOUNDS.rest(); buzz([30, 60, 30]); toast('Rest done. Next set.'); renderWorkout(); return; }
    const t = $('[data-rest]'); if (t) t.textContent = clock(left);
    const hg = $('.restpop .hg, .restpill .hg-mini'); if (hg && !REST.paused) hg.innerHTML = hourglass(1 - left / REST.total, false);
  }
}
function logSet(ei, si) {
  const e = A.ex[ei], s = e.sets[si];
  s.done = !s.done; s.at = s.done ? Date.now() : null;
  if (s.done) {
    buzz(10);
    const pr = livePR(e)[si];
    const secs = S.profile.defaultRest || 300;
    REST = { end: Date.now() + secs * 1000, total: secs, paused: false, min: false };
    touchA();
    const row = $(`#row-${ei}-${si}`); if (row) row.classList.add('pop');
    if (s.t !== 'warm' && s.r > 0) {
      const v = setVerdict(s.r); celebrate(v);
      const work = e.sets.filter(x => x.t !== 'warm'), doneN = work.filter(x => x.done).length;
      if (doneN === work.length && work.length) {
        const nx = A.ex.slice(ei + 1).find(x => x.sets.some(y => !y.done)) || A.ex.find(x => x.sets.some(y => !y.done));
        celebrate({ k: 'next', title: 'Woohoo!', sub: nx ? 'On to ' + nx.name + '.' : 'Every set done. Finish when you’re ready.', bits: 50, ms: 2600 }, 1500);
        if (nx) setTimeout(() => { const el = $('#ex-' + A.ex.indexOf(nx)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 1700);
      }
    }
    if (pr.length) { buzz([20, 40, 60]); confetti(); toast(`<span class="pill pr">PR</span> ${esc(e.name)}: ${esc(setStr(s))} · ${esc(pr.join(', '))}`); const r2 = $(`#row-${ei}-${si} .check`); if (r2) r2.classList.add('glow'); }
  } else touchA();
}
function summaryData() {
  const ex = A.ex.map(e => ({ ...e, sets: e.sets.filter(s => s.done).map(s => ({ w: s.w, r: s.r, t: s.t })) })).filter(e => e.sets.length);
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
    <div><div class="eyebrow">Workout complete</div><h1>${esc(A.splitName)}</h1><button class="cap daychip" data-a="wkDay" style="margin-top:6px">${A.date ? esc(fmtDate(A.date, { wd: true })) : 'Today'} ▾ change day</button></div>
    <div class="card"><div class="kpis" style="grid-template-columns:repeat(4,1fr)"><div class="kpi"><b>${fmtDur(Date.now() - A.start)}</b><span>time</span></div><div class="kpi"><b>${dvol(d.vol)}</b><span>${U()} volume</span></div><div class="kpi"><b>${d.sets}</b><span>sets</span></div><div class="kpi"><b class="${d.prs ? 'acc' : ''}">${d.prs}</b><span>PRs</span></div></div></div>
    <div class="card"><div class="eyebrow" style="margin-bottom:4px">Compared with last time</div><div class="list">${d.rows.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.e.name)} ${r.types.length ? `<span class="pill pr">PR · ${esc(r.types[0])}</span>` : ''}</div><div class="s num">${r.e.sets.map(setStr).join(', ')}</div></div><div style="text-align:right;font-size:13px" class="num"><div>top ${r.last ? delta(r.top ? r.top.w : null, r.last.top ? r.last.top.w : null, v => dw(v)) : '<span class="sec">first time</span>'}</div><div>vol ${r.last ? delta(r.vol, r.last.vol, v => dvol(v)) : ''}</div></div></div>`).join('') || '<div class="empty">No sets logged. Go back and tick some sets, or discard the workout.</div>'}</div></div>
    <div class="field"><label for="sum-note">Note</label><textarea class="input" id="sum-note" data-in="sumNote" placeholder="How did it go?">${esc(A.note || '')}</textarea></div>
    <div class="field"><span class="lbl">Energy</span><div class="seg">${[1, 2, 3, 4, 5].map(n => `<button class="${A.energy === n ? 'on' : ''}" data-a="energy" data-k="${n}">${n}</button>`).join('')}</div></div>
    ${changed ? `<label class="card tight row between" for="sum-upd"><span>Update the ${esc(sp.name)} split with today’s exercises</span><input type="checkbox" id="sum-upd" data-in="sumUpd" ${A.updSplit ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--accent)"></label>` : ''}
    <button class="btn primary block" data-a="saveWk" ${d.sets ? '' : 'disabled'}>Save workout</button>
  </div>`;
}
function saveWorkout() {
  const d = summaryData(); if (!d.sets) return;
  const w = { id: A.id, date: A.date || ymd(new Date(A.start)), splitId: A.splitId, splitName: A.splitName, start: A.start, end: Date.now(), note: A.note || '', energy: A.energy || null, src: 'native', ex: d.ex.map(e => ({ name: e.name, note: e.note || '', sets: e.sets })) };
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

// ---------- Job Done recap (after saving, or from a past workout) ----------
const HEAVY = [[20000, 'a city bus', 12000], [5000, 'an elephant', 5000], [1500, 'a car', 1500], [600, 'a polar bear', 600], [300, 'a grand piano', 300], [0, 'a fridge', 100]];
function recapData(id) {
  const w = S.workouts[id], I2 = ix(), ws = I2.ws.filter(x => !x.skipped);
  const num = ws.findIndex(x => x.id === id) + 1;
  const prev = ws.slice(0, Math.max(0, num - 1)).reverse().find(x => (w.splitId && x.splitId === w.splitId) || (!w.splitId && x.splitName === w.splitName));
  const vol = wVol(w), sets = w.ex.reduce((a, e) => a + e.sets.filter(x => x.t !== 'warm').length, 0), reps = w.ex.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x.t !== 'warm' && x.r ? x.r : 0), 0), 0);
  const prs = I2.prs.filter(p => p.wid === id);
  const mus = {}; for (const e of w.ex) { const m = exInfo(e.name).muscle, n = e.sets.filter(x => x.t !== 'warm').length * (sideOf(e.name) ? .5 : 1); mus[m] = (mus[m] || 0) + n; }
  const musL = Object.entries(mus).sort((a, b) => b[1] - a[1]);
  const kg = vol, h = HEAVY.find(x => kg >= x[0]) || HEAVY[HEAVY.length - 1], times = Math.max(1, Math.round(kg / h[2] * 10) / 10);
  const dur = w.end && w.start ? w.end - w.start : 0;
  return { w, num, prev, vol, sets, reps, prs, musL, dur, heavy: `${times % 1 ? times.toFixed(1) : times}× ${h[1]}`, dv: prev ? (vol - wVol(prev)) / Math.max(1, wVol(prev)) : null };
}
function showRecap(id, fresh) {
  const d = recapData(id); if (!d.w) return;
  const old = document.getElementById('recap'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'recap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Workout recap');
  const pr = new Map(d.prs.map(p => [p.ex, p])), mx = d.musL.length ? d.musL[0][1] : 1;
  el.innerHTML = `<div class="rc-body">
    <div class="rc-hero"><div class="rc-check">${fresh ? '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>' : '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>'}</div>
      <div class="eyebrow">Workout #${d.num} · ${esc(fmtDate(d.w.date, { wd: true }))}</div><h1>Job done!</h1><div class="sec">${esc(d.w.splitName || 'Workout')}${d.prs.length ? ` · <b style="color:var(--text)">${d.prs.length} PR${d.prs.length > 1 ? 's' : ''}</b>` : ''}</div></div>
    <div class="rc-stats">
      <div class="rc-st"><b>${d.dur ? fmtDur(d.dur) : '—'}</b><span>time</span></div>
      <div class="rc-st"><b>${dvol(d.vol)}</b><span>${U()} lifted</span></div>
      <div class="rc-st"><b>${d.sets}</b><span>sets</span></div>
      <div class="rc-st"><b>${d.reps}</b><span>reps</span></div>
    </div>
    <div class="card rc-fun"><span class="rc-emoji" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg></span><div>That's like lifting <b>${esc(d.heavy)}</b>.${d.dv != null ? `<div class="cap" style="margin-top:2px">${d.dv >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d.dv * 100))}% volume vs your last ${esc(d.w.splitName || 'workout')}</div>` : ''}</div></div>
    ${d.prs.length ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Personal records</div>${d.prs.map(p => `<div class="rc-pr"><span class="rc-medal" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 2l3 7M16 2l-3 7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="15" r="6" fill="#F4B728"/><path d="M9.5 15l1.7 1.7L14.8 13" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg></span><div class="grow"><div class="t">${esc(p.ex)}</div><div class="cap">${esc(p.types.join(' · '))}</div></div><b class="num">${setStr(p.set)}</b></div>`).join('')}</div>` : ''}
    <div class="card"><div class="eyebrow" style="margin-bottom:10px">Muscles worked</div>${d.musL.map(([m, n]) => `<div class="rc-mu"><span>${esc(m)}</span><i><b style="width:${Math.round(n / mx * 100)}%"></b></i><em class="num">${n % 1 ? n.toFixed(1) : n} sets</em></div>`).join('')}</div>
    <div class="card"><div class="eyebrow" style="margin-bottom:4px">Exercises</div><div class="list">${d.w.ex.map(e => { const t = topSet(e.sets); return `<div class="li"><div class="grow"><div class="t">${esc(e.name)} ${pr.has(e.name) ? '<span class="pill pr">PR</span>' : ''}</div><div class="s num">${e.sets.map(setStr).join('  ·  ')}</div></div><span class="num sec">${t ? 'best ' + setStr(t) : ''}</span></div>`; }).join('')}</div></div>
    <div class="cap" style="text-align:center">${esc(streakText())}</div>
    <div class="grid2"><button class="btn block" id="rc-share">Share</button><button class="btn primary block" id="rc-done">Done</button></div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); };
  el.querySelector('#rc-done').onclick = close;
  el.querySelector('#rc-share').onclick = () => shareRecap(d);
  if (fresh) { confetti(110); try { SOUNDS.amazing(); } catch (e) {} }
}
// Draw the recap as a 1080x1350 image in the current theme's colours and hand it to the share sheet.
async function shareRecap(d) {
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const F = (wt, px) => `${wt} ${px}px Nunito, system-ui, sans-serif`;
  try { await document.fonts.ready; } catch (e) {}
  const bg = /^#|^rgb/.test(v('--surface-solid')) ? v('--surface-solid') : '#FFFDFA';
  g.fillStyle = v('--bg') || '#EFEBE5'; g.fillRect(0, 0, W, H);
  g.fillStyle = v('--accent') || '#6C3FD6'; g.fillRect(0, 0, W, 360);
  g.fillStyle = v('--accent-ink') || '#fff'; g.font = F(900, 44); g.fillText(`WORKOUT #${d.num} · ${fmtDate(d.w.date, { wd: true, y: true }).toUpperCase()}`, 72, 110);
  g.font = F(900, 150); g.fillText('Job done!', 64, 260);
  g.font = F(800, 52); g.fillText(`${d.w.splitName || 'Workout'}${d.prs.length ? ` · ${d.prs.length} PR${d.prs.length > 1 ? 's' : ''}` : ''}`, 72, 330);
  const st = [[d.dur ? fmtDur(d.dur) : '—', 'time'], [dvol(d.vol), U() + ' lifted'], [String(d.sets), 'sets'], [String(d.reps), 'reps']];
  st.forEach(([a, b], i) => { const x = 56 + i * 246; g.fillStyle = bg; g.beginPath(); g.roundRect(x, 400, 226, 190, 36); g.fill(); g.fillStyle = v('--text') || '#221E2B'; g.font = F(900, 58); g.fillText(a, x + 26, 490); g.fillStyle = v('--text2') || '#5F5A69'; g.font = F(800, 34); g.fillText(b, x + 26, 548); });
  let y = 680; g.fillStyle = v('--text') || '#221E2B'; g.font = F(800, 40); g.fillText(`That's like lifting ${d.heavy}.`, 72, y); y += 80;
  const sec = (title, rows) => { if (!rows.length || y > H - 200) return; g.font = F(900, 34); g.fillStyle = v('--text2') || '#5F5A69'; g.fillText(title, 72, y); y += 66;
    for (const [a, b] of rows) { if (y > H - 140) break; g.fillStyle = v('--text') || '#221E2B'; g.font = F(800, 42); g.fillText(a.length > 28 ? a.slice(0, 27) + '…' : a, 72, y); g.textAlign = 'right'; g.fillText(b, W - 72, y); g.textAlign = 'left'; y += 66; } y += 30; };
  const prn = new Set(d.prs.map(p => p.ex));
  sec('PERSONAL RECORDS', d.prs.slice(0, 4).map(p => [p.ex, setStr(p.set)]));
  sec('BEST SETS', d.w.ex.filter(e => !prn.has(e.name)).map(e => [e.name, setStr(topSet(e.sets))]));
  g.fillStyle = v('--muted') || '#98929F'; g.font = F(900, 36); g.fillText('JobDone', 72, H - 72);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return;
  const file = new File([blob], `jobdone-${d.w.date}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Job done!' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- plate loader ----------
// Bar with sleeves; plates slide on from the ends, mirrored on both sides. Drag (or tap) plates from the tray.
const PLATE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>';
const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
const PLATE_COL = { 25: '#D8312B', 20: '#2F62C9', 15: '#E8B524', 10: '#2E8B4E', 5: '#F2F0EA', 2.5: '#B4302B', 1.25: '#9EA3AA', 45: '#2F62C9', 35: '#E8B524' };
const plateH = w => { const m = U() === 'lb' ? 45 : 25; return Math.round(46 + 104 * Math.sqrt(w / m)); };
// Weight entry starts on the plate loader; "Dial / keypad" switches to the number pad.
function openSetPlates(ei, si) {
  const e = A.ex[ei], s = e.sets[si];
  openPlates(s.w == null ? 0 : +dw(s.w), v => { s.w = Math.round(toKg(v) * 1000) / 1000; s.ed = true; touchA(); openKeypad(ei, si, 'r'); },
    { title: `${e.name} · set ${si + 1}`, alt: () => openKeypad(ei, si, 'w') });
}
function openPlates(target, onUse, o = {}) {
  const den = PLATES[U()], bars = U() === 'lb' ? [45, 35, 25, 0] : [20, 15, 10, 0];
  let bar = S.profile.barW != null ? S.profile.barW : 0; if (U() === 'lb' && S.profile.barW === 0) bar = 0;
  let side = [], fresh = -1;
  const total = () => Math.round((bar + 2 * side.reduce((a, b) => a + b, 0)) * 1000) / 1000;
  const auto = t => { side = []; let r = Math.max(0, (t - bar) / 2); for (const p of den) while (r >= p - 1e-9) { side.push(p); r = Math.round((r - p) * 1000) / 1000; } return r; };
  let left = target ? auto(target) : 0;
  const custom = () => (S.profile.customPlates || []).filter(x => x > 0);
  const svg = () => {
    const W = 340, cx = W / 2, H = 170, cy = H / 2;
    let xR = cx + 62, xL = cx - 62, out = '';
    side.forEach((p, i) => { const h = plateH(p), w = p >= (U() === 'lb' ? 25 : 10) ? 15 : 10, col = PLATE_COL[p] || 'var(--accent)', nw = i === fresh ? ' new' : '';
      out += `<g class="pl R${nw}" data-i="${i}"><rect x="${xR}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4" fill="${col}" stroke="rgba(0,0,0,.25)"/><rect x="${xR + 2}" y="${cy - h / 2 + 4}" width="3" height="${h - 8}" rx="1.5" fill="#fff" opacity=".25"/></g>`;
      out += `<g class="pl L${nw}" data-i="${i}"><rect x="${xL - w}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4" fill="${col}" stroke="rgba(0,0,0,.25)"/><rect x="${xL - w + 2}" y="${cy - h / 2 + 4}" width="3" height="${h - 8}" rx="1.5" fill="#fff" opacity=".25"/></g>`;
      xR += w + 2; xL -= w + 2; });
    return `<svg viewBox="0 0 ${W} ${H}" class="barsvg"><rect x="8" y="${cy - 5}" width="${W - 16}" height="10" rx="5" fill="#9BA1A8"/><rect x="${cx - 60}" y="${cy - 4}" width="120" height="8" fill="#7E848C"/><rect x="${cx - 64}" y="${cy - 14}" width="6" height="28" rx="2" fill="#6B7178"/><rect x="${cx + 58}" y="${cy - 14}" width="6" height="28" rx="2" fill="#6B7178"/>${out}</svg>`;
  };
  const tray = () => [...den, ...custom()].map(p => `<button class="plate-chip" data-p="${p}" style="--pc:${PLATE_COL[p] || 'var(--accent)'};--ph:${Math.max(34, plateH(p) * .42)}px"><i></i><b>${trim(p)}</b></button>`).join('');
  const sh = openSheet(`<div class="stack" style="gap:12px"><div class="row between"><div><div class="eyebrow">${esc(o.title || 'Plate loader')}</div><div class="big num" id="pl-tot">${trim(total())}<span class="unit">${U()}</span></div></div><button class="btn sm" id="pl-clear">Clear</button></div>
    <div class="cap" id="pl-msg"></div>
    <div class="bar-wrap" id="pl-bar"></div>
    <div class="field"><span class="lbl">Bar</span><div class="seg" id="pl-barw">${bars.map(b => `<button data-b="${b}" class="${b === bar ? 'on' : ''}">${b ? b + ' ' + U() : 'Plates only'}</button>`).join('')}</div></div>
    <div><span class="lbl">Drag a plate onto the bar, or tap it. Tap a plate on the bar to take it off.</span><div class="plate-tray" id="pl-tray">${tray()}</div></div>
    <div class="row" style="gap:8px"><input class="input num" id="pl-cw" inputmode="decimal" placeholder="Custom plate (${U()})" style="flex:1"><button class="btn" id="pl-cadd">Add plate</button></div>
    <div class="row" style="gap:8px"><input class="input num" id="pl-t" inputmode="decimal" placeholder="Target total" value="${target ? trim(target) : ''}" style="flex:1"><button class="btn" id="pl-auto">Load it</button></div>
    ${onUse ? `<div class="row" style="gap:8px">${o.alt ? `<button class="btn" id="pl-alt" style="flex:none">Dial / keypad</button>` : ''}<button class="btn primary block" id="pl-use" style="flex:1">Use <span id="pl-use-v">${trim(total())}</span> ${U()}${o.useLabel ? ', ' + esc(o.useLabel) : ''}</button></div>` : ''}
  </div>`, { label: 'Plate loader', mount: b => {
    const draw = () => {
      b.querySelector('#pl-bar').innerHTML = svg(); fresh = -1;
      b.querySelector('#pl-tot').firstChild.textContent = trim(total());
      const u = b.querySelector('#pl-use-v'); if (u) u.textContent = trim(total());
      b.querySelector('#pl-msg').textContent = side.length ? `Each side: ${side.map(trim).join(' + ')} ${U()}${left > 0.001 ? ` · ${trim(left * 2)} ${U()} short of your target` : ''}` : (bar ? `Empty ${bar} ${U()} bar` : 'Add plates to start');
    };
    const add = p => { side.push(p); side.sort((a, c) => c - a); fresh = side.lastIndexOf(p); left = 0; buzz(8); draw(); };
    draw();
    b.querySelector('#pl-bar').onclick = ev => { const g = ev.target.closest('.pl'); if (!g) return; side.splice(+g.dataset.i, 1); left = 0; buzz(5); draw(); };
    b.querySelector('#pl-clear').onclick = () => { side = []; left = 0; draw(); };
    b.querySelector('#pl-barw').onclick = ev => { const x = ev.target.closest('[data-b]'); if (!x) return; bar = +x.dataset.b; S.profile.barW = bar; persist('jd/meta'); b.querySelectorAll('#pl-barw button').forEach(y => y.classList.toggle('on', y === x)); draw(); };
    b.querySelector('#pl-auto').onclick = () => { const t = parseFloat(b.querySelector('#pl-t').value); if (!(t >= 0)) return; left = auto(t); fresh = -2; draw(); b.querySelectorAll('#pl-bar .pl').forEach((g, i) => { g.classList.add('new'); g.style.animationDelay = (Math.floor(i / 2) * .09) + 's'; }); };
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
  const dialHTML = () => { let t = ''; for (let i = 0; i < D.n; i++) { const m = i % D.every === 0; t += `<i class="${m ? 'm' : ''}">${m ? `<b>${trim(i * D.step)}</b>` : ''}</i>`; } return `<div style="position:relative"><div class="ruler" id="kp-dial" style="--tw:${D.px}px"><div class="ruler-in">${t}</div></div><span class="ruler-mark"></span></div>`; };
  const html = () => `<div class="stack" style="gap:14px"><div class="row between"><div><div class="cap">${esc(e.name)} · set ${si + 1}</div><div class="big" id="kp-val">${esc(cur() || '–')}<span class="unit">${f === 'w' ? U() : 'reps'}</span></div></div>${f === 'w' ? `<button class="btn sm" data-k="plates" style="margin-right:8px">${PLATE_ICON} Plates</button>` : ''}<div class="seg" style="width:130px"><button class="${f === 'w' ? 'on' : ''}" data-kf="w">${U()}</button><button class="${f === 'r' ? 'on' : ''}" data-kf="r">reps</button></div></div>
    ${dialHTML()}
    <div class="keys">
      ${['1', '2', '3'].map(k => `<button data-k="${k}">${k}</button>`).join('')}<button class="q" data-q="${q[0]}">${q[0]}</button>
      ${['4', '5', '6'].map(k => `<button data-k="${k}">${k}</button>`).join('')}<button class="q" data-q="${q[1]}">+${q[1]}</button>
      ${['7', '8', '9'].map(k => `<button data-k="${k}">${k}</button>`).join('')}<button class="q" data-q="${q[2]}">${q[2]}</button>
      <button data-k="." ${f === 'r' ? 'disabled style="opacity:.3"' : ''}>.</button><button data-k="0">0</button><button data-k="del" aria-label="Delete">⌫</button><button class="q" data-q="${q[3]}">+${q[3]}</button>
      <button class="q" data-k="next" style="grid-column:span 2">${f === 'w' ? 'Reps →' : 'Next set →'}</button><button class="done" data-k="done" style="grid-column:span 2">Done</button>
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
  const sh = openSheet(`<div class="stack" style="gap:14px">
    <div><div class="eyebrow">${isToday ? 'Morning weigh-in' : 'Weight entry'}</div>${isToday ? '' : `<input class="input" type="date" id="wi-date" value="${date}" style="margin-top:8px">`}</div>
    <div class="row between"><button class="icon-btn" data-wd="-1" aria-label="Decrease by 0.1" style="font-size:24px;background:var(--surface)">−</button><div class="big" style="text-align:center" id="wi-val">${val.toFixed(1)}<span class="unit">${U()}</span></div><button class="icon-btn" data-wd="1" aria-label="Increase by 0.1" style="font-size:24px;background:var(--surface)">+</button></div>
    <div style="position:relative"><div class="ruler" id="wi-ruler"><div class="ruler-in">${ticks}</div></div><span class="ruler-mark"></span></div>
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
    <p class="sec" style="margin:0;font-size:14px">A new key replaces any key you made before, so an old Shortcut stops working until you paste the new key in. JobDone shows the key only once.</p>
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
      el.querySelector('#sk-out').innerHTML = `<div class="stack" style="gap:10px">
        <div class="field"><label>Your key</label><textarea class="input num" readonly rows="2" style="min-height:0">${esc(key)}</textarea></div>
        <button class="btn block" data-copy="${esc(key)}">Copy key</button>
        <div class="field"><label>Shortcut address</label><textarea class="input num" readonly rows="2" style="min-height:0">${esc(url)}</textarea></div>
        <button class="btn block" data-copy="${esc(url)}">Copy address</button></div>`;
      for (const c of el.querySelectorAll('[data-copy]')) c.onclick = async () => { try { await navigator.clipboard.writeText(c.dataset.copy); toast('Copied'); } catch (e) { toast('Press and hold the text to copy it'); } };
    } catch (e) { b.disabled = false; toast('Could not create the key. Check your connection and try again.'); }
  };
  } });
}
function openSteps() {
  const t = today();
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Steps</div>
    <div class="grid2"><div class="field"><label for="st-date">Date</label><input class="input" type="date" id="st-date" value="${t}" max="${t}"></div><div class="field"><label for="st-n">Steps</label><input class="input num" id="st-n" inputmode="numeric" placeholder="8,500" value="${S.steps[t] || ''}"></div></div>
    <button class="btn primary block" id="st-save">Save</button>
    <div class="field" style="margin-top:8px"><label for="st-paste">Or paste from your “JobDone steps” shortcut</label><textarea class="input num" id="st-paste" placeholder="2026-10-13 9412&#10;2026-10-14 6120"></textarea></div>
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
    <label class="row cap" style="gap:8px"><input type="checkbox" id="pk-side" style="accent-color:var(--accent)"> Log left and right sides separately</label>
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

// Create a custom exercise, or change any exercise's muscle group and equipment.
function openExForm(name, o = {}) {
  const cur = name ? exInfo(name) : null, known = name && (LIB.some(e => e.name === name) || (S.customEx || []).some(e => e.name === name));
  let mu = o.muscle || (known ? cur.muscle : null), eq = known ? cur.equip : 'other';
  const sh = openSheet(`<div class="stack"><div class="eyebrow">${known ? 'Exercise group' : 'New exercise'}</div>
    <div class="field"><label for="ef-n">Name</label><input class="input" id="ef-n" value="${esc(name || '')}" placeholder="e.g. Hammer Curl" ${known ? 'disabled' : ''}></div>
    <div class="field"><span class="lbl">Muscle group</span><div class="chips wrap" id="ef-m">${MUSCLES.map(m => `<button class="chip ${mu === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">Equipment</span><div class="chips wrap" id="ef-e">${EQUIP.map(m => `<button class="chip ${eq === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}</div></div>
    <button class="btn primary block" id="ef-ok">Save</button>
    ${known && (S.customEx || []).some(e => e.name === name) && !LIB.some(e => e.name === name) ? '' : ''}
    <button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, { label: 'Exercise', mount: b => {
    const pick = (id, set) => b.querySelector(id).onclick = ev => { const c = ev.target.closest('[data-m]'); if (!c) return; set(c.dataset.m); b.querySelectorAll(id + ' .chip').forEach(x => x.classList.toggle('on', x === c)); };
    pick('#ef-m', v => mu = v); pick('#ef-e', v => eq = v);
    b.querySelector('#ef-ok').onclick = () => {
      const n = (b.querySelector('#ef-n').value || '').trim().replace(/\s+/g, ' ');
      if (!n) { toast('Give it a name'); return; }
      if (!mu) { toast('Pick a muscle group'); return; }
      S.customEx = (S.customEx || []).filter(e => e.name !== n); S.customEx.push({ name: n, muscle: mu, equip: eq });
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
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Start a workout</div><div class="list">${act.map(sp => { const l = lastOfSplit(sp); return `<button class="li" data-st="${sp.id}"><span class="tag" style="width:8px;height:36px;border-radius:4px;background:${sp.color};flex:none"></span><div class="grow"><div class="t">${esc(sp.name)} ${sp === nx ? '<span class="pill">Next up</span>' : ''}</div><div class="s">${sp.ex.length} exercises · ${l ? relDay(l.date) : 'never done'}</div></div>${I.right}</button>`; }).join('')}
    <button class="li" data-st=""><span style="width:8px;flex:none"></span><div class="grow"><div class="t">Empty workout</div><div class="s">Pick exercises as you go</div></div>${I.right}</button></div></div>`, {
    label: 'Start workout',
    mount: b => { b.onclick = ev => { const x = ev.target.closest('[data-st]'); if (!x) return; closeSheet(sh); startWorkout(x.dataset.st || null); }; },
  });
}
function openRotation() {
  let order = S.rotation.slice();
  const html = () => `<div class="stack"><div class="eyebrow">Rotation</div><p class="cap" style="margin:0">Today suggests the split after the last one you did, in this order.</p>
    <div class="list">${order.map((id, i) => { const sp = splitById(id); return sp ? `<div class="li"><span class="tag" style="width:8px;height:28px;border-radius:4px;background:${sp.color};flex:none"></span><div class="grow t">${i + 1}. ${esc(sp.name)}</div><button class="icon-btn" data-ro="up" data-i="${i}" aria-label="Move up">${I.up1}</button><button class="icon-btn" data-ro="dn" data-i="${i}" aria-label="Move down">${I.dn1}</button><button class="icon-btn" data-ro="rm" data-i="${i}" aria-label="Remove">${I.x}</button></div>` : ''; }).join('') || '<div class="empty">Add splits below.</div>'}</div>
    <div class="chips wrap" style="flex-wrap:wrap">${S.splits.filter(s => !s.archived).map(s => `<button class="chip" data-ro="add" data-id="${s.id}">+ ${esc(s.name)}</button>`).join('')}</div>
    <button class="btn primary block" data-ro="save">Save rotation</button></div>`;
  const sh = openSheet(html(), {
    label: 'Rotation',
    mount: b => {
      b.onclick = ev => {
        const x = ev.target.closest('[data-ro]'); if (!x) return; const i = +x.dataset.i;
        if (x.dataset.ro === 'save') { S.rotation = order; persist('jd/meta'); closeSheet(sh); rerender(); toast('Rotation saved'); return; }
        if (x.dataset.ro === 'add') order.push(x.dataset.id);
        if (x.dataset.ro === 'rm') order.splice(i, 1);
        if (x.dataset.ro === 'up' && i > 0) [order[i - 1], order[i]] = [order[i], order[i - 1]];
        if (x.dataset.ro === 'dn' && i < order.length - 1) [order[i + 1], order[i]] = [order[i], order[i + 1]];
        b.innerHTML = html();
      };
    },
  });
}
function exMenu(ei) {
  const e = A.ex[ei];
  const sh = openSheet(`<div class="stack"><div class="eyebrow">${esc(e.name)}</div>
    <button class="btn block" data-m="note">${e.note ? 'Edit note' : 'Add note'}</button>
    <div class="row"><button class="btn grow" data-m="up" ${ei === 0 ? 'disabled' : ''}>Move up</button><button class="btn grow" data-m="dn" ${ei === A.ex.length - 1 ? 'disabled' : ''}>Move down</button></div>
    <label class="row between card tight"><span>Rest after each set</span><span class="row" style="gap:6px"><input class="input sm num" style="width:70px;text-align:right" inputmode="numeric" id="em-rest" value="${e.rest}">s</span></label>
    <button class="btn block" data-m="swap">Swap exercise</button><button class="btn block" data-m="hist">See history</button>
    <button class="btn block danger" data-m="rm">Remove from this workout</button></div>`, {
    label: 'Exercise options',
    onClose: () => { },
    mount: b => {
      b.querySelector('#em-rest').onchange = ev => { const v = parseInt(ev.target.value, 10); if (v > 0) { e.rest = v; touchA(); } };
      b.onclick = ev => {
        const x = ev.target.closest('[data-m]'); if (!x) return; const m = x.dataset.m; closeSheet(sh);
        if (m === 'up') { [A.ex[ei - 1], A.ex[ei]] = [A.ex[ei], A.ex[ei - 1]]; touchA(); }
        if (m === 'dn') { [A.ex[ei + 1], A.ex[ei]] = [A.ex[ei], A.ex[ei + 1]]; touchA(); }
        if (m === 'rm') confirmSheet({ title: `Remove ${e.name}?`, body: 'Sets you logged for it in this workout are removed too.', ok: 'Remove', danger: true, onOk: () => { A.ex.splice(ei, 1); touchA(); } });
        if (m === 'swap') pickExercise(name => { A.ex[ei] = newExEntry(name, e.sets.length, e.rest); touchA(); }, { title: 'Swap ' + e.name });
        if (m === 'hist') { minimizeWk(); NAV.stack.push({ v: 'exercise', name: e.name }); render(); }
        if (m === 'note') { const s2 = openSheet(`<div class="stack"><div class="eyebrow">Note for ${esc(e.name)}</div><textarea class="input" id="en-t">${esc(e.note)}</textarea><button class="btn primary block" id="en-s">Save note</button></div>`, { mount: bb => { bb.querySelector('#en-s').onclick = () => { e.note = bb.querySelector('#en-t').value.trim(); closeSheet(s2); touchA(); }; } }); }
      };
    },
  });
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
  app.innerHTML = `<main id="screen" style="padding-bottom:calc(32px + env(safe-area-inset-bottom,0px))"><div class="stack" style="gap:16px;padding-top:24px">
    <div class="wordmark">Job<span>Done</span></div>
    <div><h1>Welcome back, ${esc(firstName())}</h1><p class="sec" style="margin:8px 0 0">Your profile and training log are ready to load. Check the guesses below, then import.</p></div>
    ${(() => { const w0 = SEED_WEIGHTS[0], t = SEED.today; if (!w0 || !t) return ''; const mo = daysBetween(w0[0], t[0]) / 30.44; return `<div class="card"><div class="eyebrow" style="margin-bottom:10px">Profile</div><div class="kpis"><div class="kpi"><b>${SEED.profile.heightCm || '—'} cm</b><span>height</span></div><div class="kpi"><b>${w0[1].toFixed(1)} → ${t[1].toFixed(1)}</b><span>kg since ${esc(fmtDate(w0[0]))}</span></div><div class="kpi"><b>${bwRaw((t[1] - w0[1]) / mo)}</b><span>kg per month</span></div></div><div class="cap" style="margin-top:10px">Monthly weights up to ${esc(fmtDate(SEED_WEIGHTS[SEED_WEIGHTS.length - 1][0]))} are marked as estimates (hollow dots) so you can correct them later. Today’s ${t[1].toFixed(1)} kg is logged as real.</div></div>`; })()}
    <div class="card"><div class="eyebrow" style="margin-bottom:10px">Training log</div><div class="kpis"><div class="kpi"><b>${wk}</b><span>workouts</span></div><div class="kpi"><b>${n0(sets)}</b><span>sets</span></div><div class="kpi"><b>${splitNames.length}</b><span>splits</span></div></div>
      <div class="cap" style="margin-top:10px">4 May to 13 Oct 2026, plus Legs on 23 May marked as skipped. Splits: ${esc(splitNames.join(', '))}. Each one uses the exercises from the last time you did it. Rotation starts as Push → Pull.</div></div>
    <div class="card stack"><div class="eyebrow">Check these guesses</div>
      <p class="cap" style="margin:0">Five dates were written twice, so each repeat moved to the next likely day. Change any that are wrong.</p>
      ${MOVED.map(m => { const i = findSeedIdx(m.d, m.s); if (i < 0) return ''; const cur = (welcomeOv[i] || {}).d || m.d; return `<label class="row between" style="gap:10px"><span class="grow" style="font-size:14px">${esc(m.label)}</span><input class="input sm" type="date" style="width:160px" id="mv-${i}" data-in="wlDate" data-i="${i}" value="${cur}"></label>`; }).join('')}
      ${(() => { const i = findSeedIdx(NONAME.d, NONAME.s); if (i < 0) return ''; const cur = (welcomeOv[i] || {}).s || NONAME.s; return `<label class="row between" style="gap:10px"><span class="grow" style="font-size:14px">${esc(fmtDate(NONAME.d))} had no split name. It matches</span><select class="input sm" style="width:160px" id="nn-${i}" data-in="wlSplit" data-i="${i}">${splitNames.map(s => `<option ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`; })()}
      <details><summary class="link">Other cleanup (${ASSUMPTIONS.length})</summary><ul class="assume">${ASSUMPTIONS.map(a => `<li>${esc(a)}</li>`).join('')}</ul><p class="cap">You can fix any single workout later from Progress → History → Edit.</p></details>
    </div>
    <button class="btn primary block" data-a="doImport" style="min-height:52px;font-size:16px">Import and open JobDone</button>
    <button class="link" data-a="skipImport" style="align-self:center">Start without my history</button>
  </div></main>`;
}
async function doImport(withHistory) {
  if (PUBLIC) { S = freshState(); S.imported = true; finishImport('Ready. Add a split to get started.'); return; }
  if (withHistory) S = buildFromSeed();
  else { S = buildFromSeed(); S.workouts = {}; }
  finishImport(withHistory ? `Imported ${Object.values(S.workouts).filter(w => !w.skipped).length} workouts` : 'Ready. Your splits are set up.');
}
function finishImport(msg) {
  invalidate();
  UI.lastPrompt = today();
  $('#app').innerHTML = '';
  persist(...allPaths());
  NAV = { tab: 'today', stack: [], prog: 'body', range: '6M' };
  render();
  toast(msg);
}
// Restore a JobDone JSON backup (Me → Export JSON) or start from a CSV log.
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
      if (!st) { toast('That file isn’t a JobDone backup. In the Claude version, use Me → Export JSON.', 4500); return; }
      what = 'Restored your backup';
    } else {
      const res = csvToWorkouts(txt); if (res.err) { toast(esc(res.err), 4500); return; }
      st = buildFromLog(logFromCsvList(res.list)); what = 'Imported your log';
    }
    const go = () => { const old = S ? allPaths() : []; S = st; invalidate(); if (DB) old.filter(p => !allPaths().includes(p)).forEach(p => dirty.add(p)); finishImport(`${what}: ${Object.values(S.workouts).filter(w => !w.skipped).length} workouts`); };
    if (replacing) confirmSheet({ title: 'Replace everything with this file?', body: 'Your current workouts, weights and splits are replaced by the ones in the file.', ok: 'Replace', danger: true, onOk: go }); else go();
  };
  rd.readAsText(file);
}
function renderWelcomePublic() {
  $('#app').innerHTML = `<main id="screen" style="padding-bottom:calc(32px + env(safe-area-inset-bottom,0px))"><div class="stack" style="gap:16px;padding-top:24px">
    <div class="wordmark">Job<span>Done</span></div>
    <div><h1>Welcome, ${esc(firstName())}</h1><p class="sec" style="margin:8px 0 0">Bring in your training log, or start fresh.</p></div>
    <div class="card stack"><div class="eyebrow">Restore a backup</div><p class="cap" style="margin:0">From the Claude version of JobDone: Me → Export JSON. This brings over your workouts, weights, steps and splits.</p>
      <label class="btn primary block" for="wl-file">Choose backup or CSV file</label><input type="file" id="wl-file" accept=".json,.csv,application/json,text/csv" data-in="wlFile" hidden>
      <p class="cap" style="margin:0">A CSV log works too (JobDone, Strong or Hevy). Splits are made from the last session of each one.</p></div>
    <button class="btn block" data-a="doImport">Start fresh</button>
  </div></main>`;
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
  const c = { date: col('date', 'start_time'), split: col('split', 'split_name', 'workout name', 'title'), ex: col('exercise', 'exercise name', 'exercise_title'), w: col('weight_kg', 'weight', 'weight (kg)'), r: col('reps'), note: col('notes', 'note', 'exercise_notes') };
  if (c.date < 0 || c.ex < 0) return { err: 'Couldn’t find date and exercise columns. Expected JobDone, Strong or Hevy CSV headers.' };
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
    const wt = parseFloat(r[c.w]), rp = parseInt(r[c.r], 10);
    e.sets.push({ w: isNaN(wt) ? null : wt, r: isNaN(rp) ? null : rp, t: 'work' });
    const nt = c.note >= 0 ? (r[c.note] || '').trim() : ''; if (nt && !e.note) e.note = nt;
  }
  return { list: Object.values(map) };
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
      ${dates.length ? `<div class="cap">${fmtDate(dates[0], { y: true })} to ${fmtDate(dates[dates.length - 1], { y: true })}. Weights are read as kg.</div>` : ''}
      ${unknown.length ? `<div class="note">New exercise names (added as custom): ${esc(unknown.join(', '))}</div>` : ''}
      <button class="btn primary block" id="ci-go" ${fresh.length ? '' : 'disabled'}>Import ${fresh.length} workouts</button><button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, {
      label: 'Import preview',
      mount: b => {
        b.querySelector('#ci-go').onclick = () => {
          const months = new Set();
          for (const w of fresh) { const id = 'csv-' + uid(); const sp = S.splits.find(s => s.name === w.splitName); S.workouts[id] = { id, date: w.date, splitId: sp ? sp.id : null, splitName: w.splitName, start: null, end: null, note: '', energy: null, src: 'import', skipped: w.skipped, ex: w.ex }; months.add(monthPath(w.date)); }
          for (const n of unknown) S.customEx.push({ name: n, muscle: 'Other', equip: 'other' });
          invalidate(); persist('jd/meta', ...months); closeSheet(sh); rerender(); toast(`Imported ${fresh.length} workouts`);
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
  const sh = openSheet(`<div class="stack"><div class="eyebrow">Export</div><p class="cap" style="margin:0">Saving files isn’t available here. Copy the text below instead.</p><textarea class="input num" style="min-height:240px;font-size:12px" readonly id="ex-t"></textarea><button class="btn primary block" id="ex-c">Copy</button></div>`, {
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
  tab: el => { NAV.tab = el.dataset.k; NAV.stack = []; render(); },
  back: () => back(),
  start: () => openStart(),
  resume: () => openWk(),
  weigh: () => openWeighIn(today()),
  weighDate: el => openWeighIn(el.dataset.d || null, false),
  weights: () => go({ v: 'weights' }),
  steps: () => openSteps(),
  syncKey: () => openSyncKey(),
  setPassword: () => openSetPassword(),
  prog: el => { NAV.tab = 'progress'; NAV.stack = []; NAV.prog = el.dataset.k; render(); },
  range: el => { NAV.range = el.dataset.k; rerender(); },
  startSplit: el => startWorkout(el.dataset.id),
  day: el => openDay(el.dataset.k),
  wkDay: () => openWkDay(),
  openSplit: el => go({ v: 'split', id: el.dataset.id }),
  editSplit: el => go({ v: 'splitEdit', id: el.dataset.id }),
  openEx: el => go({ v: 'exercise', name: el.dataset.name }),
  openWk: el => go({ v: 'workout', id: el.dataset.id }),
  exSel: el => { NAV.stack[NAV.stack.length - 1].sel = el.dataset.k; rerender(); },
  exMetric: el => { NAV.stack[NAV.stack.length - 1].metric = el.dataset.k; rerender(); },
  rotation: () => openRotation(),
  plates: () => openPlates(0, null),
  recap: () => showRecap(NAV.stack[NAV.stack.length - 1].id),
  exCat: el => openExForm(el.dataset.k),
  myEx: () => openMyExercises(),
  newSplit: () => { const id = 'sp-' + uid(); S.splits.push({ id, name: 'New split', color: PALETTE[S.splits.length % PALETTE.length], archived: false, ex: [] }); persist('jd/meta'); NAV.tab = 'splits'; NAV.stack = [{ v: 'split', id }, { v: 'splitEdit', id }]; render(); },
  spColor: el => { splitById(el.dataset.id).color = el.dataset.c; persist('jd/meta'); rerender(); },
  spMove: el => { const sp = splitById(el.dataset.id), i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= sp.ex.length) return; [sp.ex[i], sp.ex[j]] = [sp.ex[j], sp.ex[i]]; persist('jd/meta'); rerender(); },
  spRemove: el => { const sp = splitById(el.dataset.id); sp.ex.splice(+el.dataset.i, 1); persist('jd/meta'); rerender(); },
  spAdd: el => { const sp = splitById(el.dataset.id); pickExercise(name => { const l = lastSession(name); sp.ex.push({ name, sets: l ? Math.max(2, l.sets.length) : 3, repMin: 6, repMax: 10, rest: S.profile.defaultRest, note: '' }); persist('jd/meta'); rerender(); }); },
  spDup: el => { const sp = splitById(el.dataset.id); const id = 'sp-' + uid(); S.splits.push({ ...clone(sp), id, name: sp.name + ' copy', archived: false }); persist('jd/meta'); NAV.stack = [{ v: 'split', id }, { v: 'splitEdit', id }]; render(); toast('Split duplicated'); },
  spArchive: el => { const sp = splitById(el.dataset.id); sp.archived = !sp.archived; if (sp.archived) S.rotation = S.rotation.filter(x => x !== sp.id); persist('jd/meta'); NAV.stack = []; render(); toast(sp.archived ? sp.name + ' archived' : sp.name + ' restored'); },
  wkEdit: () => { const t = NAV.stack[NAV.stack.length - 1]; t.edit = !t.edit; rerender(); },
  wsDel: el => { const t = NAV.stack[NAV.stack.length - 1], w = S.workouts[t.id]; const e = w.ex[+el.dataset.e]; e.sets.splice(+el.dataset.s, 1); if (!e.sets.length) w.ex.splice(+el.dataset.e, 1); invalidate(); persist(monthPath(w.date)); rerender(); },
  wkDelete: () => { const t = NAV.stack[NAV.stack.length - 1], w = S.workouts[t.id]; confirmSheet({ title: 'Delete this workout?', body: `${esc(w.splitName)} on ${esc(fmtDate(w.date, { wd: true }))}. This can’t be undone.`, ok: 'Delete', danger: true, onOk: () => { delete S.workouts[w.id]; invalidate(); persist(monthPath(w.date)); back(); toast('Workout deleted'); } }); },
  unit: el => { S.profile.unit = el.dataset.k; persist('jd/meta'); rerender(); },
  theme: el => { S.profile.theme = el.dataset.k; applyTheme(el.dataset.k); persist('jd/meta'); rerender(); },
  export: el => doExport(el.dataset.k),
  reset: () => confirmSheet({ title: 'Erase everything?', body: 'Workouts, weights, steps and splits are deleted from your account and this device. Export first if you want a copy.', ok: 'Erase all data', danger: true, onOk: eraseAll }),
  signOut: () => confirmSheet({ title: 'Sign out?', body: 'Your data stays in your account. Sign in again to see it.', ok: 'Sign out', onOk: async () => { await flushNow(); try { localStorage.removeItem(LS_KEY); } catch (e) {} await SB.auth.signOut(); } }),
  doImport: () => doImport(true),
  skipImport: () => doImport(false),
  // workout
  minWk: () => minimizeWk(),
  finish: () => { A.view = 'summary'; touchA(); setTimeout(() => confetti(90), 250); },
  sumBack: () => { A.view = 'log'; touchA(); },
  saveWk: () => saveWorkout(),
  energy: el => { A.energy = +el.dataset.k; touchA(); },
  key: el => el.dataset.f === 'w' ? openSetPlates(+el.dataset.e, +el.dataset.s) : openKeypad(+el.dataset.e, +el.dataset.s, el.dataset.f),
  done: el => logSet(+el.dataset.e, +el.dataset.s),
  setType: el => { const s = A.ex[+el.dataset.e].sets[+el.dataset.s]; const o = ['work', 'warm', 'drop', 'fail']; s.t = o[(o.indexOf(s.t) + 1) % o.length]; touchA(); },
  addSet: el => { const e = A.ex[+el.dataset.e]; const p = e.sets[e.sets.length - 1]; e.sets.push({ w: p ? p.w : null, r: p ? p.r : null, t: 'work', done: false }); touchA(); },
  rmSet: el => { const e = A.ex[+el.dataset.e]; if (e.sets.length > 1) e.sets.pop(); touchA(); },
  exMenu: el => exMenu(+el.dataset.e),
  wkAddEx: () => pickExercise(name => { A.ex.push(newExEntry(name)); touchA(); const b = $('#wk .wk-body'); if (b) setTimeout(() => b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }), 50); }),
  wkDiscard: () => confirmSheet({ title: 'Discard this workout?', body: 'Nothing from it will be saved.', ok: 'Discard', danger: true, onOk: () => { A = null; REST = null; persist('jd/active'); if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } render(); } }),
  rest: el => { const d = +el.dataset.d; if (!REST) return; if (d === 0) REST = null; else { if (REST.paused) REST.left = Math.max(1, REST.left + d); else REST.end += d * 1000; REST.total = Math.max(REST.total + d, restLeft(), 1); } renderWorkout(); },
  restPause: () => { if (!REST) return; if (REST.paused) { REST.end = Date.now() + REST.left * 1000; REST.paused = false; } else { REST.left = restLeft(); REST.paused = true; } renderWorkout(); },
  restMin: () => { if (REST) { REST.min = true; renderWorkout(); } },
  restOpen: () => { if (REST) { REST.min = false; renderWorkout(); } },
  soundToggle: () => { S.profile.sound = S.profile.sound === false; persist('jd/meta'); rerender(); if (S.profile.sound) SOUNDS.nice(); },
};
document.addEventListener('click', ev => {
  if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  const el = ev.target.closest('[data-a]'); if (!el || el.disabled) return;
  const f = ACT[el.dataset.a]; if (f) { ev.preventDefault(); f(el, ev); }
});
const IN = {
  spName: (el, live) => { const sp = splitById(el.dataset.id); const v = el.value.trim(); if (!v) return; sp.name = v; Object.values(S.workouts).forEach(w => { if (w.splitId === sp.id) w.splitName = v; }); persist('jd/meta', ...(live ? [] : allPaths().filter(p => p.startsWith('months/')))); },
  spEx: el => { const sp = splitById(el.dataset.id), e = sp.ex[+el.dataset.i], f = el.dataset.f; if (f === 'note') e.note = el.value; else { const v = parseInt(el.value, 10); if (!isNaN(v) && v >= 0) e[f] = v; if (e.repMax < e.repMin) e.repMax = e.repMin; } persist('jd/meta'); },
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
function maybePrompt() {
  if (!S || !S.imported && !S.splits.length) return;
  const t = today();
  if (S.weights[t] || UI.lastPrompt === t || (A && A.open)) return;
  UI.lastPrompt = t; lsSave();
  setTimeout(() => openWeighIn(t, true), 500);
}
// ---------- hosted: Supabase accounts ----------
function firstName() {
  const m = USER && USER.user_metadata || {};
  const n = (m.full_name || m.name || '').trim().split(/\s+/)[0];
  return n || 'Job';
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
  $('#wk').hidden = true;
  const make = stage === 'create';
  $('#app').innerHTML = `<main id="screen" style="padding-bottom:32px"><div class="stack" style="gap:18px;padding-top:40px;max-width:420px;margin:0 auto">
    <div class="wordmark">Job<span>Done</span></div>
    <div><h1>${make ? 'Create account' : 'Sign in'}</h1><p class="sec" style="margin:8px 0 0">Your workouts, weights and splits are saved to your account, so they’re on every device you sign in on.</p></div>
    <div class="field"><label for="si-email">Email</label><input class="input" id="si-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="${esc(email)}"></div>
    <div class="field"><label for="si-pw">Password</label><input class="input" id="si-pw" type="password" autocomplete="${make ? 'new-password' : 'current-password'}" placeholder="${make ? 'At least 6 characters' : ''}"></div>
    <button class="btn primary block" id="si-go">${make ? 'Create account' : 'Sign in'}</button>
    <div class="row between"><button class="link" id="si-switch">${make ? 'I have an account' : 'Create account'}</button>${make ? '' : '<button class="link" id="si-forgot">Forgot password?</button>'}</div>
    <div class="cap" id="si-msg" role="alert" style="min-height:18px;color:var(--neg)">${esc(msg)}</div>
  </div></main>`;
  const m = (t, ok) => { const e = $('#si-msg'); e.textContent = t; e.style.color = ok ? 'var(--text2)' : 'var(--neg)'; };
  const emailOk = () => { const em = $('#si-email').value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { m('Enter your email address.'); return null; } return em; };
  const go = async () => {
    const em = emailOk(); if (!em) return;
    const pw = $('#si-pw').value; if (pw.length < 6) { m('Passwords are at least 6 characters.'); return; }
    const b = $('#si-go'); b.disabled = true; b.textContent = make ? 'Creating…' : 'Signing in…';
    const { data, error } = make ? await SB.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + location.pathname } }) : await SB.auth.signInWithPassword({ email: em, password: pw });
    if (error) {
      b.disabled = false; b.textContent = make ? 'Create account' : 'Sign in';
      return m(/invalid login/i.test(error.message) ? 'Wrong email or password. If you used to sign in with a code, tap Forgot password? to set one.' : /not confirmed/i.test(error.message) ? 'Confirm your email first: open the link Supabase emailed you, then sign in here.' : /rate/i.test(error.message) ? 'Too many tries. Wait a minute, then try again.' : error.message);
    }
    if (make && !data.session) { b.textContent = 'Create account'; b.disabled = false; m('Almost done: open the confirmation email, tap its link, then sign in here.', true); }
  };
  $('#si-go').onclick = go;
  for (const id of ['#si-email', '#si-pw']) $(id).onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#si-switch').onclick = () => renderSignIn(make ? 'start' : 'create', $('#si-email').value.trim());
  if (!make) $('#si-forgot').onclick = async () => {
    const em = emailOk(); if (!em) return;
    const { error } = await SB.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    m(error ? (/rate/i.test(error.message) ? 'Too many emails sent. Wait a while, then try again.' : error.message) : 'Check your email and tap the link. It opens JobDone, where you set a new password.', !error);
  };
}
function openSetPassword(title = 'Set a password') {
  openSheet(`<div class="stack"><div class="eyebrow">${esc(title)}</div>
    <p class="sec" style="margin:0;font-size:14px">Use this with your email to sign in on any device.</p>
    <div class="field"><label for="pw-new">New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password" placeholder="At least 6 characters"></div>
    <button class="btn primary block" id="pw-save">Save password</button><div class="cap" id="pw-msg" style="color:var(--neg)"></div>
    <button class="btn ghost block" data-a="closeSheet">Cancel</button></div>`, { label: title, mount: el => {
    el.querySelector('#pw-save').onclick = async ev => {
      const pw = el.querySelector('#pw-new').value; if (pw.length < 6) { el.querySelector('#pw-msg').textContent = 'At least 6 characters.'; return; }
      ev.currentTarget.disabled = true;
      const { error } = await SB.auth.updateUser({ password: pw });
      if (error) { ev.currentTarget.disabled = false; el.querySelector('#pw-msg').textContent = error.message; return; }
      closeSheet(); toast('Password saved');
    };
  } });
}
async function startHosted() {
  SB = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  SB.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_IN' && session && (!USER || USER.id !== session.user.id)) { USER = session.user; openData(); }
    if (ev === 'PASSWORD_RECOVERY') setTimeout(() => openSetPassword('Set a new password'), 600);
    if (ev === 'SIGNED_OUT') { USER = null; openedFor = null; DB = null; mode = 'local'; renderSignIn(); }
  });
  const { data } = await SB.auth.getSession();
  if (data && data.session) { USER = data.session.user; await openData(); }
  else if (!USER) renderSignIn();
}
let openedFor = null;
async function openData() {
  if (openedFor === USER.id) return; openedFor = USER.id;
  LS_KEY = 'jobdone.v1:' + USER.id;
  const cached = lsLoad();
  ready = false; S = null; A = null; invalidate();
  if (cached && cached.S) { S = cached.S; A = cached.A || null; UI = cached.UI || UI; ready = true; $('#app').innerHTML = ''; render(); maybePrompt(); }
  else $('#app').innerHTML = skeleton();
  await connect(supaDB());
}
async function connect(db) {
  if (!db) { mode = 'local'; if (!ready) { ready = true; S = null; renderWelcome(); } else rerender(); return; }
  DB = db; mode = 'cloud';
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
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    $('#app').innerHTML = `<div class="splash"><div class="wordmark">Job<span>Done</span></div></div>`;
    try { await startHosted(); } catch (e) { renderSignIn('start', '', 'Couldn’t reach the sign-in service. Check your connection and reload.'); }
    return;
  }
  if (CFG && !HOSTED && location.protocol !== 'file:') {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const cached = lsLoad();
  if (cached && cached.S) { S = cached.S; A = cached.A || null; UI = cached.UI || UI; ready = true; render(); maybePrompt(); }
  else $('#app').innerHTML = skeleton();
  let db = null;
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
  try { DL = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { DL = null; }
  await connect(db);
}
boot();
