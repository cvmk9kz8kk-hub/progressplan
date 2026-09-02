// Service Worker — Offline-Betrieb & Installation
const CACHE = 'cutplan-v7-7';
const ASSETS = [
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Lebensmittel-Suche: immer live, nie aus dem Cache
  if (url.includes('openfoodfacts.org')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"products":[]}', {headers:{'Content-Type':'application/json'}})));
    return;
  }

  // Die App-Seite selbst (index.html / Navigation): NETWORK-FIRST.
  // So kommt jede neue Version sofort an, sobald Internet da ist —
  // ohne dass ein Cache-Name manuell hochgezählt werden muss.
  // Nur ohne Internetverbindung greift der zuletzt gespeicherte Stand.
  if (e.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Statische Assets (Icons, manifest, Chart.js): CACHE-FIRST — ändern sich selten,
  // schnell und funktioniert offline.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
