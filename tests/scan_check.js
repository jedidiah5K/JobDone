// Self-check (v187): the in-app QR scanner reads a friend code from our link or a bare code, and ignores other QRs.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const line = src.split('\n').find(l => l.startsWith('const scanCode'));
const scanCode = new Function(line + '; return scanCode;')();
assert.strictEqual(scanCode('https://jobdone-peach.vercel.app/?add=CEN6JB'), 'CEN6JB');
assert.strictEqual(scanCode('JD-CEN6JB'), 'JD-CEN6JB');
assert.strictEqual(scanCode('https://example.com/menu'), null);
assert.strictEqual(scanCode('https://evil.test/?add=<script>'), null);
assert.strictEqual(scanCode('hello world'), null);
console.log('scan check: ok');
