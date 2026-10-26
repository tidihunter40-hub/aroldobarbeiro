const whatsappNumber = '5511948446801';
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
function closeMenu(returnFocus = false) {
  if (menuButton.getAttribute('aria-expanded') !== 'true') return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Abrir menu');
  nav.classList.remove('open');
  document.querySelector('.site-header').classList.remove('menu-open');
  document.body.classList.remove('menu-open');
  document.querySelector('main').inert = false;
  document.querySelector('footer').inert = false;
  if (returnFocus) menuButton.focus({ preventScroll: true });
}
menuButton.addEventListener('click', () => {
  const opening = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(opening));
  menuButton.setAttribute('aria-label', opening ? 'Fechar menu' : 'Abrir menu');
  nav.classList.toggle('open', opening);
  document.querySelector('.site-header').classList.toggle('menu-open', opening);
  document.body.classList.toggle('menu-open', opening);
  document.querySelector('main').inert = opening;
  document.querySelector('footer').inert = opening;
  if (opening) nav.querySelector('a')?.focus({ preventScroll: true });
});
nav.addEventListener('click', event => { if (event.target === nav) closeMenu(true); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
window.addEventListener('resize', () => { if (window.innerWidth > 1000) closeMenu(); });

const siteHeader = document.querySelector('.site-header');
const screens = new Map([
  ['/', document.getElementById('inicio')],
  ['/agendamento', document.getElementById('agendar')],
  ['/cortes', document.getElementById('cortes')],
  ['/galeria', document.getElementById('galeria')],
  ['/contato', document.getElementById('contato')]
]);
const legacyRoutes = { '#inicio': '/', '#agendar': '/agendamento', '#cortes': '/cortes', '#galeria': '/galeria', '#contato': '/contato' };
const routeLinks = [...document.querySelectorAll('a[href^="/"]')].filter(link => screens.has(link.getAttribute('href')));
const routeTitles = { '/': 'Início', '/agendamento': 'Agendamento', '/cortes': 'Cortes', '/galeria': 'Galeria', '/contato': 'Contato' };
function showRoute(path, { push = false, focus = false } = {}) {
  const route = screens.has(path) ? path : '/';
  if (push && location.pathname !== route) history.pushState({ route }, '', route);
  closeMenu();
  screens.forEach((section, key) => { section.hidden = key !== route; });
  document.querySelector('footer').hidden = route !== '/contato';
  routeLinks.forEach(link => {
    if (link.getAttribute('href') === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${routeTitles[route]} — Aroldo Barber`;
  document.body.dataset.route = route === '/' ? 'inicio' : route.slice(1);
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) {
    const heading = screens.get(route).querySelector('h1,h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  }
  return route;
}
window.aroldoNavigate = (path, options) => showRoute(path, { push: true, focus: true, ...options });
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !screens.has(url.pathname)) return;
  event.preventDefault();
  showRoute(url.pathname, { push: true, focus: true });
});
window.addEventListener('popstate', () => showRoute(location.pathname));
if (legacyRoutes[location.hash]) history.replaceState(null, '', legacyRoutes[location.hash]);
showRoute(location.pathname);
function updateHeaderState() {
  const isScrolled = window.scrollY > 24;
  siteHeader.classList.toggle('is-scrolled', isScrolled);
}
window.addEventListener('scroll', updateHeaderState, { passive: true });
window.addEventListener('resize', updateHeaderState);
updateHeaderState();

const workUrl = {
  perfil: 'https://www.instagram.com/aroldobarbeirooficial/',
  kids: 'https://www.instagram.com/stories/highlights/17998904341653498/',
  beards: 'https://www.instagram.com/stories/highlights/17962977680653535/',
  nevou: 'https://www.instagram.com/stories/highlights/17966296571269322/',
  drawings: 'https://www.instagram.com/stories/highlights/17956278125249781/',
  artists: 'https://www.instagram.com/stories/highlights/17912568753117277/',
  awards: 'https://www.instagram.com/stories/highlights/17969838071171142/'
};
const galleryItems = {
  cortes: [
    {src:'./assets/corte-perfil-instagram.jpg',alt:'Corte masculino publicado no perfil oficial',caption:'Corte masculino',url:workUrl.perfil},
    {src:'./assets/corte-kids-instagram.jpg',alt:'Corte infantil publicado no perfil oficial',caption:'Corte infantil',url:workUrl.kids},
    {src:'./assets/destaque-kids-02.jpg',alt:'Outro corte infantil publicado no destaque oficial',caption:'Corte infantil',url:workUrl.kids}
  ],
  visagismo: [],
  proteses: [],
  barbas: [
    {src:'./assets/destaque-barbas-01.jpg',alt:'Acabamento de barba publicado no destaque oficial',caption:'Acabamento de barba',url:workUrl.beards},
    {src:'./assets/destaque-barbas-02.jpg',alt:'Barba publicada no destaque oficial',caption:'Barba',url:workUrl.beards}
  ],
  outros: [
    {src:'./assets/destaque-nevou-01.jpg',alt:'Platinado publicado no destaque oficial',caption:'Platinado',url:workUrl.nevou},
    {src:'./assets/destaque-nevou-02.jpg',alt:'Descoloração publicada no destaque oficial',caption:'Descoloração',url:workUrl.nevou},
    {src:'./assets/destaque-desenhos-01.jpg',alt:'Desenho no cabelo publicado no destaque oficial',caption:'Desenho no cabelo',url:workUrl.drawings},
    {src:'./assets/destaque-desenhos-02.jpg',alt:'Outro desenho publicado no destaque oficial',caption:'Desenho no cabelo',url:workUrl.drawings},
    {src:'./assets/destaque-artistas-01.jpg',alt:'Encontro publicado no destaque oficial',caption:'Encontro e bastidores',url:workUrl.artists},
    {src:'./assets/destaque-artistas-02.jpg',alt:'Bastidores publicados no destaque oficial',caption:'Bastidores',url:workUrl.artists},
    {src:'./assets/destaque-premiacoes-01.jpg',alt:'Certificado publicado no destaque oficial',caption:'Certificado',url:workUrl.awards},
    {src:'./assets/destaque-premiacoes-02.jpg',alt:'Registro com troféus publicado no destaque oficial',caption:'Reconhecimento',url:workUrl.awards},
    {src:'./assets/espaco-instagram.jpg',alt:'Barbearia em registro do perfil oficial',caption:'Espaço da barbearia',url:workUrl.perfil}
  ]
};

let currentItems = [];
let currentIndex = 0;
const dialog = document.getElementById('gallery-dialog');
function showImage(index) {
  currentIndex = (index + currentItems.length) % currentItems.length;
  const item = currentItems[currentIndex];
  document.getElementById('lightbox-image').src = item.src;
  document.getElementById('lightbox-image').alt = item.alt;
  document.getElementById('lightbox-caption').textContent = item.caption;
  document.getElementById('lightbox-link').href = item.url;
}
function openGallery(items, index) { currentItems = items; showImage(index); dialog.showModal(); }
document.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
document.querySelector('.lightbox-prev').addEventListener('click', () => showImage(currentIndex - 1));
document.querySelector('.lightbox-next').addEventListener('click', () => showImage(currentIndex + 1));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') showImage(currentIndex - 1); if (event.key === 'ArrowRight') showImage(currentIndex + 1); });

function renderGallery(category = 'cortes') {
  const items = galleryItems[category] || [];
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  const status = document.getElementById('gallery-status');
  const source = document.querySelector('[data-gallery-source]');
  grid.replaceChildren();
  document.querySelectorAll('[data-gallery-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryFilter === category)));
  empty.hidden = items.length > 0;
  source.hidden = category !== 'proteses';
  status.textContent = items.length ? `${items.length} registros oficiais` : category === 'proteses' ? 'Veja a publicação oficial; ainda não há fotos da categoria no catálogo local.' : 'Ainda não há registros oficiais desta categoria no catálogo local.';
  items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-work-card';
    button.setAttribute('aria-label', `Ampliar ${item.caption}`);
    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    const caption = document.createElement('span');
    caption.textContent = item.caption;
    button.append(image, caption);
    button.addEventListener('click', () => openGallery(items, index));
    grid.append(button);
  });
}
document.querySelectorAll('[data-gallery-filter]').forEach(button => button.addEventListener('click', () => renderGallery(button.dataset.galleryFilter)));
renderGallery();
document.getElementById('year').textContent = new Date().getFullYear();

const securePwaOrigin = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && securePwaOrigin) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .catch(error => console.warn('PWA indisponível:', error));
  });
}

let deferredInstallPrompt;
const installButton = document.getElementById('install-app');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = undefined;
  installButton.hidden = true;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = undefined;
  installButton.hidden = true;
});

