(() => {
  const form = document.getElementById('booking-form');
  const service = document.getElementById('service');
  const day = document.getElementById('booking-day');
  const slots = document.getElementById('booking-slots');
  const status = document.getElementById('booking-status');
  const result = document.getElementById('booking-result');
  const submit = form.querySelector('button[type="submit"]');
  const timezone = 'America/Bahia';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  day.min = today;
  day.max = new Date(Date.parse(`${today}T12:00:00Z`) + 60 * 86400000).toISOString().slice(0, 10);
  day.value = today;
  let chosen = '';
  let sequence = 0;
  const message = (text, isError = false) => { status.textContent = text; status.classList.toggle('error', isError); };
  async function json(url, options) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a agenda.');
    return data;
  }
  async function refresh() {
    const current = ++sequence;
    chosen = '';
    slots.replaceChildren();
    submit.disabled = true;
    if (!service.value || !day.value) { message('Escolha um serviço e uma data.'); return; }
    message('Consultando horários…');
    try {
      const data = await json(`/api/public/slots?day=${encodeURIComponent(day.value)}&serviceId=${encodeURIComponent(service.value)}`);
      if (current !== sequence) return;
      if (!data.slots.length) { message('Sem horários para esta data. Escolha outro dia.'); return; }
      message('Selecione um horário disponível.');
      data.slots.forEach(slot => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `slot slot-${slot.status}`;
        button.textContent = `${slot.time} · ${{ available: 'Disponível', pending: 'Aguardando', confirmed: 'Ocupado', blocked: 'Ocupado' }[slot.status]}`;
        button.disabled = slot.status !== 'available';
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          chosen = slot.time;
          slots.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
          submit.disabled = false;
          message(`Horário selecionado: ${chosen}.`);
        });
        slots.append(button);
      });
    } catch (cause) { if (current === sequence) message(`${cause.message} Verifique a conexão e tente novamente.`, true); }
  }
  async function init() {
    try {
      const data = await json('/api/public/config');
      service.replaceChildren(new Option('Selecione um serviço', ''));
      data.services.forEach(item => service.add(new Option(`${item.name} · ${item.duration} min`, item.id)));
      if (!data.configured) { message('Agenda ainda não configurada. Fale com Aroldo pelo WhatsApp.'); return; }
      message('Escolha um serviço e uma data.');
      const requested = sessionStorage.getItem('aroldo-service');
      if (requested) {
        const option = [...service.options].find(item => item.textContent.startsWith(requested + ' ·'));
        if (option) { service.value = option.value; refresh(); }
        sessionStorage.removeItem('aroldo-service');
      }
    } catch (cause) { message('Agenda indisponível no momento. Verifique a conexão ou fale pelo WhatsApp.', true); }
  }
  service.addEventListener('change', () => { result.replaceChildren(); refresh(); });
  day.addEventListener('change', () => { result.replaceChildren(); refresh(); });
  document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => sessionStorage.setItem('aroldo-service', link.dataset.service)));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!chosen) { message('Selecione um horário.'); return; }
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('booking-phone').value.replace(/\D/g, '');
    if (name.length < 2 || !/^\d{10,13}$/.test(phone)) { message('Informe nome e telefone com DDD.', true); return; }
    submit.disabled = true;
    message('Registrando solicitação…');
    try {
      const booking = await json('/api/public/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId: Number(service.value), day: day.value, time: chosen, name, phone }) });
      result.replaceChildren();
      const description = document.createElement('p');
      description.textContent = `Solicitação #${booking.id} registrada para ${booking.day} às ${booking.time}. A confirmação será feita por Aroldo no sistema. A reserva pendente expira em ${new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(booking.expiresAt))}.`;
      const whatsapp = document.createElement('a');
      whatsapp.className = 'button button-outline-gold';
      whatsapp.href = `https://wa.me/5511948446801?text=${encodeURIComponent(`Olá, Aroldo! Fiz a solicitação #${booking.id} para ${booking.day} às ${booking.time}, serviço ${booking.service}. Aguardo sua confirmação no sistema.`)}`;
      whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer';
      whatsapp.textContent = 'Avisar pelo WhatsApp ↗';
      result.append(description, whatsapp);
      message('Solicitação registrada. Ainda aguarda confirmação.');
      await refresh();
      result.replaceChildren(description, whatsapp);
    } catch (cause) { message(cause.message, true); await refresh(); }
  });
  init();
  setInterval(() => { if (!document.hidden && service.value && day.value) refresh(); }, 30000);
})();
