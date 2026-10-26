-- Run once in the SQL Editor of project zjegmzuwducmaffcorut.
-- All business data is accessed only by the Vercel function with the secret key.
create table if not exists public.aroldo_services (
  id integer primary key, name text not null unique,
  duration integer not null default 30 check (duration between 30 and 480 and duration % 30 = 0),
  enabled boolean not null default false
);
create table if not exists public.aroldo_hours (
  weekday integer primary key check (weekday between 0 and 6),
  opens text, closes text, break_start text, break_end text
);
create table if not exists public.aroldo_days_off (day date primary key);
create table if not exists public.aroldo_settings (
  id integer primary key default 1 check (id = 1),
  pending_minutes integer not null default 30 check (pending_minutes between 5 and 1440)
);
create table if not exists public.aroldo_appointments (
  id bigint generated always as identity primary key,
  day date not null, starts integer not null, ends integer not null,
  service_id integer references public.aroldo_services(id),
  client_name text, phone text,
  status text not null check (status in ('pending','confirmed','cancelled','blocked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts >= 0 and ends <= 1440 and starts < ends)
);
create index if not exists aroldo_appointments_day_idx on public.aroldo_appointments(day, status, starts, ends);
create table if not exists public.aroldo_limits (
  scope text not null, client_hash text not null,
  until_at timestamptz not null, requests integer not null default 0,
  primary key (scope, client_hash)
);

insert into public.aroldo_services(id,name) values
  (1,'Corte masculino'),(2,'Barba'),(3,'Corte infantil'),(4,'Platinado'),
  (5,'Desondulação capilar'),(6,'Freestyle'),(7,'Visagismo'),(8,'Prótese capilar')
on conflict (id) do nothing;
insert into public.aroldo_hours(weekday) select generate_series(0,6) on conflict do nothing;
insert into public.aroldo_settings(id) values (1) on conflict do nothing;

alter table public.aroldo_services enable row level security;
alter table public.aroldo_hours enable row level security;
alter table public.aroldo_days_off enable row level security;
alter table public.aroldo_settings enable row level security;
alter table public.aroldo_appointments enable row level security;
alter table public.aroldo_limits enable row level security;
revoke all on public.aroldo_services, public.aroldo_hours, public.aroldo_days_off,
  public.aroldo_settings, public.aroldo_appointments, public.aroldo_limits from anon, authenticated;
grant all on public.aroldo_services, public.aroldo_hours, public.aroldo_days_off,
  public.aroldo_settings, public.aroldo_appointments, public.aroldo_limits to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.aroldo_active(p_day date)
returns table(id bigint, starts integer, ends integer, status text)
language sql stable set search_path = public as $$
  select a.id,a.starts,a.ends,a.status from public.aroldo_appointments a
  where a.day=p_day and (a.status in ('confirmed','blocked') or
    (a.status='pending' and a.expires_at > now()))
$$;

create or replace function public.aroldo_settings_read()
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'duration',duration,'enabled',enabled) order by id),'[]'::jsonb) from public.aroldo_services),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'opens',opens,'closes',closes,'breakStart',break_start,'breakEnd',break_end) order by weekday),'[]'::jsonb) from public.aroldo_hours),
    'daysOff', (select coalesce(jsonb_agg(day order by day),'[]'::jsonb) from public.aroldo_days_off),
    'pendingMinutes', (select pending_minutes from public.aroldo_settings where id=1),
    'adminConfigured', true
  )
$$;

