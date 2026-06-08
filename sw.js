/* СтройСмета — Service Worker (относительные пути, для GitHub Pages и корня).
 * HTML: network-first. Статика: cache-first. CDN: stale-while-revalidate.
 * Firebase и прокси Claude: НЕ кэшируются (живые данные). Не-GET: пропускаем.
 */
const VERSION = 'v2.0.0';
const APP_CACHE = `stroismeta-app-${VERSION}`;
const CDN_CACHE = `stroismeta-cdn-${VERSION}`;

const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

const NO_CACHE = [
  'workers.dev', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com',
  'firestore.googleapis.com', 'firebaseinstallations.googleapis.com',
  'firebase.googleapis.com', 'google.com/recaptcha', 'gstatic.com/recaptcha'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const full = url.host + url.pathname;
  if (NO_CACHE.some((h) => url.host.includes(h) || full.includes(h))) return;

  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isNav) {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(APP_CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return r;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((r) => {
        if (r && r.status === 200) { const copy = r.clone(); caches.open(APP_CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return r;
      }))
    );
    return;
  }

  e.respondWith(
    caches.open(CDN_CACHE).then((cache) => cache.match(req).then((cached) => {
      const net = fetch(req).then((r) => {
        if (r && (r.status === 200 || r.type === 'opaque')) cache.put(req, r.clone()).catch(() => {});
        return r;
      }).catch(() => cached);
      return cached || net;
    }))
  );
});
