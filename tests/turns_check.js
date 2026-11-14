// Self-check (v181): taking turns in a party. Run: node tests/turns_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const code = pick('const curLift =', 'let TURN_WAS');
const run = (A, friends) => new Function('A', 'USER', 'FRIENDS', 'baseName', 'liveOf', 'lvParty', code + '; return turnState();')(
  A, { id: 'me' }, friends, n => n, f => f && f.lv, l => l.party);
const sets = (done, total) => Array.from({ length: total }, (_, i) => ({ done: i < done, r: 10 }));
const me = (done, total = 3, lift = 'Leg Press', extra = {}) => ({ turns: true, partyHost: 'me', party: [{ id: 'mk', n: 'Mikey' }, { id: 'sam', n: 'Sam' }], ex: [{ name: lift, sets: sets(done, total) }], ...extra });
const fr = (id, c, t = 3, cur = 'Leg Press', tt = 1) => ({ id, lv: { party: ['me'], tt, cur, c, t } });

let ts = run(me(0), [fr('mk', 0)]); assert.ok(ts.mine, 'host goes first');
ts = run(me(1), [fr('mk', 0)]); assert.strictEqual(ts.now.n, 'Mikey', 'then Mikey');
ts = run(me(1), [fr('mk', 0)]); assert.strictEqual(ts.next.id, 'me', 'you are next');
// 1. Mikey forgets to tick: still his turn; Skip on this phone moves it on
ts = run(me(1, 3, 'Leg Press', { turnSkip: { cur: 'Leg Press', k: { mk: 1 } } }), [fr('mk', 0)]); assert.ok(ts.mine, 'skip gives you the turn');
ts = run(me(1, 3, 'Leg Press', { turnSkip: { cur: 'Chest Fly', k: { mk: 1 } } }), [fr('mk', 0)]); assert.strictEqual(ts.now.n, 'Mikey', 'a skip on another lift does not count');
// 2. Turns off for Mikey: you're on your own
ts = run(me(1), [fr('mk', 0, 3, 'Leg Press', 0)]); assert.ok(ts.waiting, 'friend with turns off does not count');
// 3. Different lifts: no turns
ts = run(me(1), [fr('mk', 0, 3, 'Chest Fly')]); assert.ok(ts.waiting, 'different lift means no turns');
// 4. Different set counts: whoever has finished drops out
ts = run(me(3, 4), [fr('mk', 3, 3)]); assert.ok(ts.mine, 'Mikey finished his 3, you do your 4th');
// 7. Three people go in order: host, then the others
ts = run(me(1), [fr('mk', 1), fr('sam', 0)]); assert.strictEqual(ts.now.n, 'Sam', 'Sam is behind, so it is Sam');
ts = run(me(1), [fr('mk', 0), fr('sam', 0)]); assert.strictEqual(ts.now.n, 'Mikey', 'ties go in order');
assert.strictEqual(ts.next.n, 'Sam', 'next: Sam');
// 8. Undo: one set fewer and the turn comes back
ts = run(me(0), [fr('mk', 0)]); assert.ok(ts.mine, 'after an undo it is yours again');
// 9. Mikey leaves (no live stat): you're on your own
ts = run(me(1), []); assert.ok(ts.waiting, 'someone who left drops out');
// warm-ups don't count
const w = me(0); w.ex[0].sets.unshift({ done: true, t: 'warm', r: 10 }); ts = run(w, [fr('mk', 0)]); assert.ok(ts.mine, 'warm-ups are not turns');
console.log('turns check: ok');
