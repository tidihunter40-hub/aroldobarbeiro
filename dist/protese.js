(() => {
  const categories = document.getElementById('gallery-categories');
  const detail = document.getElementById('gallery-detail');
  if (!categories || !detail) return;

  const names = {
    cortes: 'Cortes realizados',
    visagismo: 'Visagismo',
    proteses: 'Próteses capilares',
    barbas: 'Barbas',
    desenhos: 'Desenhos',
    platinados: 'Platinados',
    outros: 'Outros trabalhos'
  };

  function showCategories() {
    categories.hidden = false;
    detail.hidden = true;
    document.getElementById('gallery-standard').hidden = true;
    document.getElementById('gallery-grid').replaceChildren();
  }

  categories.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-category]');
    if (!button || !categories.contains(button)) return;
    const category = button.dataset.galleryCategory;
    if (!Object.hasOwn(names, category)) return;
    categories.hidden = true;
    detail.hidden = false;
    document.getElementById('gallery-standard').hidden = false;
    document.getElementById('gallery-category-title').textContent = names[category];
    renderGallery(category);
    document.getElementById('gallery-back').focus({ preventScroll: true });
  });

  document.getElementById('gallery-back').addEventListener('click', () => {
    showCategories();
    categories.querySelector('button').focus({ preventScroll: true });
  });

  addEventListener('aroldo:route', event => {
    if (event.detail.route === '/galeria') showCategories();
  });
  showCategories();
})();
