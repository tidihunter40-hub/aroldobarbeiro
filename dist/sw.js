const CACHE_PREFIX = 'aroldo-barber-';
const CACHE_NAME = `${CACHE_PREFIX}v54`;
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
  './cortes-catalogo.css',
  './site-structure.css',
  './app-navigation.css',
  './cut-categories.css',
  './service-step.css',
  './protese.css',
  './services-prices.css',
  './script.js',
  './protese.js',
  './services-prices.js',
  './booking-experience.js',
  './cortes-catalogo.js',
  './cortes-catalogo.json',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/concept-corte.jpg',
  './assets/concept-barba.jpg',
  './assets/concept-platinado.jpg',
  './assets/concept-ambiente.jpg',
  './assets/concept-escola.jpg',
  './assets/concept-protese.jpg',
  './assets/concept-visagismo.jpg',
  './assets/aroldo-hero-fachada.png',
  './assets/aroldo-mobile-referencia.png',
  './assets/aroldo-logo-fachada.png',
  './assets/aroldo-logo-oficial.png',
  './assets/servicos-precos-referencia.png',
  './assets/categories/masculinos.webp',
  './assets/categories/infantis.webp',
  './assets/categories/barbas.webp',
  './assets/cortes/masculinos/mullet.webp',
  './assets/cortes/masculinos/moicano.webp',
  './assets/cortes/masculinos/taper-fade.webp',
  './assets/cortes/masculinos/militar.webp',
  './assets/cortes/masculinos/high-fade.webp',
  './assets/cortes/masculinos/tradicional.webp',
  './assets/cortes/masculinos/taper-fade-moderno.webp',
  './assets/cortes/masculinos/afro-com-nudred.webp',
  './assets/cortes/masculinos/social-classico.webp',
  './assets/cortes/masculinos/mid-fade.webp',
  './assets/cortes/masculinos/razor-part.webp',
  './assets/cortes/masculinos/low-fade.webp',
  './assets/cortes/masculinos/faux-hawx.webp',
  './assets/cortes/masculinos/buzz-cut.webp',
  './assets/cortes/masculinos/short-fringe.webp',
  './assets/cortes/masculinos/undercut.webp',
  './assets/cortes/masculinos/old-money.webp',
  './assets/cortes/masculinos/pompadour.webp',
  './assets/cortes/infantis/taper-fade-cacheado.webp',
  './assets/cortes/infantis/side-part.webp',
  './assets/cortes/infantis/razor-partiu.webp',
  './assets/cortes/infantis/classico-na-tesoura.webp',
  './assets/cortes/infantis/tigelinha.webp',
  './assets/cortes/barbas/barba-lenhador.webp',
  './assets/cortes/barbas/barba-social.webp',
  './assets/cortes/barbas/barba-cavanhaque.webp',
  './assets/cortes/barbas/barba-espartana.webp',
  './assets/cortes/barbas/barba-italiana.webp',
  './assets/cortes/tratamentos/barbaterapia-vapor-ozonio.svg',
  './assets/aroldo-oculos-recorte.png',
  './assets/corte-kids-instagram.jpg',
  './assets/corte-classico-instagram.jpg',
  './assets/corte-perfil-instagram.jpg',
  './assets/protese-instagram.jpg',
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
