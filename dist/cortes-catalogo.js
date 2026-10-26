(() => {
  const choices = document.getElementById('cut-category-choices');
  const detail = document.getElementById('cut-category-detail');
  const grid = document.getElementById('booking-catalog-showcase');
  const status = document.getElementById('showcase-status');
  const title = document.getElementById('cut-category-title');
  const back = document.getElementById('cut-category-back');
  const heading = document.querySelector('.cut-catalog-heading');
  const categoryButtons = [...choices.querySelectorAll('[data-category-choice]')];
  const categoryNames = { masculinos: 'Cortes masculinos', infantis: 'Cortes infantis', barbas: 'Estilos de barba' };
  let items = [];
  let services = [];
  let selectedCategory = null;

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  const serviceFor = name => services.find(service => normalize(service.name) === normalize(name) && Number.isInteger(service.priceCents));
  const sendChoice = (name, category, image) => {
    const registeredService = serviceFor(name);
    window.dispatchEvent(new CustomEvent('aroldo:selecionar-corte', {
      detail: { name, category, image, priceCents: registeredService?.priceCents ?? null }
    }));
  };

  function makeCard(item) {
    const card = document.createElement('article');
    card.className = 'cut-card';
    const media = document.createElement('div');
    media.className = 'cut-card-media';
    const photo = document.createElement('img');
    photo.src = item.imagem;
    photo.alt = `Referência de ${item.nome}`;
    photo.loading = 'lazy';
    photo.decoding = 'async';
    media.append(photo);

    const body = document.createElement('div');
    body.className = 'cut-card-body';
    const title = document.createElement('h4');
    title.textContent = item.nome;
    const registeredService = serviceFor(item.nome);
    if (registeredService) {
      const price = document.createElement('p');
      price.className = 'cut-card-price';
      price.textContent = money(registeredService.priceCents);
      body.append(title, price);
    } else body.append(title);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cut-card-choose';
    button.textContent = 'AGENDAR ESTE CORTE';
    button.setAttribute('aria-label', `Agendar ${item.nome}`);
    button.addEventListener('click', () => sendChoice(item.nome, item.categoria, item.imagem));
    body.append(button);
    card.append(media, body);
    return card;
  }

  function renderDetail() {
    grid.replaceChildren();
    if (!selectedCategory) return;
    const shown = items.filter(item => item.categoria === selectedCategory);
    if (!items.length) {
      status.textContent = 'Carregando os cortes…';
      return;
    }
    status.textContent = `${shown.length} ${shown.length === 1 ? 'opção disponível' : 'opções disponíveis'}`;
    grid.append(...shown.map(makeCard));
  }

  function showCategories({ focus = false } = {}) {
    selectedCategory = null;
    detail.hidden = true;
    choices.hidden = false;
    heading.hidden = false;
    grid.replaceChildren();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) categoryButtons[0].focus({ preventScroll: true });
  }

  function showCategory(category) {
    if (!categoryNames[category]) return;
    selectedCategory = category;
    choices.hidden = true;
    detail.hidden = false;
    heading.hidden = true;
    title.textContent = categoryNames[category];
    renderDetail();
    window.scrollTo({ top: 0, behavior: 'instant' });
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  }

  categoryButtons.forEach(button => button.addEventListener('click', () => showCategory(button.dataset.categoryChoice)));
  back.addEventListener('click', () => showCategories({ focus: true }));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="/cortes"]');
    if (!link) return;
    if (link.dataset.openCategory) showCategory(link.dataset.openCategory);
    else showCategories();
  });
  window.addEventListener('popstate', () => { if (location.pathname === '/cortes') showCategories(); });
  window.addEventListener('aroldo:servicos-carregados', event => {
    services = Array.isArray(event.detail?.services) ? event.detail.services : [];
    if (selectedCategory) renderDetail();
  });

  fetch('./cortes-catalogo.json', { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error('Catálogo indisponível'); return response.json(); })
    .then(data => { items = Array.isArray(data) ? data : []; if (selectedCategory) renderDetail(); })
    .catch(() => { if (selectedCategory) status.textContent = 'Não foi possível carregar o catálogo. Atualize a página para tentar novamente.'; });
})();
