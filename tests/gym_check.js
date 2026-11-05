// Self-check for the My Gym workout builder. Run: node tests/gym_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const code = src.slice(src.indexOf('// gym-builder:start'), src.indexOf('// gym-builder:end'));
const { gymBuild, gymLifts, gymUsable } = new Function(code + '; return { gymBuild, gymLifts, gymUsable };')();

const types = [
  { key: 'pec_dec', lifts: ['Chest Fly', 'Reverse Pec Deck'] },
  { key: 'cable_stack', lifts: ['Cable Crossover', 'Tricep Pushdown', 'Lateral Raise'] },
  { key: 'leg_press', lifts: ['Leg Press', 'Leg Press Calf Raise'] },
  { key: 'hack_squat', lifts: ['Hack Squat'] },
  { key: 'incline_press_machine', lifts: ['Incline Press'] },
];
const row = (type_key, here, nots, my_vote) => ({ type_key, here, nots, my_vote });

// Who counts: 2 people, or you; voted out never counts.
assert(gymUsable(row('x', 2, 0, null)));
assert(gymUsable(row('x', 1, 0, 1)));
assert(!gymUsable(row('x', 1, 0, null)), 'one other person is not enough');
assert(!gymUsable(row('x', 2, 3, null)), 'more "not here" than "here" hides it');
assert(!gymUsable(row('x', 5, 0, -1)), 'you said it is not here');

const rows = [row('pec_dec', 2, 0, null), row('cable_stack', 1, 0, 1), row('leg_press', 3, 0, 1), row('hack_squat', 2, 0, null), row('incline_press_machine', 1, 0, null)];
const have = gymLifts(rows, types);
assert(have.has('Chest Fly') && have.has('Tricep Pushdown') && !have.has('Incline Press'), 'waiting machine (1 other person) is left out');

const never = () => '';
let r = gymBuild({ focus: 'upper', have, last: never });
assert.deepStrictEqual(r.list.map(i => i.lift), ['Chest Fly', 'Lateral Raise', 'Tricep Pushdown']);
assert(r.missing.includes('Incline press') && r.missing.includes('Shoulder press') && r.missing.includes('Preacher curl'));

// Main lift first whenever the gym has it (Job: pec dec before cable crossover), whatever was done lately; swap moves on.
const dates = { 'Leg Press': '2026-11-01', 'Hack Squat': '2026-10-20' };
r = gymBuild({ focus: 'lower', have, last: n => dates[n] || '' });
assert.strictEqual(r.list.find(i => i.k === 'squat').lift, 'Leg Press', 'main lift wins');
r = gymBuild({ focus: 'lower', have, last: n => dates[n] || '', swap: { squat: 1 } });
assert.strictEqual(r.list.find(i => i.k === 'squat').lift, 'Hack Squat');
assert.strictEqual(gymBuild({ focus: 'upper', have, last: never }).list[0].lift, 'Chest Fly', 'pec dec, not cable crossover');
assert.strictEqual(r.list.find(i => i.k === 'calf').lift, 'Leg Press Calf Raise');

// Extras: up to 2 per muscle, never a lift already in the session.
r = gymBuild({ focus: 'upper', have, last: never, extras: ['Chest'], extra: () => ['Chest Fly', 'Cable Crossover', 'Push-Up'] });
const ex = r.list.filter(i => i.extra).map(i => i.lift);
assert.deepStrictEqual(ex, ['Cable Crossover', 'Push-Up']);
assert.strictEqual(new Set(r.list.map(i => i.lift)).size, r.list.length, 'no lift twice');

// Everything = upper + lower.
assert.strictEqual(gymBuild({ focus: 'all', have, last: never }).list.length, 5); // 3 upper + squat + calf
console.log('gym builder: all checks passed');

// Machine taken: same movement first, never the busy machine or its other lifts, only what the gym has.
const { gymTaken } = new Function(code + '; return { gymTaken };')();
const t2 = [...types, { key: 'smith', lifts: ['Smith Incline Press'] }, { key: 'dumbbells', lifts: ['Incline Dumbbell Press', 'Lateral Raise'] }];
const r2 = [row('pec_dec', 2, 0, null), row('cable_stack', 2, 0, null), row('dumbbells', 2, 0, null), row('smith', 2, 0, null)];
let tk = gymTaken('Chest Fly', r2, t2, ['Cable Crossover', 'Reverse Pec Deck', 'Incline Dumbbell Press']);
assert.strictEqual(tk[0], 'Cable Crossover', 'same movement first');
assert(!tk.includes('Reverse Pec Deck'), 'the busy pec dec is left out');
assert(tk.includes('Incline Dumbbell Press'), 'same muscle on free weights is offered');
tk = gymTaken('Lateral Raise', r2, t2, []);
assert(!tk.includes('Lateral Raise'));
assert.deepStrictEqual(gymTaken('Chest Fly', [row('pec_dec', 2, 0, null)], t2, ['Cable Crossover']), [], 'nothing else at the gym');
console.log('machine taken: all checks passed');
