const CACHE_PREFIX = 'aroldo-barber-';
const CACHE_NAME = `${CACHE_PREFIX}v16`;
const APP_SHELL = './index.html';
const PRECACHE = [
  './',
  APP_SHELL,
  './styles.css',
  './refinement.css',
  './hero.css',
  './booking.css',
  './booking-reference.css',
  './responsive.css',
  './script.js',
  './booking-experience.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/concept-corte.jpg',
  './assets/concept-ambiente.jpg',
  './assets/concept-escola.jpg',
  './assets/concept-protese.jpg',
  './assets/concept-visagismo.jpg',
  './assets/aroldo-hero-fornecida.png',
  './assets/aroldo-oculos-recorte.png',
  './assets/corte-kids-instagram.jpg',
  './assets/corte-perfil-instagram.jpg',
  './assets/desondulacao-instagram.jpg',
  './assets/destaque-artistas-01.jpg',
  './assets/destaque-artistas-02.jpg',
  './assets/destaque-barbas-01.jpg',
  './assets/destaque-barbas-02.jpg',
  './assets/destaque-desenhos-01.jpg',
  './assets/destaque-desenhos-02.jpg',
  './assets/destaque-kids-02.jpg',
  './assets/destaque-nevou-01.jpg',
  './assets/destaque-nevou-02.jpg',
  './assets/destaque-premiacoes-01.jpg',
  './assets/destaque-premiacoes-02.jpg',
  './assets/espaco-instagram.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/admin.html') || url.pathname.endsWith('/admin.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(APP_SHELL));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
