/**
 * Stellaris Builder - Image Cache Service Worker
 * Intercepts image and asset requests, caching them in the browser's CacheStorage
 * for instant offline and repeat access (Cache-First strategy).
 */

const CACHE_NAME = 'stellaris-images-v1';

// Supported image extensions & destinations
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|webp|svg|gif|ico)(\?.*)?$/i;

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for old clients to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name.startsWith('stellaris-images-') && name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Check if this request is for an image or asset
  const isImageRequest =
    request.destination === 'image' ||
    IMAGE_EXTENSIONS.test(url.pathname) ||
    url.pathname.includes('/assets/');

  if (!isImageRequest) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Try to serve from cache first
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Not in cache -> fetch from network and store in cache
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          // Clone the response because the stream can only be consumed once
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Network error and not in cache
        console.warn('[Service Worker] Failed to fetch image:', request.url, error);
        throw error;
      }
    })
  );
});

// Support manual cache management messages from the Angular client
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'CLEAR_IMAGE_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  } else if (event.data.type === 'PRECACHE_URLS' && Array.isArray(event.data.urls)) {
    caches.open(CACHE_NAME).then((cache) => {
      event.data.urls.forEach((url) => {
        fetch(url)
          .then((response) => {
            if (response.ok) {
              cache.put(url, response);
            }
          })
          .catch(() => {});
      });
    });
  }
});
