(() => {
  const section = document.getElementById('servicos-precos');
  const landing = document.getElementById('services-prices-landing');
  const detail = document.getElementById('services-prices-detail');
  const list = document.getElementById('services-prices-detail-list');
  const status = document.getElementById('services-prices-status');
  const title = document.getElementById('services-prices-detail-title');
  const subtitle = document.getElementById('services-prices-detail-subtitle');
  const hint = document.getElementById('services-prices-detail-hint');
  const icon = document.getElementById('services-prices-detail-icon');
  const hero = document.querySelector('.services-prices-detail-hero');
  const groups = {
    cabelo: { title: 'CABELOS', subtitle: 'ESTILO EM TODOS OS DETALHES', hint: 'Escolha o corte ideal, veja o preço e agende seu horário.', icon: '✂', photo: './assets/concept-corte.jpg' },
    barba: { title: 'BARBA', subtitle: 'CUIDADO, ESTILO E PRECISÃO', hint: 'Escolha o serviço ideal, veja o preço e agende seu horário.', icon: '♢', photo: './assets/concept-barba.jpg' },
    coloracao: { title: 'COLORAÇÃO', subtitle: 'MAIS ESTILO, MAIS PERSONALIDADE', hint: 'Escolha o serviço ideal, veja o preço e agende seu horário.', icon: '◈', photo: './assets/concept-platinado.jpg' },
    combos: { title: 'COMBOS', subtitle: 'MAIS ESTILO, MAIS COMPLETO', hint: 'Escolha o combo ideal, veja o preço e agende seu horário.', icon: '✦', photo: './assets/concept-visagismo.jpg' }
  };
  const order = [
    'Corte com máquina', 'Corte na tesoura', 'Corte infantil', 'Pezinho', 'Sobrancelha', 'Hidratação', 'Relaxamento capilar',
    'Barba simples', 'Barba com espuma quente', 'Barboterapia com vapor de ozônio',
    'Nevou', 'Luzes', 'Luzes platinadas', 'Pigmentar cabelo', 'Pigmentar barba', 'Banho de brilho',
    'Cabelo + barba simples', 'Cabelo + barba com espuma quente', 'Cabelo + barboterapia com vapor de ozônio'
  ];
  const cabeloReferencePrices = new Map([
    ['Corte com máquina', 3500], ['Corte na tesoura', 4000], ['Corte infantil', 4000],
    ['Pezinho', 1000], ['Sobrancelha', 1000], ['Hidratação', 3000], ['Relaxamento capilar', 3500]
  ]);
  const barbaReferencePrices = new Map([
    ['Barba simples', 2000], ['Barba com espuma quente', 2500],
    ['Barboterapia com vapor de ozônio', 3000], ['Pezinho', 1000], ['Sobrancelha', 1000]
  ]);
  const coloracaoReferencePrices = new Map([
    ['Nevou', 20000], ['Luzes', 10000], ['Luzes platinadas', 15000],
    ['Pigmentar cabelo', 3500], ['Pigmentar barba', 3000], ['Banho de brilho', 4000]
  ]);
  const combosReferencePrices = new Map([
    ['Cabelo + barba simples', 5000],
    ['Cabelo + barba com espuma quente', 5500],
    ['Cabelo + barboterapia com vapor de ozônio', 6000]
  ]);
  const photos = {
    'Corte com máquina': ['./assets/cortes/masculinos/tradicional.webp', true],
    'Corte na tesoura': ['./assets/cortes/masculinos/mid-fade.webp', true],
    'Corte infantil': ['./assets/cortes/infantis/classico-na-tesoura.webp', true],
    'Pezinho': ['./assets/cortes/masculinos/razor-part.webp', true],
    'Sobrancelha': ['./assets/concept-corte.jpg', true],
    'Hidratação': ['./assets/cortes/masculinos/old-money.webp', true],
    'Relaxamento capilar': ['./assets/desondulacao-instagram.jpg', false],
    'Barba simples': ['./assets/destaque-barbas-02.jpg', false],
    'Barba com espuma quente': ['./assets/destaque-barbas-01.jpg', false],
    'Barboterapia com vapor de ozônio': ['./assets/concept-barba.jpg', true],
    'Nevou': ['./assets/destaque-nevou-01.jpg', false],
    'Luzes': ['./assets/destaque-nevou-02.jpg', false],
    'Luzes platinadas': ['./assets/destaque-nevou-01.jpg', false],
    'Pigmentar cabelo': ['./assets/concept-corte.jpg', true],
    'Pigmentar barba': ['./assets/concept-barba.jpg', true],
    'Banho de brilho': ['./assets/concept-platinado.jpg', true],
    'Cabelo + barba simples': ['./assets/concept-corte.jpg', true],
    'Cabelo + barba com espuma quente': ['./assets/concept-barba.jpg', true],
    'Cabelo + barboterapia com vapor de ozônio': ['./assets/concept-corte.jpg', true]
  };
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  let services = [];
  let activeGroup = null;

  function groupFor(service) {
    const name = normalize(service.name);
    if (/combo|pacote|cabelo.*barba|barba.*cabelo|corte.*barba|barba.*corte|cabelo.*barboterapia/.test(name)) return 'combos';
    if (/color|nevou|luzes|mecha|platin|pigment|tonaliz|descolor|banho de brilho/.test(name)) return 'coloracao';
    if (/barba|barbot|bigode|navalha/.test(name)) return 'barba';
    return 'cabelo';
  }

  function serviceRow(service) {
    const row = document.createElement('article');
    row.className = 'services-prices-detail-row';
    row.dataset.serviceId = service.id;
    if (activeGroup === 'combos') row.classList.add('services-prices-combo-row');
    const picture = photos[service.name];
    const photo = picture ? document.createElement('img') : document.createElement('span');
    if (picture) {
      photo.className = 'services-prices-detail-photo';
      photo.src = picture[0];
      photo.alt = picture[1] ? `Imagem ilustrativa de ${service.name}` : `Referência visual para ${service.name}`;
      photo.loading = 'eager';
      photo.decoding = 'async';
    } else {
      photo.className = 'services-prices-detail-placeholder';
      photo.textContent = groups[activeGroup].icon;
      photo.setAttribute('aria-hidden', 'true');
    }
    const copy = document.createElement('div');
    copy.className = 'services-prices-detail-copy';
    if (activeGroup === 'combos') {
      const label = document.createElement('span');
      label.className = 'services-prices-combo-label';
      label.textContent = `COMBO ${order.filter(item => item.startsWith('Cabelo +')).indexOf(service.name) + 1}`;
      copy.append(label);
    }
    const name = document.createElement('strong');
    name.textContent = service.name;
    copy.append(name);
    if (service.description) {
      const description = document.createElement('small');
      description.textContent = service.description;
      copy.append(description);
    }
    if (activeGroup === 'combos') {
      const parts = document.createElement('small');
      parts.className = 'services-prices-combo-parts';
      parts.textContent = service.name.includes('barboterapia') ? '✂ CABELO  +  ♢ BARBOTERAPIA' : '✂ CABELO  +  ♢ BARBA';
      copy.append(parts);
    }
    if (picture?.[1]) {
      const note = document.createElement('small');
      note.className = 'services-prices-photo-note';
      note.textContent = 'Imagem ilustrativa';
      copy.append(note);
    }
    const price = document.createElement('span');
    price.className = 'services-prices-detail-price';
    price.textContent = Number.isInteger(service.priceCents) ? money(service.priceCents) : 'Valor a confirmar';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'services-prices-detail-book';
    button.textContent = 'AGENDAR';
    button.setAttribute('aria-label', `Agendar ${service.name}`);
    button.addEventListener('click', () => window.dispatchEvent(new CustomEvent('aroldo:selecionar-servico', { detail: { id: service.id } })));
    row.addEventListener('click', event => { if (!event.target.closest('button')) button.click(); });
    row.append(photo, copy, price, button);
    return row;
  }

  function renderDetail() {
    if (!activeGroup) return;
    list.replaceChildren();
    const currentOrder = activeGroup === 'barba' ? [...barbaReferencePrices.keys()] : order;
    const position = name => { const index = currentOrder.indexOf(name); return index < 0 ? 999 : index; };
    const matching = services.filter(service => groupFor(service) === activeGroup ||
      (activeGroup === 'barba' && (service.name === 'Pezinho' || service.name === 'Sobrancelha')))
      .sort((a, b) => position(a.name) - position(b.name));
    const referencePrices = activeGroup === 'cabelo' ? cabeloReferencePrices :
      activeGroup === 'barba' ? barbaReferencePrices :
      activeGroup === 'coloracao' ? coloracaoReferencePrices :
      activeGroup === 'combos' ? combosReferencePrices : null;
    detail.dataset.artReady = String(referencePrices !== null && matching.length === referencePrices.size &&
      matching.every(service => referencePrices.get(service.name) === service.priceCents));
    if (matching.length) list.append(...matching.map(serviceRow));
    else {
      const empty = document.createElement('p');
      empty.className = 'services-prices-empty';
      empty.textContent = 'Serviços desta categoria em breve.';
      list.append(empty);
    }
  }

  function showCategory(group) {
    if (!groups[group]) return;
    activeGroup = group;
    detail.dataset.group = group;
    title.textContent = groups[group].title;
    subtitle.textContent = groups[group].subtitle;
    hint.textContent = groups[group].hint;
    icon.textContent = groups[group].icon;
    hero.style.setProperty('--detail-photo', `url("${groups[group].photo}")`);
    section.setAttribute('aria-labelledby', 'services-prices-detail-title');
    document.body.classList.add('services-detail-open');
    landing.hidden = true;
    detail.hidden = false;
    renderDetail();
    window.scrollTo({ top: 0, behavior: 'instant' });
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  function showLanding() {
    activeGroup = null;
    detail.hidden = true;
    landing.hidden = false;
    section.setAttribute('aria-labelledby', 'services-prices-title');
    document.body.classList.remove('services-detail-open');
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('[data-price-category="cabelo"]')?.focus({ preventScroll: true });
  }

  document.querySelectorAll('[data-price-category]').forEach(button => button.addEventListener('click', () => showCategory(button.dataset.priceCategory)));
  document.getElementById('services-prices-back').addEventListener('click', showLanding);
  window.addEventListener('aroldo:route', event => { if (event.detail?.route !== '/servicos-precos' && activeGroup) showLanding(); });
  function receiveServices(catalog) {
    services = Array.isArray(catalog) ? catalog.filter(service => order.includes(service.name)) : [];
    status.textContent = services.length ? '' : 'Os serviços ainda não estão disponíveis para agendamento.';
    renderDetail();
  }
  window.addEventListener('aroldo:servicos-carregados', event => receiveServices(event.detail?.services));
  window.addEventListener('aroldo:servicos-erro', () => {
    status.textContent = 'Não foi possível carregar os serviços agora. Tente novamente mais tarde.';
  });
  if (Array.isArray(window.aroldoServicesCatalog)) receiveServices(window.aroldoServicesCatalog);
  else if (window.aroldoServicesLoadError) status.textContent = 'Não foi possível carregar os serviços agora. Tente novamente mais tarde.';
})();
