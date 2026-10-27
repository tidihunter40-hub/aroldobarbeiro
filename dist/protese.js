(() => {
  const categories = document.getElementById('gallery-categories');
  if (!categories) return;
  const detail = document.getElementById('gallery-detail');
  const standard = document.getElementById('gallery-standard');
  const protese = document.getElementById('protese-detail');
  const results = document.getElementById('protese-results');
  const empty = document.getElementById('protese-empty');
  const controls = document.getElementById('protese-controls');
  const names = { cortes: 'Cortes realizados', visagismo: 'Visagismo', barbas: 'Barbas', outros: 'Outros trabalhos' };
  let gallery = { transformations: [] };
  let first = 0;
  let requestId = 0;
  let selectedCategory = '';

  function showCategories() {
    selectedCategory = '';
    categories.hidden = false;
    detail.hidden = true;
    document.querySelectorAll('[data-gallery-category]').forEach(button => button.removeAttribute('aria-pressed'));
  }

  function resultCard(item) {
    const article = document.createElement('article'); article.className = 'protese-result';
    const comparison = document.createElement('div'); comparison.className = 'protese-compare';
    const before = document.createElement('img'); before.src = item.before; before.alt = `Antes: ${item.caption}`; before.loading = 'lazy';
    const after = document.createElement('img'); after.src = item.after; after.alt = `Depois: ${item.caption}`; after.className = 'protese-after'; after.loading = 'lazy';
    const divider = document.createElement('span'); divider.className = 'protese-divider'; divider.setAttribute('aria-hidden', 'true');
    const labels = document.createElement('span'); labels.className = 'protese-compare-labels'; labels.setAttribute('aria-hidden', 'true');
    for (const value of ['ANTES', 'DEPOIS']) { const label = document.createElement('b'); label.textContent = value; labels.append(label); }
    const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '100'; range.value = '50';
    range.setAttribute('aria-label', `Arraste para comparar antes e depois: ${item.caption}`);
    range.addEventListener('input', () => comparison.style.setProperty('--split', `${range.value}%`));
    comparison.append(before, after, divider, labels, range);
    const caption = document.createElement('p'); caption.textContent = item.caption;
    article.append(comparison, caption);
    return article;
  }

  function renderResults() {
    const items = gallery.transformations || [];
    results.replaceChildren();
    empty.hidden = items.length > 0;
    controls.hidden = items.length <= 1;
    if (!items.length) return;
    const count = innerWidth <= 640 ? 1 : innerWidth <= 900 ? 2 : 3;
    for (let offset = 0; offset < Math.min(count, items.length); offset++)
      results.append(resultCard(items[(first + offset) % items.length]));
  }

  function renderProteseWorks() {
    const items = [...galleryItems.proteses, ...(window.aroldoGalleryExtras?.proteses || [])];
    const grid = document.getElementById('protese-work-grid');
    grid.replaceChildren();
    items.forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'gallery-work-card';
      button.setAttribute('aria-label', `Ampliar ${item.caption}`);
      const photo = document.createElement('img'); photo.src = item.src; photo.alt = item.alt; photo.loading = 'lazy';
      const caption = document.createElement('span'); caption.textContent = item.caption;
      button.append(photo, caption);
      button.addEventListener('click', () => openGallery(items, index));
      grid.append(button);
    });
  }

  function renderCovers() {
    document.querySelectorAll('[data-gallery-category]').forEach(button => {
      const img = button.querySelector('img');
      img.dataset.fallback ||= img.getAttribute('src');
      const cover = gallery.covers?.[button.dataset.galleryCategory];
      img.src = cover || img.dataset.fallback;
      const note = button.querySelector('small');
      if (note) note.hidden = Boolean(cover);
    });
  }

  async function loadGallery() {
    const id = ++requestId;
    try {
      const response = await fetch('/api/public/gallery', { cache: 'no-store' });
      if (!response.ok) throw new Error('Galeria indisponível.');
      const data = await response.json();
      if (id !== requestId) return;
      gallery = data;
      window.aroldoGalleryExtras = Object.fromEntries(Object.entries(data.works || {}).map(([key, entries]) =>
        [key, entries.map(item => ({ ...item, alt: `Trabalho real de ${key}: ${item.caption}` }))]));
      document.getElementById('protese-intro').textContent = data.intro;
      document.getElementById('protese-description').textContent = data.description;
      renderCovers();
      first = 0;
      renderResults();
      renderProteseWorks();
      if (selectedCategory && selectedCategory !== 'proteses') renderGallery(selectedCategory);
    } catch {
      if (id !== requestId) return;
      gallery = { transformations: [] };
      renderResults();
      renderProteseWorks();
    }
  }

  categories.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-category]');
    if (!button) return;
    const category = button.dataset.galleryCategory;
    selectedCategory = category;
    categories.hidden = true; detail.hidden = false;
    protese.hidden = category !== 'proteses'; standard.hidden = category === 'proteses';
    if (category === 'proteses') { renderProteseWorks(); loadGallery(); }
    else { document.getElementById('gallery-category-title').textContent = names[category]; renderGallery(category); }
    document.getElementById('gallery-back').focus({ preventScroll: true });
  });
  document.getElementById('gallery-back').addEventListener('click', () => { showCategories(); categories.querySelector('button').focus({ preventScroll: true }); });
  document.getElementById('protese-prev').addEventListener('click', () => { first = (first - 1 + gallery.transformations.length) % gallery.transformations.length; renderResults(); });
  document.getElementById('protese-next').addEventListener('click', () => { first = (first + 1) % gallery.transformations.length; renderResults(); });
  addEventListener('resize', renderResults);
  addEventListener('aroldo:route', event => { if (event.detail.route === '/galeria') { showCategories(); loadGallery(); } });
  showCategories();
  renderProteseWorks();
  loadGallery();
})();
