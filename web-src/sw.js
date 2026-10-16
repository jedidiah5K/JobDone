// Offline support: the app shell is cached; pages load from the network first so updates arrive.
const CACHE = 'jobdone-v25';
// Pages come from the network so updates arrive, but a slow gym signal falls back to the saved copy after 2.5 s.
function pageFirst(e) {
  const net = fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; });
  const saved = () => caches.match(e.request).then(r => r || caches.match('index.html'));
  e.waitUntil(net.catch(() => {}));
  return new Promise(res => {
    let done = false; const t = setTimeout(() => saved().then(r => { if (r && !done) { done = true; res(r); } }), 2500);
    net.then(r => { if (!done) { done = true; clearTimeout(t); res(r); } }, () => saved().then(r => { if (!done) { done = true; clearTimeout(t); res(r || Response.error()); } }));
  });
}
const SHELL = ['./', 'index.html', 'config.js', 'vendor/supabase.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'ex/index.json', 'ex/body.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // never cache account or database calls
  const isPage = e.request.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname.endsWith('config.js');
  e.respondWith(isPage
    ? pageFirst(e)
    : caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return res; })));
});

// Rest-done notifications: the server pushes when a rest timer ends.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Rest done', { body: d.body || 'Time for your next set.', tag: d.tag || 'rest', renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => 'focus' in x); return c ? c.focus() : self.clients.openWindow('./'); }));
});
