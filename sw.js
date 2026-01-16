const CACHE_NAME = 'flux-core';
const ASSETS = [
    './', 
    './index.html', 
    './offline.html',
    './app.js', 
    './manifest.json',
    './style.css',
    './js/whiteboard.js',
    './lib/katex/katex.min.css',
    './lib/katex/katex.min.js',
    './lib/marked/marked.min.js',
    './lib/pdfjs/pdf.min.js',
    './lib/pdfjs/pdf.worker.min.js',
    './lib/jszip/jszip.min.js',
    
    // Fonts
    './lib/katex/fonts/KaTeX_AMS-Regular.ttf',
    './lib/katex/fonts/KaTeX_AMS-Regular.woff',
    './lib/katex/fonts/KaTeX_AMS-Regular.woff2',
    './lib/katex/fonts/KaTeX_Caligraphic-Bold.ttf',
    './lib/katex/fonts/KaTeX_Caligraphic-Bold.woff',
    './lib/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
    './lib/katex/fonts/KaTeX_Caligraphic-Regular.ttf',
    './lib/katex/fonts/KaTeX_Caligraphic-Regular.woff',
    './lib/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
    './lib/katex/fonts/KaTeX_Fraktur-Bold.ttf',
    './lib/katex/fonts/KaTeX_Fraktur-Bold.woff',
    './lib/katex/fonts/KaTeX_Fraktur-Bold.woff2',
    './lib/katex/fonts/KaTeX_Fraktur-Regular.ttf',
    './lib/katex/fonts/KaTeX_Fraktur-Regular.woff',
    './lib/katex/fonts/KaTeX_Fraktur-Regular.woff2',
    './lib/katex/fonts/KaTeX_Main-Bold.ttf',
    './lib/katex/fonts/KaTeX_Main-Bold.woff',
    './lib/katex/fonts/KaTeX_Main-Bold.woff2',
    './lib/katex/fonts/KaTeX_Main-BoldItalic.ttf',
    './lib/katex/fonts/KaTeX_Main-BoldItalic.woff',
    './lib/katex/fonts/KaTeX_Main-BoldItalic.woff2',
    './lib/katex/fonts/KaTeX_Main-Italic.ttf',
    './lib/katex/fonts/KaTeX_Main-Italic.woff',
    './lib/katex/fonts/KaTeX_Main-Italic.woff2',
    './lib/katex/fonts/KaTeX_Main-Regular.ttf',
    './lib/katex/fonts/KaTeX_Main-Regular.woff',
    './lib/katex/fonts/KaTeX_Main-Regular.woff2',
    './lib/katex/fonts/KaTeX_Math-BoldItalic.ttf',
    './lib/katex/fonts/KaTeX_Math-BoldItalic.woff',
    './lib/katex/fonts/KaTeX_Math-BoldItalic.woff2',
    './lib/katex/fonts/KaTeX_Math-Italic.ttf',
    './lib/katex/fonts/KaTeX_Math-Italic.woff',
    './lib/katex/fonts/KaTeX_Math-Italic.woff2',
    './lib/katex/fonts/KaTeX_SansSerif-Bold.ttf',
    './lib/katex/fonts/KaTeX_SansSerif-Bold.woff',
    './lib/katex/fonts/KaTeX_SansSerif-Bold.woff2',
    './lib/katex/fonts/KaTeX_SansSerif-Italic.ttf',
    './lib/katex/fonts/KaTeX_SansSerif-Italic.woff',
    './lib/katex/fonts/KaTeX_SansSerif-Italic.woff2',
    './lib/katex/fonts/KaTeX_SansSerif-Regular.ttf',
    './lib/katex/fonts/KaTeX_SansSerif-Regular.woff',
    './lib/katex/fonts/KaTeX_SansSerif-Regular.woff2',
    './lib/katex/fonts/KaTeX_Script-Regular.ttf',
    './lib/katex/fonts/KaTeX_Script-Regular.woff',
    './lib/katex/fonts/KaTeX_Script-Regular.woff2',
    './lib/katex/fonts/KaTeX_Size1-Regular.ttf',
    './lib/katex/fonts/KaTeX_Size1-Regular.woff',
    './lib/katex/fonts/KaTeX_Size1-Regular.woff2',
    './lib/katex/fonts/KaTeX_Size2-Regular.ttf',
    './lib/katex/fonts/KaTeX_Size2-Regular.woff',
    './lib/katex/fonts/KaTeX_Size2-Regular.woff2',
    './lib/katex/fonts/KaTeX_Size3-Regular.ttf',
    './lib/katex/fonts/KaTeX_Size3-Regular.woff',
    './lib/katex/fonts/KaTeX_Size3-Regular.woff2',
    './lib/katex/fonts/KaTeX_Size4-Regular.ttf',
    './lib/katex/fonts/KaTeX_Size4-Regular.woff',
    './lib/katex/fonts/KaTeX_Size4-Regular.woff2',
    './lib/katex/fonts/KaTeX_Typewriter-Regular.ttf',
    './lib/katex/fonts/KaTeX_Typewriter-Regular.woff',
    './lib/katex/fonts/KaTeX_Typewriter-Regular.woff2'
];

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

// Fetch: Strategy Stale-While-Revalidate
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