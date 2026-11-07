// Self-check: the owner-only lift renames run without errors. Run: node tests/rename_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const baseName = n => n.replace(/ \((Left|Right)\)$/, '');
const { renameLifts } = new Function('baseName', src.slice(src.indexOf('const RENAMED'), src.indexOf('// ---------- derived index')) + '; return { renameLifts };')(baseName);
const st = o => ({ profile: { owner: o }, workouts: { a: { ex: [{ name: 'Tricep Vulken' }] } }, splits: [], customEx: [], setup: {} });
const own = st(true); assert.strictEqual(renameLifts(own, null), true); assert.strictEqual(own.workouts.a.ex[0].name, 'Tricep Pushdown', 'owner gets the rename');
const other = st(false); assert.strictEqual(renameLifts(other, null), false); assert.strictEqual(other.workouts.a.ex[0].name, 'Tricep Vulken', 'other accounts are left alone');
console.log('lift renames: all checks passed');