create or replace function public.aroldo_slots(p_day date, p_service_id integer)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_duration integer; v_hours public.aroldo_hours%rowtype; v_start integer; v_end integer;
  v_break_start integer; v_break_end integer; v_status text; v_result jsonb := '[]'::jsonb;
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_now integer := extract(hour from now() at time zone 'America/Bahia')::integer * 60 + extract(minute from now() at time zone 'America/Bahia')::integer;
begin
  if p_day < v_today or p_day > v_today+60 then raise exception 'Escolha uma data nos próximos 60 dias.'; end if;
  select duration into v_duration from public.aroldo_services where id=p_service_id and enabled;
  if v_duration is null then raise exception 'Serviço indisponível.'; end if;
  if exists(select 1 from public.aroldo_days_off where day=p_day) then return v_result; end if;
  select * into v_hours from public.aroldo_hours where weekday=extract(dow from p_day)::integer;
  if v_hours.opens is null or v_hours.closes is null then return v_result; end if;
  v_start := ((split_part(v_hours.opens,':',1)::integer*60 + split_part(v_hours.opens,':',2)::integer + 29)/30)*30;
  v_end := split_part(v_hours.closes,':',1)::integer*60 + split_part(v_hours.closes,':',2)::integer;
  if v_hours.break_start is not null and v_hours.break_end is not null then
    v_break_start := split_part(v_hours.break_start,':',1)::integer*60 + split_part(v_hours.break_start,':',2)::integer;
    v_break_end := split_part(v_hours.break_end,':',1)::integer*60 + split_part(v_hours.break_end,':',2)::integer;
  end if;
  while v_start+v_duration <= v_end loop
    if not (v_break_start is not null and v_start < v_break_end and v_start+v_duration > v_break_start)
       and not (p_day=v_today and v_start <= v_now) then
      select a.status into v_status from public.aroldo_active(p_day) a
        where a.starts < v_start+v_duration and a.ends > v_start limit 1;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'time',lpad((v_start/60)::text,2,'0') || ':' || lpad((v_start%60)::text,2,'0'),
        'status',coalesce(v_status,'available')));
      v_status := null;
    end if;
    v_start := v_start+30;
  end loop;
  return v_result;
end $$;

create or replace function public.aroldo_request(p_service_id integer, p_day date, p_start integer, p_name text, p_phone text)
returns jsonb language plpgsql set search_path = public as $$
declare v_service public.aroldo_services%rowtype; v_hours public.aroldo_hours%rowtype;
  v_open integer; v_close integer; v_break_start integer; v_break_end integer;
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_now integer := extract(hour from now() at time zone 'America/Bahia')::integer * 60 + extract(minute from now() at time zone 'America/Bahia')::integer;
  v_id bigint; v_expires timestamptz;
begin
  if p_day < v_today or p_day > v_today+60 then raise exception 'Escolha uma data nos próximos 60 dias.'; end if;
  if p_start < 0 or p_start > 1410 or p_start % 30 <> 0 or
     length(trim(p_name)) not between 2 and 80 or p_phone !~ '^[0-9]{10,13}$' then
    raise exception 'Revise nome, telefone e horário.';
  end if;
  perform pg_advisory_xact_lock(hashtext('aroldo:'||p_day::text));
  select * into v_service from public.aroldo_services where id=p_service_id and enabled;
  if not found then raise exception 'Serviço indisponível.'; end if;
  if exists(select 1 from public.aroldo_days_off where day=p_day) then raise exception 'Horário indisponível. Atualize a agenda.'; end if;
  select * into v_hours from public.aroldo_hours where weekday=extract(dow from p_day)::integer;
  if v_hours.opens is null or v_hours.closes is null then raise exception 'Horário indisponível. Atualize a agenda.'; end if;
  v_open := split_part(v_hours.opens,':',1)::integer*60 + split_part(v_hours.opens,':',2)::integer;
  v_close := split_part(v_hours.closes,':',1)::integer*60 + split_part(v_hours.closes,':',2)::integer;
  if p_start < v_open or p_start+v_service.duration > v_close or (p_day=v_today and p_start <= v_now) then
    raise exception 'Horário indisponível. Atualize a agenda.';
  end if;
  if v_hours.break_start is not null and v_hours.break_end is not null then
    v_break_start := split_part(v_hours.break_start,':',1)::integer*60 + split_part(v_hours.break_start,':',2)::integer;
    v_break_end := split_part(v_hours.break_end,':',1)::integer*60 + split_part(v_hours.break_end,':',2)::integer;
    if p_start < v_break_end and p_start+v_service.duration > v_break_start then raise exception 'Horário indisponível. Atualize a agenda.'; end if;
  end if;
  if exists(select 1 from public.aroldo_active(p_day) a where a.starts < p_start+v_service.duration and a.ends > p_start) then
    raise exception 'Horário indisponível. Atualize a agenda.';
  end if;
  select now()+make_interval(mins=>pending_minutes) into v_expires from public.aroldo_settings where id=1;
  insert into public.aroldo_appointments(day,starts,ends,service_id,client_name,phone,status,expires_at)
    values(p_day,p_start,p_start+v_service.duration,v_service.id,trim(p_name),p_phone,'pending',v_expires) returning id into v_id;
  return jsonb_build_object('id',v_id,'day',p_day,'time',lpad((p_start/60)::text,2,'0')||':'||lpad((p_start%60)::text,2,'0'),
    'service',v_service.name,'expiresAt',v_expires,'status','pending');
