(() => {
  const form = document.getElementById('booking-form');
  const day = document.getElementById('booking-day');
  const dayChoices = document.getElementById('booking-day-choices');
  const morningSlots = document.getElementById('booking-slots-morning');
  const afternoonSlots = document.getElementById('booking-slots-afternoon');
  const prevDays = document.getElementById('booking-days-prev');
  const nextDays = document.getElementById('booking-days-next');
  const services = document.getElementById('booking-services');
  const showcase = document.getElementById('booking-catalog-showcase');
  const showcaseStatus = document.getElementById('showcase-status');
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
  const say = (element, value, bad = false) => { element.textContent = value; element.classList.toggle('error', bad); };
  let catalog = [];
  let chosenTime = '';
  let chosenService = null;
  let stage = 'agenda';
  let agendaSequence = 0;
  let checkSequence = 0;
  let preferredService = sessionStorage.getItem('aroldo-service') || '';
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
    chosenTime = ''; chosenService = null; next.disabled = true;
    result.replaceChildren();
    renderDays();
    show('agenda', false);
  }
  function renderPreviewSlots() {
    morningSlots.replaceChildren();
    afternoonSlots.replaceChildren();
    const examples = [
      ['08:00','available'],['08:30','available'],['09:00','blocked'],['09:30','available'],
      ['10:00','available'],['10:30','available'],['11:00','pending'],['11:30','available'],
      ['14:00','available'],['14:30','available'],['15:00','blocked'],['15:30','available'],
      ['16:00','available'],['16:30','available'],['17:00','unavailable']
    ];
    const labels = { available: 'Livre', blocked: 'Ocupado', pending: 'Pendente', unavailable: 'Indisponível' };
    for (const [hour, state] of examples) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `slot slot-${state}`;
      card.disabled = true;
      card.setAttribute('aria-label', `${hour}, exemplo visual; agenda indisponível`);
      const time = document.createElement('strong'); time.textContent = hour;
      const label = document.createElement('small'); label.textContent = labels[state];
      card.append(time, label);
      (Number(hour.slice(0, 2)) < 14 ? morningSlots : afternoonSlots).append(card);
    }
  }
  async function loadAgenda() {
    if (!ready) { say(status, 'Horários ilustrativos: agenda ainda não configurada. Fale com Aroldo pelo WhatsApp.'); return; }
    const sequence = ++agendaSequence;
    morningSlots.replaceChildren();
    afternoonSlots.replaceChildren();
    say(status, 'Buscando horários…');
    if (!day.value || day.value < day.min || day.value > day.max) { say(status, 'Escolha uma data nos próximos 60 dias.', true); return; }
    try {
      const { slots: entries } = await json(`/api/public/agenda?day=${encodeURIComponent(day.value)}`);
      if (sequence !== agendaSequence) return;
      if (!entries.length) { say(status, 'Sem horários neste dia. Escolha outra data.'); return; }
      say(status, '');
      const labels = { available: 'Livre', pending: 'Pendente', confirmed: 'Agendado', blocked: 'Ocupado', unavailable: 'Indisponível' };
      for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = `slot slot-${entry.status}`;
        const time = document.createElement('strong');
        time.textContent = entry.time;
        const state = document.createElement('small');
        state.textContent = labels[entry.status] || 'Ocupado';
        button.append(time, state);
        button.setAttribute('aria-label', `${entry.time}, ${labels[entry.status] || 'Ocupado'}`);
        button.disabled = entry.status !== 'available';
        button.addEventListener('click', () => {
          chosenTime = entry.time; chosenService = null; next.disabled = true;
          renderServices(); show('service');
        });
        (Number(entry.time.slice(0, 2)) < 14 ? morningSlots : afternoonSlots).append(button);
      }
    } catch (cause) { if (sequence === agendaSequence) say(status, `${cause.message} Tente novamente.`, true); }
  }
  function renderServices() {
    services.replaceChildren();
    say(serviceStatus, 'Escolha um serviço para este horário.');
    for (const item of catalog) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'booking-service-card';
      button.setAttribute('aria-pressed', String(chosenService?.id === item.id));
      const photo = document.createElement('img');
      const isAi = item.photoUrl.includes('/cortes-ia/');
      photo.src = item.photoUrl; photo.alt = isAi ? `Imagem ilustrativa gerada por IA: ${item.name}` : `Foto do serviço: ${item.name}`; photo.loading = 'lazy';
      const details = document.createElement('span'); details.className = 'booking-service-details';
      const name = document.createElement('strong'); name.textContent = item.name;
      const duration = document.createElement('small'); duration.textContent = `${item.duration} min`;
      const price = document.createElement('b'); price.textContent = money(item.priceCents);
      details.append(name, duration, price);
      if (item.description) { const description = document.createElement('small'); description.textContent = item.description; details.append(description); }
      if (isAi) { const note = document.createElement('small'); note.className = 'booking-ai-note'; note.textContent = 'Imagem ilustrativa gerada por IA'; details.append(note); }
      button.append(photo, details);
      button.addEventListener('click', () => {
        chosenService = item;
        services.querySelectorAll('button').forEach(card => card.setAttribute('aria-pressed', String(card === button)));
        checkService();
      });
      services.append(button);
    }
    if (preferredService) {
      const match = catalog.find(item => item.name === preferredService);
      preferredService = '';
      if (match) services.querySelectorAll('button')[catalog.indexOf(match)].click();
    }
  }
  function renderShowcase() {
    showcase.replaceChildren();
    if (!catalog.length) { showcaseStatus.textContent = 'Os cortes e preços estão em atualização.'; return; }
    showcaseStatus.textContent = '';
    for (const item of catalog) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'showcase-card';
      card.setAttribute('aria-label', `${item.name}, ${money(item.priceCents)}. Escolher horário`);
      const photo = document.createElement('img'); photo.src = item.photoUrl;
      photo.alt = item.photoUrl.includes('/cortes-ia/') ? `Ilustração de IA: ${item.name}` : `Foto do serviço: ${item.name}`;
      photo.loading = 'lazy';
      const details = document.createElement('span'); details.className = 'showcase-details';
      const title = document.createElement('strong'); title.textContent = item.name;
      const duration = document.createElement('small'); duration.textContent = `${item.duration} min`;
      const price = document.createElement('b'); price.textContent = money(item.priceCents);
      const action = document.createElement('small'); action.className = 'showcase-action'; action.textContent = 'Escolher horário →';
      details.append(title, duration, price);
      if (item.description) { const note = document.createElement('small'); note.textContent = item.description; details.append(note); }
      details.append(action); card.append(photo, details);
      card.addEventListener('click', () => {
        preferredService = item.name;
        if (chosenTime) { renderServices(); show('service'); }
        else { show('agenda'); loadAgenda(); }
      });
      showcase.append(card);
    }
  }
  async function checkService() {
    const sequence = ++checkSequence;
    next.disabled = true;
    if (!chosenService || !chosenTime) return;
    say(serviceStatus, `${chosenService.name} · ${money(chosenService.priceCents)}. Conferindo o horário…`);
    try {
      const { slots: available } = await json(`/api/public/slots?day=${encodeURIComponent(day.value)}&serviceId=${chosenService.id}`);
      if (sequence !== checkSequence) return;
      if (available.some(item => item.time === chosenTime && item.status === 'available')) {
        next.disabled = false;
        say(serviceStatus, `${chosenService.name} · ${money(chosenService.priceCents)} · ${chosenService.duration} min`);
      } else say(serviceStatus, 'Este serviço não cabe neste horário. Escolha outro serviço ou horário.', true);
    } catch (cause) { if (sequence === checkSequence) say(serviceStatus, cause.message, true); }
  }
  function renderSummary() {
    const summary = document.getElementById('booking-summary');
    summary.replaceChildren();
    for (const line of [`✂️ ${chosenService.name}`, `📅 ${dateLabel(day.value)}`, `🕘 ${chosenTime}`, `💰 ${money(chosenService.priceCents)}`]) {
      const item = document.createElement('p'); item.textContent = line; summary.append(item);
    }
    if (chosenService.description?.includes('Preço provisório')) {
      const note = document.createElement('p'); note.textContent = 'Preço provisório. Aroldo confirma o valor com você.'; summary.append(note);
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
  document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => { preferredService = link.dataset.service; }));
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
      const detail = document.createElement('p'); detail.textContent = `${booking.service} · ${dateLabel(booking.day)} às ${booking.time} · pedido #${booking.id}.`;
      const note = document.createElement('p'); note.textContent = 'Aroldo vê seu pedido no painel. O horário fica reservado por um período limitado enquanto aguarda.';
      const whatsapp = document.createElement('a'); whatsapp.className = 'button button-outline-gold';
      whatsapp.href = `https://wa.me/5511948446801?text=${encodeURIComponent(`Olá, Aroldo! Pedi o horário #${booking.id} para ${booking.day} às ${booking.time}, serviço ${booking.service}. Aguardo sua confirmação.`)}`;
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
      catalog = config.services.filter(item => item.photoUrl && Number.isInteger(item.priceCents));
      renderShowcase();
      if (!config.configured || !catalog.length) {
        renderPreviewSlots();
        say(status, 'Horários ilustrativos: agenda em configuração. Confirme pelo WhatsApp.');
        return;
      }
      ready = true;
      await loadAgenda();
    } catch {
      renderPreviewSlots();
      say(status, 'Horários ilustrativos: agenda indisponível. Confirme pelo WhatsApp.', true);
    }
  }
  init();
  setInterval(() => {
    if (document.hidden || !catalog.length) return;
    if (stage === 'agenda') loadAgenda();
    else if (stage === 'service' || stage === 'confirm') checkService();
  }, 30000);
})();
