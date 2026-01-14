const CACHE_NAME = 'flux-core';
const ASSETS = [
    './', 
    './index.html', 
    './offline.html',
    './app.js', 
    './manifest.json',
    './style.css',
    './js/whiteboard.js',
    // Caching External Libraries for Offline Use
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    // Fonts (Optional but good for Katex)
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/KaTeX_Main-Regular.woff2',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/KaTeX_Math-Italic.woff2'
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
    // Only handle GET requests
    if (evt.request.method !== 'GET') return;

    evt.respondWith(
        caches.match(evt.request).then(cachedResponse => {
            // Fetch from network to update cache in background
            const fetchPromise = fetch(evt.request).then(networkResponse => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // For external assets (opaque/cors), we might still want to cache them if the type is 'cors' or 'opaque'
                    // But standard 'basic' check is safer for local files.
                    // However, we want to update the cache for whatever we fetched if possible.
                }
                
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(evt.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // Network failed
            });

            // Return cached response if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        }).catch(() => {
            // Fallback for navigation (HTML)
            if (evt.request.mode === 'navigate') {
                return caches.match('./offline.html');
            }
        })
    );
});