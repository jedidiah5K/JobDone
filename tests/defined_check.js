// Fails if app.js calls a function that isn't defined anywhere (6 Nov: a patch deleted frStrip/restDayLine and Today crashed).
// Rough but cheap: every bare `name(` call must match a function, const/let/var, parameter-ish name, or a browser global.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8').replace(/\/\/[^\n]*/g, '');
const defined = new Set();
for (const re of [/function\s+([A-Za-z_$][\w$]*)/g, /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, /(?:const|let|var)\s*\{([^}]*)\}/g, /([A-Za-z_$][\w$]*)\s*=>/g, /\(([^()]*)\)\s*=>/g, /function\s*[\w$]*\s*\(([^)]*)\)/g, /,\s*([A-Za-z_$][\w$]*)\s*=\s*/g, /catch\s*\(\s*([\w$]+)/g])
  for (const m of src.matchAll(re)) for (const n of m[1].split(/[,\s=]+/)) if (/^[A-Za-z_$][\w$]*$/.test(n)) defined.add(n);
const globals = new Set('if for while switch return typeof catch function require setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame fetch parseInt parseFloat isNaN isFinite Number String Boolean Array Object Math Date JSON Promise Map Set WeakMap RegExp Error Symbol encodeURIComponent decodeURIComponent atob btoa alert confirm prompt matchMedia getComputedStyle structuredClone queueMicrotask addEventListener removeEventListener Image File Blob URL URLSearchParams FormData Intl TextEncoder TextDecoder Uint8Array Notification AbortController ResizeObserver IntersectionObserver MutationObserver CustomEvent Event navigator super scrollTo DOMParser escape unescape import iP not bezier async createImageBitmap var something gradient Archived Shortcut Strength Weight felt iPhone backup spreadsheet unlock silentMode DataView ArrayBuffer Audio bell notch calc env repeat Path2D FontFace week plate estimates cleanup FileReader weight Height off blocked way'.split(' '));
const bad = new Set();
for (const m of src.matchAll(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)\s*\(/g)) { const n = m[2]; if (!defined.has(n) && !globals.has(n)) bad.add(n); }
if (bad.size) { console.error('undefined calls: ' + [...bad].join(', ')); process.exit(1); }
console.log('defined check: all calls resolve');
