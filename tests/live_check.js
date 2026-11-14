// Self-check (v180): the minute refresh uses the photo-free call, keeps photos, reloads fully when friends change,
// goes to 15 s in a party and sends a "still here" stat after 5 quiet minutes. Run: node tests/live_check.js
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const body = pick('let INBOX_ON = false', 'const inboxStart');
const mk = new Function('env', `
  let { HOSTED, USER, FRIENDS, REQS, GAME_ON } = env; const document = { hidden: false };
  const calls = [], timers = [], sent = [];
  const gymRpc = async n => { calls.push(n); return env.rows[n]; };
  const setTimeout = (f, ms) => { timers.push(ms); return 1; }, clearTimeout = () => {};
  const toast = () => {}, rerender = () => {}, esc = x => x, statSync = () => sent.push(1);
  const partyIds = () => env.party, liveOf = () => null, lvParty = () => [], A = null, turnWatch = () => {};
  ${body}
  return { poll: inboxPoll, st: () => ({ FRIENDS, calls, timers, sent, FR_FULL_AT }), set: v => { FR_FULL_AT = v.full ?? FR_FULL_AT; STAT_AT = v.statAt ?? STAT_AT; } };`);
const full = [{ id: 'a', photo: 'P', card: { n: 'Mikey' }, stat: { k: 1 } }];
const env = { HOSTED: true, USER: { id: 'me' }, FRIENDS: null, REQS: [], GAME_ON: true, party: [], rows: { jobdone_friends_list: full, jobdone_friend_requests: [], jobdone_friends_live: [{ id: 'a', stat: { k: 2 } }] } };
(async () => {
  const t = mk(env);
  await t.poll(); let s = t.st();
  assert.strictEqual(s.calls[0], 'jobdone_friends_list', 'first load is the full list');
  assert.strictEqual(s.timers.pop(), 60000, 'one minute when not in a party');
  await t.poll(); s = t.st();
  assert.strictEqual(s.calls[2], 'jobdone_friends_live', 'then the light call');
  assert.deepStrictEqual([s.FRIENDS[0].photo, s.FRIENDS[0].stat.k, s.FRIENDS[0].card.n], ['P', 2, 'Mikey'], 'keeps photo and card, takes new stat');
  env.rows.jobdone_friends_live = [{ id: 'a' }, { id: 'b' }]; await t.poll(); s = t.st();
  assert.strictEqual(s.FR_FULL_AT, 0, 'new friend triggers a full reload'); assert.strictEqual(s.timers.pop(), 1000, 'right away');
  assert.ok(s.FRIENDS.every(x => x.id !== 'b'), 'new friend waits for the full list');
  env.party = ['a']; t.set({ statAt: Date.now() - 6 * 6e4 }); await t.poll(); s = t.st();
  assert.strictEqual(s.calls[s.calls.length - 2], 'jobdone_friends_list', 'full reload happened');
  assert.strictEqual(s.timers.pop(), 15000, '15 s in a party'); assert.strictEqual(s.sent.length, 1, 'still-here stat sent after 5 quiet minutes');
  console.log('live check: ok');
})().catch(e => { console.error(e); process.exit(1); });
