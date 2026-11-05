// Self-check for the ID card picture. Run: node tests/idcard_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const { idSVG, idAutoLevel, ID_LEVELS } = new Function(src.slice(src.indexOf('// idcard:start'), src.indexOf('// idcard:end')) + '; return { idSVG, idAutoLevel, ID_LEVELS };')();

// Level the app picks: time training or workouts, never weights.
assert.strictEqual(idAutoLevel(0, 10), 0);
assert.strictEqual(idAutoLevel(1, 0), 1);
assert.strictEqual(idAutoLevel(0, 300), 2);

const card = { n: 'Leigh', t: 'spidey', lv: 1, yr: '2 years', since: 'Oct 2026', wk: 6, prs: [['Chest Fly', 60, 8]], sp: 'Push / Pull / Legs · 4 days a week', gym: 'Anytime Fitness · IT Park' };
const svg = idSVG(card, '7K4Q9X');
assert(svg.includes('ROOFTOP RUNNER') && svg.includes('JD-7K4Q9X') && svg.includes('60 kg × 8'), 'level, code and lift show');
assert(idSVG(card, 'X', 'lb').includes('132.3 lb × 8'), 'friends see their own unit');

// A friend's card is someone else's data: nothing in it can break out of the picture.
const bad = idSVG({ n: '<script>alert(1)</script>', t: 'nope', lv: 'x', wk: '1e9<', prs: [['"><img onerror=x>', 'a', '<b>']], sp: '&', gym: "'" }, '<x>');
assert(!/<script|<img|<b>|onerror="/.test(bad), 'all text is escaped');
assert(bad.includes('AGENT DOSSIER'), 'unknown theme falls back to Agent');
assert(!/NaN|undefined/.test(bad), 'odd numbers never print NaN');
for (const t of Object.keys(ID_LEVELS)) assert(idSVG({ t }, '').startsWith('<svg'), t);
console.log('id card: all checks passed');
