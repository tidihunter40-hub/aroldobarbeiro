(() => {
  const loginPanel = document.getElementById('login-panel');
  const dashboard = document.getElementById('dashboard');
  const notice = document.getElementById('notice');
  const agendaDay = document.getElementById('agenda-day');
  const range = document.getElementById('agenda-range');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  agendaDay.value = today;
  document.querySelector('[name=day]').value = today;
  let settings;
  let agendaSequence = 0;
  const say = (message, bad = false) => { notice.textContent = message; notice.classList.toggle('error', bad); };
  async function json(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha na operação.');
    return data;
  }
  const send = (url, method, value = {}) => json(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  function showDashboard(on) { dashboard.hidden = !on; loginPanel.hidden = on; document.getElementById('logout').hidden = !on; }
  function node(tag, value, className) { const element = document.createElement(tag); if (value != null) element.textContent = value; if (className) element.className = className; return element; }
  async function loadAgenda() {
    const sequence = ++agendaSequence;
    const start = agendaDay.value;
    const end = range.value === 'week' ? new Date(Date.parse(`${start}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10) : start;
    try {
      const [{ appointments }, agenda] = await Promise.all([
        json(`/api/admin/appointments?from=${start}&to=${end}`),
        start >= today ? json(`/api/public/agenda?day=${start}`) : Promise.resolve({ slots: [] })
      ]);
      if (sequence !== agendaSequence) return;
      const grid = document.getElementById('admin-slots'); grid.replaceChildren();
      if (!agenda.slots.length) grid.append(node('p', 'Sem horários neste dia. Confira o expediente, as folgas ou a data escolhida.'));
      for (const slot of agenda.slots) {
        const active = appointments.find(item => item.day === start && item.status === 'blocked' &&
          item.starts <= Number(slot.time.slice(0, 2)) * 60 + Number(slot.time.slice(3)) &&
          item.ends > Number(slot.time.slice(0, 2)) * 60 + Number(slot.time.slice(3)));
        const labels = { available: 'Livre', pending: 'Pendente', confirmed: 'Agendado', blocked: active ? 'Ocupado' : 'Indisponível', unavailable: 'Indisponível' };
        const button = node('button', `${slot.time} · ${labels[slot.status]}`, `admin-slot admin-slot-${slot.status}`);
        button.type = 'button'; button.disabled = slot.status !== 'available' && !active;
        if (slot.status === 'available' || active) button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            if (active) await send(`/api/admin/blocks/${active.id}`, 'DELETE');
            else await send('/api/admin/blocks', 'POST', { day: start, time: slot.time, duration: settings?.slotMinutes || 30 });
            say(active ? 'Horário liberado.' : 'Horário ocupado.'); await loadAgenda();
          } catch (cause) { say(cause.message, true); button.disabled = false; }
        });
        grid.append(button);
      }
      const target = document.getElementById('appointments');
      target.replaceChildren();
      if (!appointments.length) { target.append(node('p', 'Nenhuma solicitação ou bloqueio neste período.')); return; }
      for (const item of appointments) {
        const card = node('article', null, `appointment ${item.status}`);
        const details = node('div');
        details.append(node('strong', `${item.day} · ${item.time}–${item.endTime}`), node('p', `${item.service || 'Bloqueio manual'} · ${{ pending: 'Aguardando confirmação', confirmed: 'Confirmado', blocked: 'Bloqueado', cancelled: 'Cancelado', expired: 'Expirado' }[item.status]}`));
        if (item.name) details.append(node('p', `${item.name} · ${item.phone}`));
        card.append(details);
        const actions = node('div', null, 'actions');
        const action = (label, type, className) => {
          const button = node('button', label, className); button.type = 'button';
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              if (type === 'unblock') await send(`/api/admin/blocks/${item.id}`, 'DELETE');
              else await send(`/api/admin/appointments/${item.id}/${type}`, 'POST');
              say('Agenda atualizada.'); await loadAgenda();
            } catch (cause) { say(cause.message, true); button.disabled = false; }
          });
          actions.append(button);
        };
        if (item.status === 'pending') { action('Confirmar', 'confirm'); action('Recusar', 'cancel', 'cancel'); }
        if (item.status === 'confirmed') action('Cancelar', 'cancel', 'cancel');
        if (item.status === 'blocked') action('Liberar', 'unblock', 'cancel');
        card.append(actions); target.append(card);
      }
    } catch (cause) { say(cause.message, true); }
  }
  function serviceRow(item = { id: '', name: '', duration: 30, priceCents: null, photoUrl: null, description: '', enabled: false }) {
    const row = node('div', null, 'setting-row service-setting'); row.dataset.id = item.id;
    row.dataset.photoUrl = item.photoUrl || '';
    const preview = document.createElement('img'); preview.className = 'service-preview';
    preview.alt = item.photoUrl ? `Foto de ${item.name}` : 'Foto ainda não cadastrada';
    if (item.photoUrl) preview.src = item.photoUrl;
    const field = (label, type, value, className) => {
      const wrapper = node('label', label, className);
      const input = document.createElement('input'); input.type = type; input.value = value ?? '';
      wrapper.append(input); return wrapper;
    };
    const name = field('Nome', 'text', item.name, 'service-name'); name.querySelector('input').maxLength = 80;
    const price = field('Preço (R$)', 'number', item.priceCents == null ? '' : (item.priceCents / 100).toFixed(2), 'service-price');
    const priceInput = price.querySelector('input'); priceInput.min = 0; priceInput.max = 100000; priceInput.step = '0.01'; priceInput.inputMode = 'decimal';
    const duration = field('Duração (min)', 'number', item.duration, 'service-duration');
    const durationInput = duration.querySelector('input'); durationInput.min = 30; durationInput.max = 480; durationInput.step = 30;
    const photo = field('Foto real (JPG, PNG ou WebP, até 3 MB)', 'file', '', 'service-photo');
    photo.querySelector('input').accept = 'image/jpeg,image/png,image/webp';
    photo.querySelector('input').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 3145728) { say('Escolha uma foto de até 3 MB.', true); return; }
      say('Enviando foto…');
      try {
        const response = await fetch('/api/admin/service-photo', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a foto.');
        row.dataset.photoUrl = data.photoUrl; preview.src = data.photoUrl; preview.alt = `Foto de ${name.querySelector('input').value || 'serviço'}`;
        ai.textContent = '';
        say('Foto enviada. Salve as configurações para usar no serviço.');
      } catch (cause) { say(cause.message, true); }
    });
    const active = node('label', 'Mostrar na agenda', 'service-active');
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = item.enabled;
    active.append(enabled);
    const description = field('Descrição (opcional)', 'text', item.description || '', 'service-description');
    description.querySelector('input').maxLength = 240;
    const ai = node('span', item.photoUrl?.includes('/cortes-ia/') ? 'Imagem ilustrativa gerada por IA' : '', 'service-ai-note');
    row.append(preview, name, price, duration, description, photo, active, ai);
    document.getElementById('services-settings').append(row);
    return row;
  }
  function specialHourRow(item = { day: '', opens: '08:00', closes: '17:00', breakStart: '12:00', breakEnd: '14:00' }) {
    const row = node('div', null, 'setting-row special-hour-row');
    for (const [key, label, type] of [['day','Data','date'],['opens','Abre','time'],['closes','Fecha','time'],['breakStart','Intervalo início','time'],['breakEnd','Intervalo fim','time']]) {
      const wrapper = node('label', label); const input = document.createElement('input');
      input.type = type; input.dataset.key = key; input.value = item[key] || ''; wrapper.append(input); row.append(wrapper);
    }
    const remove = node('button', 'Remover', 'remove-special'); remove.type = 'button'; remove.addEventListener('click', () => row.remove()); row.append(remove);
    document.getElementById('special-hours-settings').append(row);
  }
  function renderSettings() {
    const services = document.getElementById('services-settings'); services.replaceChildren();
    for (const item of settings.services) serviceRow(item);
    const hours = document.getElementById('hours-settings'); hours.replaceChildren();
    const names = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    for (const item of settings.hours) {
      const row = node('div', null, 'setting-row'); row.dataset.weekday = item.weekday; row.append(node('strong', names[item.weekday], 'weekday'));
      for (const [key, label] of [['opens','Abre'],['closes','Fecha'],['breakStart','Intervalo início'],['breakEnd','Intervalo fim']]) {
        const wrapper = node('label', label); const input = document.createElement('input'); input.type = 'time'; input.dataset.key = key; input.value = item[key] || ''; wrapper.append(input); row.append(wrapper);
      }
      hours.append(row);
    }
    document.getElementById('days-off').value = settings.daysOff.join(', ');
    document.getElementById('pending-minutes').value = settings.pendingMinutes;
    document.getElementById('slot-minutes').value = settings.slotMinutes || 30;
    const step = settings.slotMinutes || 30;
    const blockTime = document.querySelector('#block-form [name=time]');
    const blockDuration = document.querySelector('#block-form [name=duration]');
    blockTime.step = String(step * 60);
    blockDuration.min = String(step); blockDuration.step = String(step); blockDuration.value = String(step);
    document.getElementById('special-hours-settings').replaceChildren();
    for (const item of settings.specialHours || []) specialHourRow(item);
  }
  async function loadSettings() { settings = await json('/api/admin/settings'); renderSettings(); }
  document.getElementById('add-service').addEventListener('click', () => serviceRow());
  document.getElementById('import-catalog').addEventListener('click', async () => {
    try {
      const catalog = await json('./catalogo-ia.json'); let added = 0;
      for (const item of catalog) {
        const names = [...document.querySelectorAll('.service-name input')].map(input => input.value.trim().toLocaleLowerCase('pt-BR'));
        if (!names.includes(item.name.toLocaleLowerCase('pt-BR'))) { serviceRow({ ...item, id: '', enabled: false }); added++; }
      }
      say(`${added} cortes adicionados como rascunho. Os preços são provisórios; revise antes de salvar e ativar.`);
    } catch (cause) { say(cause.message, true); }
  });
  document.getElementById('apply-official-hours').addEventListener('click', () => {
    document.querySelectorAll('#hours-settings .setting-row').forEach(row => {
      const open = Number(row.dataset.weekday) !== 0;
      for (const [key, value] of [['opens','08:00'],['closes','17:00'],['breakStart','12:00'],['breakEnd','14:00']])
        row.querySelector(`[data-key=${key}]`).value = open ? value : '';
    });
    say('Expediente de segunda a sábado preparado. Salve as configurações.');
  });
  document.getElementById('add-special-hours').addEventListener('click', () => specialHourRow());
  document.getElementById('slot-minutes').addEventListener('change', event => {
    const step = Number(event.target.value);
    document.querySelector('#block-form [name=time]').step = String(step * 60);
    const duration = document.querySelector('#block-form [name=duration]');
    duration.min = String(step); duration.step = String(step); duration.value = String(step);
  });
  async function enter() { showDashboard(true); await loadSettings(); await loadAgenda(); say('Agenda atualizada.'); }
  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await send('/api/admin/login', 'POST', { password: document.getElementById('password').value }); document.getElementById('password').value = ''; await enter(); }
    catch (cause) { say(cause.message, true); }
  });
  document.getElementById('logout').addEventListener('click', async () => { try { await send('/api/admin/logout', 'POST'); } finally { showDashboard(false); say('Você saiu da agenda.'); } });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.getElementById('agenda-view').hidden = button.dataset.view !== 'agenda';
    document.getElementById('settings-view').hidden = button.dataset.view !== 'settings';
  }));
  agendaDay.addEventListener('change', loadAgenda); range.addEventListener('change', loadAgenda);
  document.getElementById('block-form').addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    try { await send('/api/admin/blocks', 'POST', { day: data.get('day'), time: data.get('time'), duration: Number(data.get('duration')) }); say('Horário bloqueado.'); await loadAgenda(); }
    catch (cause) { say(cause.message, true); }
  });
  document.getElementById('settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const services = [...document.querySelectorAll('#services-settings .service-setting')].map(row => {
      const price = row.querySelector('.service-price input').value;
      return { id: row.dataset.id ? Number(row.dataset.id) : null,
        name: row.querySelector('.service-name input').value.trim(),
        priceCents: price === '' ? null : Math.round(Number(price) * 100),
        duration: Number(row.querySelector('.service-duration input').value),
        photoUrl: row.dataset.photoUrl || null,
        description: row.querySelector('.service-description input').value.trim(),
        enabled: row.querySelector('.service-active input').checked };
    });
    const hours = [...document.querySelectorAll('#hours-settings .setting-row')].map(row => {
      const record = { weekday: Number(row.dataset.weekday) };
      row.querySelectorAll('input').forEach(input => record[input.dataset.key] = input.value);
      return record;
    });
    const daysOff = document.getElementById('days-off').value.split(',').map(value => value.trim()).filter(Boolean);
    const specialHours = [...document.querySelectorAll('#special-hours-settings .special-hour-row')].map(row => {
      const item = {}; row.querySelectorAll('input').forEach(input => item[input.dataset.key] = input.value); return item;
    });
    try { settings = await send('/api/admin/settings', 'PUT', { services, hours, daysOff, specialHours,
      slotMinutes: Number(document.getElementById('slot-minutes').value), pendingMinutes: Number(document.getElementById('pending-minutes').value) });
      say('Configurações salvas.'); renderSettings(); await loadAgenda(); }
    catch (cause) { say(cause.message, true); }
  });
  json('/api/admin/settings').then(value => { settings = value; renderSettings(); showDashboard(true); return loadAgenda(); }).then(() => say('Agenda atualizada.')).catch(() => { showDashboard(false); say('Entre para consultar a agenda.'); });
  setInterval(() => { if (!document.hidden && !dashboard.hidden) loadAgenda(); }, 15000);
})();
