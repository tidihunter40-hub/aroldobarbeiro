-- Execute after 2026-10-26-admin-agenda.sql. Prices come from the owner's table.
-- Durations for newly created services are provisional until the owner confirms them.
-- Existing appointments, service records, photos and configured durations are preserved.
-- Services outside the owner's current table remain in history but become inactive.
begin;
select pg_advisory_xact_lock(hashtext('aroldo:settings'));

update public.aroldo_services set enabled = false
where name not in (
  'Corte com máquina', 'Corte na tesoura', 'Corte infantil', 'Pezinho', 'Sobrancelha',
  'Hidratação', 'Relaxamento capilar', 'Barba simples', 'Barba com espuma quente',
  'Barboterapia com vapor de ozônio', 'Nevou', 'Luzes', 'Luzes platinadas',
  'Pigmentar cabelo', 'Pigmentar barba', 'Banho de brilho',
  'Cabelo + barba simples', 'Cabelo + barba com espuma quente',
  'Cabelo + barboterapia com vapor de ozônio');

do $$
declare item record;
begin
  for item in
    select * from (values
      ('Corte com máquina', 3500, 30, 'Corte com máquina e acabamento profissional.'),
      ('Corte na tesoura', 4000, 30, 'Corte na tesoura com acabamento profissional.'),
      ('Corte infantil', 4000, 30, 'Corte infantil com estilo e cuidado especial.'),
      ('Pezinho', 1000, 30, 'Acabamento na nuca para um visual mais limpo.'),
      ('Sobrancelha', 1000, 30, 'Design e alinhamento da sobrancelha.'),
      ('Hidratação', 3000, 30, 'Tratamento para um cabelo mais forte e saudável.'),
      ('Relaxamento capilar', 3500, 60, 'Reduz o volume e alinha os fios.'),
      ('Barba simples', 2000, 30, 'Redefinição e acabamento da barba.'),
      ('Barba com espuma quente', 2500, 30, 'Higienização, preparo com espuma quente e acabamento.'),
      ('Barboterapia com vapor de ozônio', 3000, 60, 'Limpeza profunda, hidratação e cuidado completo.'),
      ('Nevou', 20000, 180, ''),
      ('Luzes', 10000, 120, ''),
      ('Luzes platinadas', 15000, 150, ''),
      ('Pigmentar cabelo', 3500, 30, ''),
      ('Pigmentar barba', 3000, 30, ''),
      ('Banho de brilho', 4000, 30, ''),
      ('Cabelo + barba simples', 5000, 60, ''),
      ('Cabelo + barba com espuma quente', 5500, 60, ''),
      ('Cabelo + barboterapia com vapor de ozônio', 6000, 90, '')
    ) as catalog(name, price_cents, duration, description)
  loop
    update public.aroldo_services
      set price_cents = item.price_cents, description = nullif(item.description, ''), enabled = true
      where name = item.name;
    if not found then
      insert into public.aroldo_services(id, name, duration, enabled, price_cents, photo_url, description)
      values((select coalesce(max(id), 0) + 1 from public.aroldo_services), item.name,
        item.duration, true, item.price_cents, null, nullif(item.description, ''));
    end if;
  end loop;
end $$;

-- The database keeps historical service rows. Allow the admin panel to save them
-- after the 19 official services are added, without deleting booking history.
do $$
declare definition text;
  old_limit text := 'jsonb_array_length\s*\(\s*p_input\s*->\s*''services''\s*\)\s*>\s*40';
begin
  select pg_get_functiondef('public.aroldo_settings_update(jsonb)'::regprocedure) into definition;
  if definition ~ old_limit then
    execute regexp_replace(definition, old_limit,
      'jsonb_array_length(p_input->''services'') > 100', 'g');
  elsif definition !~ 'jsonb_array_length\s*\(\s*p_input\s*->\s*''services''\s*\)\s*>\s*100' then
    raise notice 'Service limit pattern not found; admin function was not changed.';
  end if;
end $$;
commit;