end $$;

create or replace function public.aroldo_appointments_read(p_from date, p_to date)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'day',a.day,'starts',a.starts,'ends',a.ends,
    'name',a.client_name,'phone',a.phone,'status',case when a.status='pending' and a.expires_at<=now() then 'expired' else a.status end,
    'expiresAt',a.expires_at,'service',s.name,
    'time',lpad((a.starts/60)::text,2,'0')||':'||lpad((a.starts%60)::text,2,'0'),
    'endTime',lpad((a.ends/60)::text,2,'0')||':'||lpad((a.ends%60)::text,2,'0')) order by a.day,a.starts),'[]'::jsonb)
  from public.aroldo_appointments a left join public.aroldo_services s on s.id=a.service_id
  where a.day between p_from and p_to
$$;

create or replace function public.aroldo_decide(p_id bigint, p_action text)
returns jsonb language plpgsql set search_path = public as $$
declare v_row public.aroldo_appointments%rowtype;
begin
  if p_action not in ('confirm','cancel') then raise exception 'Ação inválida.'; end if;
  select * into v_row from public.aroldo_appointments where id=p_id;
  if not found or v_row.status='blocked' then raise exception 'Solicitação não encontrada.'; end if;
  perform pg_advisory_xact_lock(hashtext('aroldo:'||v_row.day::text));
  select * into v_row from public.aroldo_appointments where id=p_id for update;
  if p_action='confirm' then
    if v_row.status <> 'pending' or v_row.expires_at <= now() or
       exists(select 1 from public.aroldo_active(v_row.day) a where a.id<>p_id and a.starts<v_row.ends and a.ends>v_row.starts) then
      raise exception 'Solicitação expirada ou horário em conflito.';
    end if;
  elsif v_row.status not in ('pending','confirmed') then raise exception 'Agendamento já cancelado.';
  end if;
  update public.aroldo_appointments set status=case when p_action='confirm' then 'confirmed' else 'cancelled' end,
    expires_at=null,updated_at=now() where id=p_id;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public.aroldo_block(p_day date, p_start integer, p_duration integer)
returns jsonb language plpgsql set search_path = public as $$
declare v_slot jsonb; v_id bigint;
begin
  if p_duration is null or p_duration < 30 or p_duration > 480 or p_duration%30<>0 then raise exception 'Hora ou duração inválida.'; end if;
  perform pg_advisory_xact_lock(hashtext('aroldo:'||p_day::text));
  -- A block follows the same work hours and break rules as a booking.
  if p_day < (now() at time zone 'America/Bahia')::date or p_day > (now() at time zone 'America/Bahia')::date+60
     or p_start is null or p_start%30<>0 or p_start<0 or p_start+p_duration>1440
     or exists(select 1 from public.aroldo_days_off where day=p_day)
     or exists(select 1 from public.aroldo_active(p_day) a where a.starts<p_start+p_duration and a.ends>p_start) then
    raise exception 'Horário indisponível.';
  end if;
  select to_jsonb(h) into v_slot from public.aroldo_hours h where weekday=extract(dow from p_day)::integer;
  if v_slot->>'opens' is null or v_slot->>'closes' is null or
     p_start < split_part(v_slot->>'opens',':',1)::integer*60+split_part(v_slot->>'opens',':',2)::integer or
     p_start+p_duration > split_part(v_slot->>'closes',':',1)::integer*60+split_part(v_slot->>'closes',':',2)::integer then
    raise exception 'Horário indisponível.';
  end if;
  if v_slot->>'break_start' is not null and v_slot->>'break_end' is not null and
     p_start < split_part(v_slot->>'break_end',':',1)::integer*60+split_part(v_slot->>'break_end',':',2)::integer and
     p_start+p_duration > split_part(v_slot->>'break_start',':',1)::integer*60+split_part(v_slot->>'break_start',':',2)::integer then
    raise exception 'Horário indisponível.';
  end if;
  insert into public.aroldo_appointments(day,starts,ends,status) values(p_day,p_start,p_start+p_duration,'blocked') returning id into v_id;
  return jsonb_build_object('id',v_id);
