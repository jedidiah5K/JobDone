// Self-check for typo-friendly search. Run: node tests/fuzzy_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const { fuzzy } = new Function(src.slice(src.indexOf('// fuzzy:start'), src.indexOf('// fuzzy:end')) + '; return { fuzzy };')();
const fly = 'Chest Fly pec dec pec deck butterfly machine fly Chest', press = 'Chest Press Chest', curl = 'Preacher Curl Biceps';
assert(fuzzy(fly, 'chest pic dkecasdl') > fuzzy(press, 'chest pic dkecasdl'), 'pec dec beats other chest lifts');
assert(fuzzy(fly, 'pek dek') > 0 && fuzzy(fly, 'buterfly') > 0);
assert(fuzzy(curl, 'precher curl') > 0 && fuzzy(curl, 'preach') > 0, 'typo and word start');
assert.strictEqual(fuzzy(curl, 'chest pic'), 0, 'unrelated words never match');
assert.strictEqual(fuzzy(fly, 'zzzz qqqq'), 0, 'junk alone matches nothing');
console.log('fuzzy search: all checks passed');
