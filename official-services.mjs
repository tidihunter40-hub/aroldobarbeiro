// Valores transcritos das imagens enviadas pelo responsável em 26/10/2026.
// Durações são provisórias até confirmação; a tabela enviada não as informa.
export const officialServices = [
  { name: 'Corte com máquina', priceCents: 3500, duration: 30, description: 'Corte com máquina e acabamento profissional.' },
  { name: 'Corte na tesoura', priceCents: 4000, duration: 30, description: 'Corte na tesoura com acabamento profissional.' },
  { name: 'Corte infantil', priceCents: 4000, duration: 30, description: 'Corte infantil com estilo e cuidado especial.' },
  { name: 'Pezinho', priceCents: 1000, duration: 30, description: 'Acabamento na nuca para um visual mais limpo.' },
  { name: 'Sobrancelha', priceCents: 1000, duration: 30, description: 'Design e alinhamento da sobrancelha.' },
  { name: 'Hidratação', priceCents: 3000, duration: 30, description: 'Tratamento para um cabelo mais forte e saudável.' },
  { name: 'Relaxamento capilar', priceCents: 3500, duration: 60, description: 'Reduz o volume e alinha os fios.' },
  { name: 'Barba simples', priceCents: 2000, duration: 30, description: 'Redefinição e acabamento da barba.' },
  { name: 'Barba com espuma quente', priceCents: 2500, duration: 30, description: 'Higienização, preparo com espuma quente e acabamento.' },
  { name: 'Barboterapia com vapor de ozônio', priceCents: 3000, duration: 60, description: 'Limpeza profunda, hidratação e cuidado completo.' },
  { name: 'Nevou', priceCents: 20000, duration: 180, description: '' },
  { name: 'Luzes', priceCents: 10000, duration: 120, description: '' },
  { name: 'Luzes platinadas', priceCents: 15000, duration: 150, description: '' },
  { name: 'Pigmentar cabelo', priceCents: 3500, duration: 30, description: '' },
  { name: 'Pigmentar barba', priceCents: 3000, duration: 30, description: '' },
  { name: 'Banho de brilho', priceCents: 4000, duration: 30, description: '' },
  { name: 'Cabelo + barba simples', priceCents: 5000, duration: 60, description: '' },
  { name: 'Cabelo + barba com espuma quente', priceCents: 5500, duration: 60, description: '' },
  { name: 'Cabelo + barboterapia com vapor de ozônio', priceCents: 6000, duration: 90, description: '' }
];

export function mergeOfficialServices(settings) {
  const officialByName = new Map(officialServices.map(service => [service.name, service]));
  const existing = new Set(settings.services.map(service => service.name));
  settings.services = settings.services.map(service => {
    const official = officialByName.get(service.name);
    if (official) return { ...service, enabled: true, priceCents: official.priceCents, description: official.description };
    return { ...service, enabled: false };
  });
  for (const service of officialServices) {
    if (!existing.has(service.name)) settings.services.push({ ...service, id: null, enabled: true, photoUrl: null });
  }
  return settings;
}
