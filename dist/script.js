const whatsappNumber = '5511948446801';
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Abrir menu');
  nav.classList.remove('open');
}
menuButton.addEventListener('click', () => {
  const opening = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(opening));
  menuButton.setAttribute('aria-label', opening ? 'Fechar menu' : 'Abrir menu');
  nav.classList.toggle('open', opening);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
window.addEventListener('resize', () => { if (window.innerWidth > 1180) closeMenu(); });

document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
  const service = document.getElementById('service');
  const option = [...service.options].find(item => item.textContent.startsWith(link.dataset.service + ' ·'));
  if (option) { service.value = option.value; service.dispatchEvent(new Event('change')); }
}));

const gallery = [
  { src:'./assets/corte-perfil-instagram.jpg', alt:'Corte masculino do perfil oficial', caption:'Corte masculino · perfil oficial', url:'https://www.instagram.com/aroldobarbeirooficial/' },
  { src:'./assets/corte-kids-instagram.jpg', alt:'Corte infantil do perfil oficial', caption:'Corte infantil · perfil oficial', url:'https://www.instagram.com/aroldobarbeirooficial/reel/C4yIQSzuuGl/' },
  { src:'./assets/destaque-nevou-01.jpg', alt:'Platinado do destaque oficial', caption:'Platinado · destaque Nevou', url:'https://www.instagram.com/stories/highlights/17966296571269322/' },
  { src:'./assets/destaque-desenhos-01.jpg', alt:'Desenho no cabelo do destaque oficial', caption:'Desenho no cabelo · destaque Desenhos', url:'https://www.instagram.com/stories/highlights/17956278125249781/' },
  { src:'./assets/destaque-barbas-02.jpg', alt:'Barba do destaque oficial', caption:'Barba · destaque Barbas', url:'https://www.instagram.com/stories/highlights/17962977680653535/' }
];

const siteHeader = document.querySelector('.site-header');
const primaryLinks = [...nav.querySelectorAll('a')];
function updateHeaderState() {
  siteHeader.classList.toggle('is-scrolled', window.scrollY > 24);
  const probe = window.scrollY + window.innerHeight * .42;
  let active = primaryLinks[0];
  let activeTop = -Infinity;
  primaryLinks.forEach(link => {
    const section = document.getElementById(link.hash.slice(1));
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    if (top <= probe && top > activeTop) { active = link; activeTop = top; }
  });
  primaryLinks.forEach(link => {
    if (link === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('scroll', updateHeaderState, { passive: true });
window.addEventListener('resize', updateHeaderState);
updateHeaderState();

const collections = {
  artistas: {title:'ARTISTAS',number:'01 / 06',description:'Encontros e bastidores publicados no destaque oficial.',url:'https://www.instagram.com/stories/highlights/17912568753117277/',photos:[['destaque-artistas-01.jpg','Encontro'],['destaque-artistas-02.jpg','Bastidores']]},
  premiacoes: {title:'PREMIAÇÕES',number:'02 / 06',description:'Certificado de 2020 e registros com troféus publicados no perfil.',url:'https://www.instagram.com/stories/highlights/17969838071171142/',photos:[['destaque-premiacoes-01.jpg','Certificado'],['destaque-premiacoes-02.jpg','Registro com troféus']]},
  barbas: {title:'BARBAS',number:'03 / 06',description:'Trabalhos de barba da coleção oficial.',url:'https://www.instagram.com/stories/highlights/17962977680653535/',photos:[['destaque-barbas-01.jpg','Acabamento'],['destaque-barbas-02.jpg','Barba']]},
  kids: {title:'CORTE KIDS',number:'04 / 06',description:'Atendimentos infantis publicados pelo perfil.',url:'https://www.instagram.com/stories/highlights/17998904341653498/',photos:[['corte-kids-instagram.jpg','Na cadeira'],['destaque-kids-02.jpg','Corte infantil']]},
  nevou: {title:'NEVOU',number:'05 / 06',description:'Platinados e descolorações da coleção oficial.',url:'https://www.instagram.com/stories/highlights/17966296571269322/',photos:[['destaque-nevou-01.jpg','Platinado'],['destaque-nevou-02.jpg','Descoloração']]},
  desenhos: {title:'DESENHOS',number:'06 / 06',description:'Desenhos criados nos cabelos, publicados no destaque oficial.',url:'https://www.instagram.com/stories/highlights/17956278125249781/',photos:[['destaque-desenhos-01.jpg','Arte no cabelo'],['destaque-desenhos-02.jpg','Desenho temático']]}
};

let currentItems = gallery;
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
document.querySelectorAll('[data-gallery]').forEach(button => button.addEventListener('click', () => openGallery(gallery, Number(button.dataset.gallery))));
document.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
document.querySelector('.lightbox-prev').addEventListener('click', () => showImage(currentIndex - 1));
document.querySelector('.lightbox-next').addEventListener('click', () => showImage(currentIndex + 1));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') showImage(currentIndex - 1); if (event.key === 'ArrowRight') showImage(currentIndex + 1); });

function chooseCollection(key) {
  const c = collections[key];
  if (!c) return;
  document.querySelectorAll('[data-highlight]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.highlight === key)));
  document.getElementById('highlight-count').textContent = c.number;
  document.getElementById('highlight-title').textContent = c.title;
  document.getElementById('highlight-description').textContent = c.description;
  document.getElementById('highlight-source').href = c.url;
  const photos = c.photos.map(([file,title]) => ({src:`./assets/${file}`,alt:`${title} do destaque ${c.title}`,caption:`${title} · destaque ${c.title}`,url:c.url}));
  const target = document.getElementById('highlight-photos');
  target.replaceChildren();
  photos.forEach((photo,index) => {
    const button = document.createElement('button'); button.type='button'; button.setAttribute('aria-label',`Ampliar ${photo.caption}`);
    const img = document.createElement('img'); img.src=photo.src; img.alt=photo.alt; img.loading='lazy';
    const label = document.createElement('span'); label.textContent=photo.caption;
    button.append(img,label); button.addEventListener('click',()=>openGallery(photos,index)); target.append(button);
  });
}
document.querySelectorAll('[data-highlight]').forEach(button => button.addEventListener('click', () => chooseCollection(button.dataset.highlight)));
chooseCollection('artistas');
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

