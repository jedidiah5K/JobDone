// Self-check for the ID card pictures. Run: node tests/idcard_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const { idFront, idBack, idAutoLevel, idPhotoOk, ID_LEVELS } = new Function(src.slice(src.indexOf('// idcard:start'), src.indexOf('// idcard:end')) + '; return { idFront, idBack, idAutoLevel, idPhotoOk, ID_LEVELS };')();

// Level the app picks: time training or workouts, never weights.
assert.strictEqual(idAutoLevel(0, 10), 0);
assert.strictEqual(idAutoLevel(1, 0), 1);
assert.strictEqual(idAutoLevel(0, 300), 2);

const card = { n: 'Leigh', t: 'spidey', lv: 1, yr: '2 years', since: 'Oct 2026', wk: 6, prs: [['Chest Fly', 60, 8, 1], ['Bench Press', 100, 1, 0]], sp: 'PPL · 4 days a week', gym: 'Anytime Fitness · IT Park', bw: 78.6, ht: 178 };
const f = idFront(card, '7K4Q9X'), b = idBack(card, '7K4Q9X');
assert(f.includes('ROOFTOP RUNNER') && f.includes('JD-7K4Q9X') && f.includes('2 years'), 'front: level, code, stats');
assert(b.includes('60 kg × 8') && b.includes('78.6 kg · 178 cm') && b.includes('HOME GYM'), 'back: lifts, body, gym');
assert((b.match(/✓/g) || []).length === 2, 'one ✓ on the logged lift plus the key line, none on the typed-in one');
assert(idBack(card, 'X', 'lb').includes('132.3 lb × 8'), 'friends see their own unit');

// Photos: only small JPEG data URLs ever go in; anything else falls back to the silhouette.
const jpg = 'data:image/jpeg;base64,' + 'A'.repeat(100);
assert(idPhotoOk(jpg) && idFront(card, 'X', 'kg', jpg).includes('<image href="data:image/jpeg'));
for (const bad of ['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,AA"/><script>', 'https://evil.example/x.jpg', 'data:image/jpeg;base64,' + 'A'.repeat(90000)]) {
  assert(!idPhotoOk(bad)); assert(!idFront(card, 'X', 'kg', bad).includes('<image'), bad.slice(0, 30));
}

// A friend's card is someone else's data: nothing in it can break out of the picture.
const evil = { n: '<script>alert(1)</script>', t: 'nope', lv: 'x', wk: '1e9<', prs: [['"><img onerror=x>', 'a', '<b>', 1]], sp: '&', gym: "'" };
const both = idFront(evil, '<x>') + idBack(evil, '<x>');
assert(!/<script|<img|<b>|onerror="/.test(both), 'all text is escaped');
assert(both.includes('AGENT DOSSIER'), 'unknown theme falls back to Agent');
assert(!/NaN|undefined/.test(both), 'odd numbers never print NaN');

// People choose what shows: hidden pieces leave nothing behind.
const bare = idFront({ n: 'Sam', t: 'climb' }, 'ABCDEF') + idBack({ n: 'Sam', t: 'climb' }, 'ABCDEF');
assert(!/TOP LIFTS|SPLIT|BODY|training|workouts|member since|CRAZY|Beginner/.test(bare), 'nothing hidden leaks onto the card');
for (const t of Object.keys(ID_LEVELS)) assert(idFront({ t }, '').startsWith('<svg') && idBack({ t }, '').startsWith('<svg'), t);
assert(idFront({ t: 'mono' }, 'JEDIDIAH').includes('>JEDIDIAH<') && !idFront({ t: 'mono' }, 'JEDIDIAH').includes('JD-JEDIDIAH'), 'custom code shows on its own');
// People choose the side for lifts, split, gym and body; level, training, workouts and member since stay on the front.
const moved = { ...card, pl: { prs: 'f', lv: 'b', sp: 'b', gym: 'b', bw: 'f', ht: 'f', yr: 'b', wk: 'b', since: 'b' } };
const mf = idFront(moved, 'X'), mb = idBack(moved, 'X');
assert(mf.includes('TOP LIFT') && mf.includes('78.6 kg · 178 cm'), 'front follows the choice');
assert(mf.includes('ROOFTOP') && mf.includes('2 years') && mf.includes('member since'), 'the fixed four stay on the front, even if a card says otherwise');
assert(mb.includes('SPLIT') && !mb.includes('TOP LIFTS') && !mb.includes('LEVEL'), 'back follows the choice');
// The newer lines: streak, favourite, lifetime, PRs, this month, badges, motto.
const extra = { t: 'climb', st: 5, fav: 'Chest Fly', life: 1234567, prc: 42, mon: 6, bdg: ['w50', 's12', '<script>'], motto: '<b>Earn it</b>',
  pl: { st: 'f', fav: 'b', life: 'b', prc: 'b', mon: 'b', bdg: 'b', motto: 'b' } };
const ef = idFront(extra, 'X'), eb = idBack(extra, 'X'), elb = idBack(extra, 'X', 'lb');
assert(ef.includes('5 weeks') && eb.includes('1.2M kg') && eb.includes('42') && eb.includes('6 workouts') && (eb.match(/<circle/g) || []).length >= 4 && !eb.includes('<script>'), 'new lines show; badges are icons, junk keys are ignored');
assert(elb.includes('2.7M lb'), 'lifetime in the viewer’s unit');
assert(eb.includes('&lt;b&gt;Earn it&lt;/b&gt;') && !eb.includes('<b>'), 'motto is escaped');
const full = { ...extra, prs: [['A', 1, 1, 1]], gym: 'G', sp: 'S', pl: { ...extra.pl, prs: 'b', gym: 'b', sp: 'b' } };
assert((idBack(full, 'X').match(/font-size="15" font-weight="800"/g) || []).length === 4, 'under the lifts the back holds 4');
const longM = idFront({ t: 'spidey', motto: 'Not a God, Just a guy who lifts a lot', sp: 'A', gym: 'B', pl: { motto: 'f', sp: 'f', gym: 'f' } }, 'X');
assert(longM.includes('“Not a God, Just a guy') && longM.includes('who lifts a lot”'), 'a long motto wraps onto a second line, nothing cut');
assert(!idFront({ t: 'mono' }, false).includes('JD-'), 'friend code can be left off');
console.log('id card: all checks passed');
