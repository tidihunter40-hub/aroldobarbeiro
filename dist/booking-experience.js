(() => {
  const form = document.getElementById('booking-form');
  const day = document.getElementById('booking-day');
  const dayChoices = document.getElementById('booking-day-choices');
  const slotPeriods = document.getElementById('booking-slot-periods');
  const prevDays = document.getElementById('booking-days-prev');
  const nextDays = document.getElementById('booking-days-next');
  const services = document.getElementById('booking-services');
  const showcase = document.getElementById('booking-catalog-showcase');
  const showcaseStatus = document.getElementById('showcase-status');
  const preselected = document.getElementById('booking-preselected');
  const cutSelection = document.getElementById('booking-cut-selection');
  const status = document.getElementById('booking-status');
  const serviceStatus = document.getElementById('service-status');
  const confirmStatus = document.getElementById('confirm-status');
  const result = document.getElementById('booking-result');
  const next = document.getElementById('service-next');
  const submit = form.querySelector('button[type=submit]');
  const stages = { agenda: document.getElementById('booking-stage-agenda'), service: document.getElementById('booking-stage-service'), confirm: document.getElementById('booking-stage-confirm') };
  const zone = 'America/Bahia';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const addDays = (value, count) => new Date(Date.parse(`${value}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  const priceLabel = cents => Number.isInteger(cents) ? money(cents) : 'Valor a confirmar';
  const timeLabel = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const say = (element, value, bad = false) => { element.textContent = value; element.classList.toggle('error', bad); };
  let catalog = [];
  let slotMinutes = 30;
  let chosenTime = '';
  let chosenService = null;
  let stage = 'agenda';
  let agendaSequence = 0;
  let checkSequence = 0;
  let preferredService = sessionStorage.getItem('aroldo-service') || '';
  let preferredServiceId = null;
  let selectedCut = null;
  try { selectedCut = JSON.parse(sessionStorage.getItem('aroldo-cut') || 'null'); } catch { sessionStorage.removeItem('aroldo-cut'); }
  sessionStorage.removeItem('aroldo-cut');
  let ready = false;
  let dayOffset = 0;
  sessionStorage.removeItem('aroldo-service');
  day.min = today;
  day.max = addDays(today, 60);
  day.value = today;

  async function json(url, options) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a agenda.');
    return data;
  }
  function show(name, scroll = true) {
    stage = name;
    document.getElementById('agendar').dataset.step = name;
    document.body.dataset.bookingStep = name;
    Object.entries(stages).forEach(([key, element]) => { element.hidden = key !== name; });
    result.hidden = name !== 'result';
    form.querySelectorAll('.booking-progress li').forEach((item, index) => {
      item.classList.toggle('current', index === ({ agenda: 0, service: 1, confirm: 2, result: 3 }[name]));
    });
    if (scroll) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderDays() {
    dayChoices.replaceChildren();
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
    for (let i = 0; i < 7; i++) {
      const value = addDays(today, dayOffset + i);
      if (value > day.max) break;
      const date = new Date(`${value}T12:00:00Z`);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'booking-day-choice';
      const label = document.createElement('span');
      label.textContent = weekday.format(date).replace('.', '').slice(0, 3).toUpperCase();
      const number = document.createElement('b');
      number.textContent = value.slice(8);
      const monthLabel = document.createElement('small');
      monthLabel.textContent = month.format(date).replace('.', '').toUpperCase();
      button.append(label, number, monthLabel);
      button.setAttribute('aria-label', dateLabel(value));
      button.setAttribute('aria-pressed', String(day.value === value));
      button.addEventListener('click', () => { day.value = value; resetChoice(); loadAgenda(); });
      dayChoices.append(button);
    }
    prevDays.disabled = dayOffset === 0;
    nextDays.disabled = dayOffset + 7 > 60;
  }
  function resetChoice() {
    chosenTime = ''; chosenService = catalog.find(item => item.id === preferredServiceId) || null; next.disabled = true;
    result.replaceChildren();
    renderDays();
    show('agenda', false);
  }
  async function loadAgenda() {
    if (!ready) { say(status, 'Agenda ainda não configurada. Fale com Aroldo pelo WhatsApp.'); return; }
    const sequence = ++agendaSequence;
    slotPeriods.replaceChildren();
    say(status, 'Buscando horários…');
    if (!day.value || day.value < day.min || day.value > day.max) { say(status, 'Escolha uma data nos próximos 60 dias.', true); return; }
    try {
      const { slots: entries } = await json(`/api/public/agenda?day=${encodeURIComponent(day.value)}`);
      if (sequence !== agendaSequence) return;
      if (!entries.length) { say(status, 'Sem horários neste dia. Escolha outra data.'); return; }
      say(status, '');
      const labels = { available: 'Livre', pending: 'Pendente', confirmed: 'Ocupado', blocked: 'Ocupado', unavailable: 'Indisponível' };
      const step = slotMinutes;
      const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
      const createPeriod = (periodEntries, periodIndex) => {
        const start = periodEntries[0].time;
        const end = timeLabel(toMinutes(periodEntries.at(-1).time) + step);
        const startsInMorning = start < '12:00';
        const endsInMorning = end <= '12:00';
        const title = startsInMorning && endsInMorning ? 'MANHÃ' : start >= '14:00' ? 'TARDE' : `PERÍODO ${periodIndex + 1}`;
        const details = document.createElement('details');
        details.className = 'booking-period';
        details.open = true;
        const heading = document.createElement('summary');
        heading.className = 'booking-period-heading';
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = title === 'MANHÃ' ? '☀' : title === 'TARDE' ? '◕' : '◷';
        const label = document.createElement('span');
        label.className = 'booking-period-label';
        const name = document.createElement('strong');
        name.textContent = title;
        const hours = document.createElement('small');
        hours.textContent = `${start} às ${end}`;
        const toggle = document.createElement('b');
        toggle.setAttribute('aria-hidden', 'true');
        toggle.textContent = '⌃';
        label.append(name, hours);
        heading.append(icon, label, toggle);
        const grid = document.createElement('div');
        grid.className = 'booking-slot-grid';
        for (const entry of periodEntries) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = `slot slot-${entry.status}`;
        const time = document.createElement('strong');
        time.textContent = entry.time;
        const state = document.createElement('small');
        state.textContent = labels[entry.status] || 'Ocupado';
        button.append(time, state);
        button.setAttribute('aria-label', `${entry.time}, ${labels[entry.status] || 'Ocupado'}`);
        button.disabled = entry.status !== 'available';
        button.addEventListener('click', async () => {
          chosenTime = entry.time;
          chosenService = catalog.find(item => item.id === preferredServiceId) || null;
          next.disabled = true;
          renderServices(); show('service');
          if (chosenService && await checkService() && chosenTime === entry.time) {
            renderSummary();
            show('confirm');
          }
        });
          grid.append(button);
        }
        details.append(heading, grid);
        slotPeriods.append(details);
      };
      let periodEntries = [];
      let periodIndex = 0;
      for (let index = 0; index < entries.length;) {
        const entry = entries[index];
        if (entry.status !== 'unavailable') {
          periodEntries.push(entry);
          index += 1;
          continue;
        }
        if (periodEntries.length) {
          createPeriod(periodEntries, periodIndex++);
          periodEntries = [];
        }
        const unavailable = [];
        while (index < entries.length && entries[index].status === 'unavailable') {
          unavailable.push(entries[index]);
          index += 1;
        }
        const lunch = document.createElement('div');
        lunch.className = 'booking-lunch';
        lunch.setAttribute('aria-label', `Fechado das ${unavailable[0].time} às ${timeLabel(toMinutes(unavailable.at(-1).time) + step)}`);
        const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = '◷';
        const range = document.createElement('strong'); range.textContent = `${unavailable[0].time} às ${timeLabel(toMinutes(unavailable.at(-1).time) + step)}`;
        const note = document.createElement('small'); note.textContent = 'FECHADO · INTERVALO';
        lunch.append(icon, range, note);
        slotPeriods.append(lunch);
      }
      if (periodEntries.length) createPeriod(periodEntries, periodIndex);
    } catch (cause) { if (sequence === agendaSequence) say(status, navigator.onLine ? `${cause.message} Tente novamente.` : 'Você está offline. Conecte-se para consultar horários atualizados.', true); }
  }
  function renderServices() {
    services.replaceChildren();
    cutSelection.hidden = !selectedCut;
    cutSelection.replaceChildren();
    if (selectedCut) {
      const crown = document.createElement('span'); crown.className = 'booking-cut-crown'; crown.setAttribute('aria-hidden', 'true'); crown.textContent = '♛';
      const copy = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = `Estilo escolhido: ${selectedCut.name}${Number.isInteger(selectedCut.priceCents) ? ` · ${money(selectedCut.priceCents)}` : ''}`;
      const note = document.createElement('small'); note.textContent = 'A referência fica junto do seu pedido.';
      copy.append(title, note); cutSelection.append(crown, copy);
    }
    say(serviceStatus, 'Escolha um serviço para este horário.');
    for (const item of catalog) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'booking-service-card';
      button.setAttribute('aria-pressed', String(chosenService?.id === item.id));
      const photo = item.photoUrl ? document.createElement('img') : document.createElement('span');
      const isAi = Boolean(item.photoUrl?.includes('/cortes-ia/'));
      if (item.photoUrl) { photo.src = item.photoUrl; photo.alt = isAi ? `Imagem ilustrativa gerada por IA: ${item.name}` : `Foto do serviço: ${item.name}`; photo.loading = 'lazy'; }
      else { photo.className = 'booking-service-placeholder'; photo.textContent = '✂'; photo.setAttribute('aria-hidden', 'true'); }
      const details = document.createElement('span'); details.className = 'booking-service-details';
      const heading = document.createElement('span'); heading.className = 'booking-service-heading';
      const icon = document.createElement('span'); icon.className = 'booking-service-icon'; icon.setAttribute('aria-hidden', 'true');
      const category = /barba/i.test(item.name) ? 'barbas' : /infantil/i.test(item.name) ? 'infantis' : 'masculinos';
      const iconArt = document.querySelector(`[data-category-choice="${category}"] svg`)?.cloneNode(true);
      if (iconArt) icon.append(iconArt);
      const copy = document.createElement('span'); copy.className = 'booking-service-copy';
      const name = document.createElement('strong'); name.textContent = item.name;
      const duration = document.createElement('small'); duration.textContent = `◷ ${item.duration} min`;
      const price = document.createElement('b'); price.textContent = priceLabel(item.priceCents);
      copy.append(name, duration); heading.append(icon, copy); details.append(heading, price);
      if (item.description) { const description = document.createElement('small'); description.textContent = item.description; details.append(description); }
      if (isAi) { const note = document.createElement('small'); note.className = 'booking-ai-note'; note.textContent = 'Imagem ilustrativa gerada por IA'; details.append(note); }
      button.append(photo, details);
      button.setAttribute('aria-label', `${item.name}, ${item.duration} minutos, ${priceLabel(item.priceCents)}`);
      button.addEventListener('click', () => {
        chosenService = item;
        if (preferredServiceId !== null) { preferredServiceId = item.id; showPreselected(); }
        services.querySelectorAll('button').forEach(card => card.setAttribute('aria-pressed', String(card === button)));
        checkService();
      });
      services.append(button);
    }
    if (preferredService && preferredServiceId === null) {
      const match = catalog.find(item => item.name === preferredService);
      preferredService = '';
      if (match) services.querySelectorAll('button')[catalog.indexOf(match)].click();
    }
  }
  function renderShowcase() {
    showcase.replaceChildren();
    showcaseStatus.textContent = '';
    window.aroldoServicesCatalog = catalog;
    window.aroldoServicesLoadError = false;
    window.dispatchEvent(new CustomEvent('aroldo:servicos-carregados', { detail: { services: catalog } }));
  }

  const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  function categoryService(category, cutName = '') {
    if (/barbaterapia|ozonio/.test(normalized(cutName))) {
      return catalog.find(item => /barbaterapia|ozonio/.test(normalized(item.name))) || null;
    }
    const classify = service => {
      const name = normalized(service.name);
      if (/barba|barbaterapia|ozonio/.test(name)) return 'barbas';
      if (/infantil|kids|crianca/.test(name)) return 'infantis';
      if (/corte|masculino|mullet|fade|moicano|militar|pompadour|undercut/.test(name)) return 'masculinos';
      return '';
    };
    return catalog.find(item => classify(item) === category) || null;
  }
  function handleCutChoice(event) {
    const detail = event.detail;
    if (!detail?.name || !['masculinos', 'infantis', 'barbas'].includes(detail.category)) return;
    preferredServiceId = null;
    showPreselected();
    selectedCut = { name: detail.name, category: detail.category, image: detail.image || '', priceCents: Number.isInteger(detail.priceCents) ? detail.priceCents : null };
    sessionStorage.setItem('aroldo-cut', JSON.stringify(selectedCut));
    const exact = catalog.find(item => normalized(item.name) === normalized(detail.name));
    preferredService = (exact || categoryService(detail.category, detail.name))?.name || '';
    window.aroldoNavigate?.('/agendamento');
    if (chosenTime) { renderServices(); show('service'); }
    else {
      show('agenda', false);
      loadAgenda();
    }
  }
  window.addEventListener('aroldo:selecionar-corte', handleCutChoice);
  function showPreselected() {
    const item = catalog.find(service => service.id === preferredServiceId);
    preselected.hidden = !item;
    preselected.textContent = item ? `✦ Serviço selecionado: ${item.name} · ${priceLabel(item.priceCents)}` : '';
  }
  window.addEventListener('aroldo:selecionar-servico', event => {
    const item = catalog.find(service => service.id === Number(event.detail?.id));
    if (!item) return;
    preferredService = '';
    preferredServiceId = item.id;
    chosenService = item;
    chosenTime = '';
    selectedCut = null;
    showPreselected();
    show('agenda', false);
    window.aroldoNavigate?.('/agendamento');
    loadAgenda();
  });
  async function checkService() {
    const sequence = ++checkSequence;
    next.disabled = true;
    if (!chosenService || !chosenTime) return false;
    say(serviceStatus, `${chosenService.name} · ${priceLabel(chosenService.priceCents)}. Conferindo o horário…`);
    try {
      const { slots: available } = await json(`/api/public/slots?day=${encodeURIComponent(day.value)}&serviceId=${chosenService.id}`);
      if (sequence !== checkSequence) return;
      if (available.some(item => item.time === chosenTime && item.status === 'available')) {
        next.disabled = false;
        say(serviceStatus, `${chosenService.name} · ${priceLabel(chosenService.priceCents)} · ${chosenService.duration} min`);
        return true;
      } else say(serviceStatus, 'Este serviço não cabe neste horário. Escolha outro serviço ou horário.', true);
    } catch (cause) { if (sequence === checkSequence) say(serviceStatus, cause.message, true); }
    return false;
  }
  function renderSummary() {
    const summary = document.getElementById('booking-summary');
    summary.replaceChildren();
    for (const line of [selectedCut ? `✂️ ${selectedCut.name} · serviço: ${chosenService.name}` : `✂️ ${chosenService.name}`, `📅 ${dateLabel(day.value)}`, `🕘 ${chosenTime}`, `💰 ${priceLabel(chosenService.priceCents)}`]) {
      const item = document.createElement('p'); item.textContent = line; summary.append(item);
    }
    if (chosenService.priceCents == null || chosenService.description?.includes('Preço provisório')) {
      const note = document.createElement('p'); note.textContent = 'Aroldo confirma o valor com você antes do atendimento.'; summary.append(note);
    }
  }
  next.addEventListener('click', () => { if (!next.disabled && chosenService) { renderSummary(); show('confirm'); } });
  document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.back === 'agenda') { chosenTime = ''; chosenService = null; loadAgenda(); }
    show(button.dataset.back);
  }));
  day.addEventListener('change', resetChoice);
  day.addEventListener('change', loadAgenda);
  day.addEventListener('change', () => {
    const difference = Math.floor((Date.parse(`${day.value}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
    dayOffset = Math.max(0, Math.floor(difference / 7) * 7);
    renderDays();
  });
  prevDays.addEventListener('click', () => { dayOffset = Math.max(0, dayOffset - 7); day.value = addDays(today, dayOffset); resetChoice(); loadAgenda(); });
  nextDays.addEventListener('click', () => { dayOffset = Math.min(56, dayOffset + 7); day.value = addDays(today, dayOffset); resetChoice(); loadAgenda(); });
  document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
    preferredServiceId = null;
    showPreselected();
    preferredService = link.dataset.service;
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!chosenService || !chosenTime || stage !== 'confirm') return;
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('booking-phone').value.replace(/\D/g, '');
    if (name.length < 2 || !/^\d{10,13}$/.test(phone)) { say(confirmStatus, 'Informe seu nome e WhatsApp com DDD.', true); return; }
    say(confirmStatus, 'Enviando seu pedido…');
    submit.disabled = true; submit.textContent = 'ENVIANDO…';
    try {
      const booking = await json('/api/public/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: chosenService.id, day: day.value, time: chosenTime, name, phone }) });
      result.replaceChildren();
      const title = document.createElement('h3'); title.textContent = 'Pronto! Agora é só aguardar a confirmação.';
      const detail = document.createElement('p'); detail.textContent = `${selectedCut ? `${selectedCut.name} · ` : ''}${booking.service} · ${dateLabel(booking.day)} às ${booking.time} · pedido #${booking.id}.`;
      const note = document.createElement('p'); note.textContent = 'Aroldo vê seu pedido no painel. O horário fica reservado por um período limitado enquanto aguarda.';
      const whatsapp = document.createElement('a'); whatsapp.className = 'button button-outline-gold';
      const whatsappMessage = `Olá, Aroldo! Pedi o horário #${booking.id} para ${booking.day} às ${booking.time}, serviço ${booking.service}${selectedCut ? `, estilo desejado ${selectedCut.name}` : ''}. Aguardo sua confirmação.`;
      whatsapp.href = `https://wa.me/5511948446801?text=${encodeURIComponent(whatsappMessage)}`;
      whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer'; whatsapp.textContent = 'Avisar pelo WhatsApp ↗';
      result.append(title, detail, note, whatsapp);
      show('result');
    } catch (cause) {
      say(confirmStatus, cause.message, true);
      const feedback = document.createElement('p'); feedback.className = 'booking-error'; feedback.textContent = cause.message;
      result.replaceChildren(feedback); result.hidden = false;
      if (/indisponível|conflito/i.test(cause.message)) { show('agenda'); await loadAgenda(); say(status, cause.message, true); }
    } finally { submit.disabled = false; submit.textContent = 'SOLICITAR AGENDAMENTO'; }
  });
  async function init() {
    renderDays();
    try {
      const config = await json('/api/public/config');
      slotMinutes = Number(config.slotMinutes) || 30;
      catalog = config.services;
      renderShowcase();
      if (!config.configured || !catalog.length) {
        say(status, 'Agenda em configuração. Confirme pelo WhatsApp.');
        return;
      }
      ready = true;
      await loadAgenda();
    } catch {
      say(status, navigator.onLine ? 'Agenda indisponível no momento. Tente novamente ou fale pelo WhatsApp.' : 'Você está offline. Conecte-se para consultar a agenda.', true);
      window.aroldoServicesLoadError = true;
      window.dispatchEvent(new Event('aroldo:servicos-erro'));
    }
  }
  init();
  setInterval(() => {
    if (document.hidden || !catalog.length) return;
    if (stage === 'agenda') loadAgenda();
    else if (stage === 'service' || stage === 'confirm') checkService();
  }, 30000);
})();
