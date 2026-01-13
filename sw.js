const CACHE_NAME = 'flux-core-v2';
const ASSETS = [
    './', 
    './index.html', 
    './offline.html',
    './app.js', 
    './manifest.json',
    './style.css',
    './js/whiteboard.js',
    './js/pdf-viewer.js'
];
// Installazione: Cache degli asset statici fondamentali
self.addEventListener('install', evt => {
    evt.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Flux SW: Caching assets');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});
// Attivazione: Pulizia vecchie cache
self.addEventListener('activate', evt => {
    evt.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME)
                .map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});
// Fetch: Strategia Stale-While-Revalidate
self.addEventListener('fetch', evt => {
    if (evt.request.method !== 'GET') return;

    evt.respondWith(
        caches.match(evt.request).then(cachedResponse => {
            const fetchPromise = fetch(evt.request).then(networkResponse => {
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(evt.request, networkResponse.clone());
                 });
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        }).catch(() => {
            if (evt.request.mode === 'navigate') {
                return caches.match('./offline.html');
            }
        })
    );
});