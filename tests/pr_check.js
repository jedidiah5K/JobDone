// Self-check for PR rules. Run: node tests/pr_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const { emptyBest, prTypes, applyBest } = new Function(
  src.match(/^const e1 = .*$/m)[0] + '\n' + src.match(/^const validSet = .*$/m)[0] + '\n' + pick('// pr:start', '// pr:end') + '; return { emptyBest, prTypes, applyBest };')();
const best = (...sets) => { const b = emptyBest(); sets.forEach(([w, r]) => { applyBest({ w, r }, b); b.n++; }); return b; };
const pr = (b, w, r) => prTypes({ w, r }, b);
assert.deepStrictEqual(pr(best([65, 10]), 67.5, 6), [], 'heavier with fewer reps and a lower e1RM is not a PR');
assert.deepStrictEqual(pr(best([65, 10]), 70, 10), ['Heaviest', 'e1RM'], 'heavier at the same reps is');
assert.deepStrictEqual(pr(best([65, 10]), 67.5, 9), ['e1RM'], 'a better estimated max still counts');
assert.deepStrictEqual(pr(best([65, 8]), 65, 9), ['e1RM', 'Reps'], 'more reps at the same weight');
assert.deepStrictEqual(pr(emptyBest(), 100, 5), [], 'first time doing a lift is not a PR');
assert.deepStrictEqual(prTypes({ w: 200, r: 5, t: 'warm' }, best([65, 10])), [], 'warm-ups never count');
console.log('PR rules: all checks passed');
