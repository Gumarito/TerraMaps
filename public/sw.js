/**
 * TerraMaps - PWA Offline Service Worker
 * 
 * Implementa caché de shell de la aplicación, interceptor de estilos MapLibre,
 * y almacenamiento en caché de teselas cartográficas para funcionamiento offline completo.
 */

const CACHE_NAME = 'terramaps-cache-v1';
const TILE_CACHE_NAME = 'terramaps-tiles-v1';

const STATIC_PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
];

// Instalación: Precarga de shell de la app y librerías clave
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets and MapLibre engine');
      return cache.addAll(STATIC_PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Some precache assets failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activación: Purga de cachés obsoletas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TILE_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptor de peticiones HTTP
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Supabase API & Auth: Siempre a la red (sin caché para evitar credenciales rancias)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // 2. MapLibre GL JS / CSS (unpkg CDN): Estrategia Cache-First
  if (url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => {
          return new Response('/* MapLibre offline fallback */', {
            headers: { 'Content-Type': 'text/javascript' }
          });
        });
      })
    );
    return;
  }

  // 3. Carto Basemaps (Teselas y estilos): Cache-First con Network Fallback
  if (url.hostname.includes('cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((tileCache) => {
        return tileCache.match(event.request).then((cachedTile) => {
          if (cachedTile) return cachedTile;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              tileCache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Si está offline y no hay tesela, retornar 204 No Content para evitar romper el render
            return new Response(null, { status: 204 });
          });
        });
      })
    );
    return;
  }

  // 4. Navegación (HTML / Single Page App): Network-first con fallback a index.html en caché
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 5. Recursos estáticos propios de Expo/Metro (_expo/static, bundle JS, assets): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
