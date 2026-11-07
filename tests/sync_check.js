// Self-check for data that must never be lost. Run: node tests/sync_check.js
// 1. A cloud load keeps changes that haven't reached the account yet (offline sets, a workout finished with no signal).
// 2. CSV export then import gives back the same sets (warm-ups stay warm-ups).
// 3. A JSON backup keeps setup notes and measurements, and a broken file can't blank the app.
// 4. The double-tap guard doesn't compare DOM nodes (a re-render replaces them).
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(process.env.APP_JS || __dirname + '/../app.js', 'utf8');
const pick = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert(i >= 0 && j > i, 'missing ' + a); return src.slice(i, j); };
const mem = {}; const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const env = new Function('localStorage', 'navigator', 'addEventListener', 'document', `
  const clone = o => JSON.parse(JSON.stringify(o)), sleep = () => Promise.resolve(), toast = () => {}, renameLifts = () => false, invalidate = () => {}, DEMO = false, UI = {};
  let S = null, A = null, DB = null, IX = null, syncState = 'ok', LS_KEY = 'jobdone.v1';
  const freshState = () => ({ v: 1, profile: {}, splits: [], rotation: [], customEx: [], setup: {}, weights: {}, steps: {}, workouts: {}, imported: true, created: 1 });
  ${pick('// ---------- storage ----------', '// Lifts that were renamed')}
  return { set: (s, a, db) => { S = s; A = a; DB = db; }, get: () => ({ S, A }), persist, pend, loadCloud, dirty, inflight };`)(localStorage, { onLine: true }, () => {}, { addEventListener: () => {} });

(async () => {
  // Cloud has last week's workout; this phone also finished today's with no signal (still pending).
  const cloud = { 'jd/meta': { v: 1, profile: {}, splits: [], rotation: [] }, 'months/2026-11': { w: { old: { id: 'old', date: '2026-11-01', ex: [] } } }, 'jd/active': { a: { id: 'stale', touched: 1, ex: [] }, t: 1 } };
  const db = { doc: p => ({ get: async () => ({ exists: p in cloud, data: () => cloud[p] }), set: async () => { throw Object.assign(new Error('offline'), { code: 'unavailable' }); }, delete: async () => {} }),
    collection: c => ({ get: async () => ({ docs: Object.keys(cloud).filter(k => k.startsWith(c + '/')).map(k => ({ data: () => cloud[k] })) }) }) };
  const local = { v: 1, profile: {}, splits: [], rotation: [], customEx: [], setup: {}, weights: {}, steps: {}, imported: true, created: 1,
    workouts: { old: { id: 'old', date: '2026-11-01', ex: [] }, today: { id: 'today', date: '2026-11-07', ex: [{ name: 'Leg Press', sets: [{ w: 100, r: 8 }] }] } } };
  env.set(local, null, null); env.persist('months/2026-11', 'jd/active'); env.set(local, null, db);
  env.dirty.clear();
  await env.loadCloud();
  const { S, A } = env.get();
  assert(S.workouts.today, 'a workout finished offline survives a cloud load');
  assert.strictEqual(A, null, 'a finished workout is not brought back from the stale cloud copy');

  // CSV round trip
  const csv = new Function('S', 'LB', 'ymd', 'sortW', pick('function parseCSV', 'function importCSVFile') + pick('function exportCSV', 'async function doExport') + '; return { exportCSV, csvToWorkouts };');
  const w = { id: 'a', date: '2026-11-05', splitName: 'Legs', ex: [{ name: 'Leg Press', note: '', sets: [{ w: 40, r: 12, t: 'warm' }, { w: 100, r: 8, t: 'work' }, { w: 80, r: 10, t: 'drop' }] }] };
  const f = csv({ workouts: { a: w } }, 2.20462, d => d.toISOString().slice(0, 10), () => 0);
  assert.deepStrictEqual(f.csvToWorkouts(f.exportCSV()).list[0].ex[0].sets.map(s => s.t), ['warm', 'work', 'drop'], 'set types survive CSV export and import');

  // "Replace everything" with a CSV keeps set types and the file's own split order (no Push/Pull forced on an Upper/Lower log)
  const bl = new Function('freshState', 'SPLIT_COLORS', 'PALETTE', pick('function buildFromLog', 'function renderWelcome') + pick('function logFromCsvList', 'function restoreFile') + '; return { buildFromLog, logFromCsvList };')(() => ({ profile: {}, splits: [], rotation: [], workouts: {} }), {}, ['#111']);
  const ul = f.csvToWorkouts('date,split,exercise,weight_kg,reps,set_type\n2026-11-03,Upper,Lat Pulldown,40,12,warmup\n2026-11-03,Upper,Lat Pulldown,60,8,\n2026-11-04,Lower,Leg Press,100,8,\n').list;
  const ulSt = bl.buildFromLog(bl.logFromCsvList(ul), true);
  assert.deepStrictEqual(ulSt.splits.map(s => s.name), ['Upper', 'Lower'], 'a CSV keeps its own split order');
  assert.strictEqual(ulSt.rotation.length, 2, 'a CSV of Upper/Lower gets a rotation');
  assert.deepStrictEqual(Object.values(ulSt.workouts)[0].ex[0].sets.map(s => s.t), ['warm', 'work'], 'replacing from a CSV keeps warm-ups');

  // JSON backup
  const sfb = new Function('freshState', 'S', pick('function stateFromBackup', 'function logFromCsvList') + '; return stateFromBackup;')(() => ({ profile: {}, splits: [], rotation: [], customEx: [], setup: {}, weights: {}, steps: {}, workouts: {} }), null);
  const st = sfb({ workouts: {}, setup: { 'Leg Press': 'seat 5' }, meas: { '2026-11-01': { waist: 80 } } });
  assert.deepStrictEqual([st.setup, st.meas], [{ 'Leg Press': 'seat 5' }, { '2026-11-01': { waist: 80 } }], 'setup notes and measurements are restored');
  const bad = sfb({ workouts: { x: { date: '2024-01-04', exercises: [] } } });
  assert(!bad || !Object.keys(bad.workouts).length, 'a workout with no ex list is never restored (it blanks Today)');
  assert.strictEqual(sfb({ workouts: {}, weights: [1, 2] }), null, 'a backup with the wrong shape is refused');
  assert(!sfb({ workouts: {}, profile: { owner: true } }).profile.owner, 'a restored backup never turns on owner-only extras');

  // double-tap guard
  assert(!/el === tapEl/.test(src), 'the double-tap guard must not compare DOM nodes: renderWorkout replaces the button between taps');
  console.log('sync and data: all checks passed');
})().catch(e => { console.error(e.message); process.exit(1); });