end $$;

create or replace function public.aroldo_unblock(p_id bigint)
returns jsonb language plpgsql set search_path = public as $$
begin
  update public.aroldo_appointments set status='cancelled',updated_at=now() where id=p_id and status='blocked';
  if not found then raise exception 'Bloqueio não encontrado.'; end if;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public.aroldo_settings_update(p_input jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_hour jsonb; v_service jsonb; v_day text; v_count integer := 0;
begin
  if jsonb_typeof(p_input->'hours')<>'array' or jsonb_array_length(p_input->'hours')<>7 or
     jsonb_typeof(p_input->'services')<>'array' or jsonb_array_length(p_input->'services')<>8 or
     jsonb_typeof(p_input->'daysOff')<>'array' or
     (p_input->>'pendingMinutes')::integer not between 5 and 1440 then raise exception 'Configuração inválida.'; end if;
  for v_hour in select value from jsonb_array_elements(p_input->'hours') loop
    if (v_hour->>'weekday')::integer<>v_count then raise exception 'Expediente inválido.'; end if;
    update public.aroldo_hours set opens=nullif(v_hour->>'opens',''),closes=nullif(v_hour->>'closes',''),
      break_start=nullif(v_hour->>'breakStart',''),break_end=nullif(v_hour->>'breakEnd','') where weekday=v_count;
    v_count := v_count+1;
  end loop;
  for v_service in select value from jsonb_array_elements(p_input->'services') loop
    update public.aroldo_services set duration=(v_service->>'duration')::integer,
      enabled=(v_service->>'enabled')::boolean where id=(v_service->>'id')::integer;
    if not found then raise exception 'Serviço inválido.'; end if;
  end loop;
  delete from public.aroldo_days_off;
  for v_day in select distinct value from jsonb_array_elements_text(p_input->'daysOff') loop
    insert into public.aroldo_days_off(day) values(v_day::date);
  end loop;
  update public.aroldo_settings set pending_minutes=(p_input->>'pendingMinutes')::integer where id=1;
  return public.aroldo_settings_read();
end $$;

create or replace function public.aroldo_rate_limit(p_scope text, p_client_hash text, p_max integer)
returns boolean language plpgsql set search_path = public as $$
declare v_count integer;
begin
  insert into public.aroldo_limits(scope,client_hash,until_at,requests) values(p_scope,p_client_hash,now()+interval '15 minutes',1)
    on conflict (scope,client_hash) do update set
      requests=case when public.aroldo_limits.until_at<=now() then 1 else public.aroldo_limits.requests+1 end,
      until_at=case when public.aroldo_limits.until_at<=now() then now()+interval '15 minutes' else public.aroldo_limits.until_at end
    returning requests into v_count;
  return v_count<=p_max;
end $$;

revoke all on function public.aroldo_active(date), public.aroldo_settings_read(), public.aroldo_slots(date,integer),
  public.aroldo_request(integer,date,integer,text,text), public.aroldo_appointments_read(date,date),
  public.aroldo_decide(bigint,text), public.aroldo_block(date,integer,integer), public.aroldo_unblock(bigint),
  public.aroldo_settings_update(jsonb), public.aroldo_rate_limit(text,text,integer) from public, anon, authenticated;
grant execute on function public.aroldo_active(date), public.aroldo_settings_read(), public.aroldo_slots(date,integer),
  public.aroldo_request(integer,date,integer,text,text), public.aroldo_appointments_read(date,date),
  public.aroldo_decide(bigint,text), public.aroldo_block(date,integer,integer), public.aroldo_unblock(bigint),
  public.aroldo_settings_update(jsonb), public.aroldo_rate_limit(text,text,integer) to service_role;
