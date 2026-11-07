// Self-check: targets and set messages follow the plan's rep range. Run: node tests/reprange_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const mk = new Function('S', 'A', 'splitById', 'OB_EXP', 'U', 'LB', 'themeMsg', 'pick',
  pick('function repRange', 'function newExEntry') + pick('function setVerdict', '// One line under') + '; return { repRange, targetOf, setVerdict };');
const sp = { id: 's1', ex: [{ name: 'Chest Fly', repMin: 8, repMax: 12 }] };
const run = (profile, A = { splitId: 's1' }) => mk({ profile }, A, () => sp, { new: ['', '', 8, 12] }, () => 'kg', 2.2046, () => ({ low: ['l'], nice: ['n'], great: ['g'], amazing: ['a'] }), a => a[0]);

let f = run({});
assert.deepStrictEqual(f.repRange('Chest Fly'), [8, 12], 'uses the plan range for the lift');
assert.deepStrictEqual(f.repRange('Leg Press'), [6, 9], 'a lift not in the plan falls back to 6 to 9');
assert.deepStrictEqual(f.targetOf({ w: 40, r: 12 }, f.repRange('Chest Fly')), { w: 42.5, r: 8, up: true }, '40x12 on 8-12 aims for 42.5x8, not 42.5x6');
assert.deepStrictEqual(f.targetOf({ w: 40, r: 10 }, f.repRange('Chest Fly')), { w: 40, r: 11 }, 'under the top: same weight, one more rep');
assert.strictEqual(f.setVerdict(7, [8, 12]).sub, 'Below your rep range.', 'one rep under the range is below it');
assert.strictEqual(f.setVerdict(8, [8, 12]).sub, 'Right in the range.');
assert.strictEqual(f.setVerdict(12, [8, 12]).sub, 'Top of your range.');
assert.strictEqual(f.setVerdict(5, [5, 5]).sub, 'Top of your range.', '5x5 plans');
assert.deepStrictEqual(run({ repRange: [10, 15] }).repRange('Chest Fly'), [10, 15], 'a range set in Me wins');
assert.deepStrictEqual(run({ exp: 'new' }, null).repRange('Chest Fly'), [8, 12], 'no workout: experience range');
assert.deepStrictEqual(run({}).repRange('Chest Fly', null), [6, 9], 'no split and no experience: 6 to 9');
console.log('Rep range: all checks passed');
