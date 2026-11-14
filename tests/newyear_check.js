// Self-check (v191): which year Wrapped shows, and Quitter's Day (second Friday of January).
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const ln = p => src.split('\n').find(l => l.startsWith(p));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const wrapYear = new Function('today', ln('const wrapYear') + '; return wrapYear;')(() => '2026-11-14');
const quitDay = new Function('parseYmd', 'addDays', ln('const quitDay') + '; return quitDay;')(parseYmd, addDays);
assert.strictEqual(wrapYear('2026-12-27'), '2026'); assert.strictEqual(wrapYear('2027-01-05'), '2026'); assert.strictEqual(wrapYear('2027-03-01'), '2027');
assert.strictEqual(quitDay('2027'), '2027-01-08'); assert.strictEqual(quitDay('2026'), '2026-01-09'); assert.strictEqual(quitDay('2028'), '2028-01-14');
console.log('new year check: ok');
