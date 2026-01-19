const CACHE_NAME = 'linkkiste-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install SW
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate SW
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch events
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') return;

  // Don't cache Supabase API calls aggressively to ensure data freshness
  if (event.request.url.includes('supabase.co')) {
      return;
  }
  
  // Don't cache extension popup requests (timestamped)
  if (event.request.url.includes('mode=popup') || event.request.url.includes('&t=')) {
      return; // Go straight to network
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cache hit or fetch network
        return response || fetch(event.request).then((response) => {
             // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
        });
      })
  );
});