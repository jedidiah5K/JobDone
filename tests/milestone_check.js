// Self-check: big moments fire on workout 1, 10, 50… and on each year since the first workout. Run: node tests/milestone_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const mk = ws => new Function('ix', 'fmtDate', pick('const MILES =', '// Draw the recap') + '; return milestoneOf;')(() => ({ ws }), d => d);
const days = (n, from = '2025-01-01') => Array.from({ length: n }, (_, i) => ({ date: new Date(Date.parse(from) + i * 864e5).toISOString().slice(0, 10) }));

let ws = days(1); assert.strictEqual(mk(ws)(ws[0])[0], 'First workout logged');
ws = days(10); assert.strictEqual(mk(ws)(ws[9])[0], '10 workouts');
ws = days(11); assert.strictEqual(mk(ws)(ws[10]), null, 'no moment on 11');
ws = days(10).concat({ date: '2025-02-01', skipped: true }); assert.strictEqual(mk(ws)(ws[9])[0], '10 workouts', 'skipped days do not count');
ws = [{ date: '2025-01-01' }, { date: '2025-06-01' }, { date: '2026-01-03' }];
assert.strictEqual(mk(ws)(ws[2])[0], 'One year of training');
ws.push({ date: '2026-01-05' }); assert.strictEqual(mk(ws)(ws[3]), null, 'the year moment shows once');
console.log('milestone check: ok');
