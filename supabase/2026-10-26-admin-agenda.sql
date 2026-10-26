-- Run after 2026-10-26-service-showcase.sql. Preserves existing appointments.
begin;
alter table public.aroldo_services add column if not exists description text;
alter table public.aroldo_settings add column if not exists slot_minutes integer not null default 30
  check (slot_minutes in (15,30,60));

create table if not exists public.aroldo_special_hours (
  day date primary key, opens text not null, closes text not null,
  break_start text, break_end text
);
alter table public.aroldo_special_hours enable row level security;
revoke all on public.aroldo_special_hours from anon, authenticated;
grant all on public.aroldo_special_hours to service_role;

-- Official schedule supplied by the owner: Monday–Saturday, Sunday closed.
update public.aroldo_hours set opens='08:00', closes='17:00',
  break_start='12:00', break_end='14:00' where weekday between 1 and 6;
update public.aroldo_hours set opens=null, closes=null, break_start=null, break_end=null where weekday=0;

create or replace function public.aroldo_schedule(p_day date)
returns table(opens text, closes text, break_start text, break_end text)
language sql stable set search_path = public as $$
  select case when s.day is null then h.opens else s.opens end,
    case when s.day is null then h.closes else s.closes end,
    case when s.day is null then h.break_start else s.break_start end,
    case when s.day is null then h.break_end else s.break_end end
  from public.aroldo_hours h left join public.aroldo_special_hours s on s.day=p_day
  where h.weekday=extract(dow from p_day)::integer
$$;

create or replace function public.aroldo_settings_read()
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'duration',duration,'enabled',enabled,
      'priceCents',price_cents,'photoUrl',photo_url,'description',description) order by id),'[]'::jsonb) from public.aroldo_services),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'opens',opens,'closes',closes,
      'breakStart',break_start,'breakEnd',break_end) order by weekday),'[]'::jsonb) from public.aroldo_hours),
    'daysOff', (select coalesce(jsonb_agg(day order by day),'[]'::jsonb) from public.aroldo_days_off),
    'specialHours', (select coalesce(jsonb_agg(jsonb_build_object('day',day,'opens',opens,'closes',closes,
      'breakStart',break_start,'breakEnd',break_end) order by day),'[]'::jsonb) from public.aroldo_special_hours),
    'pendingMinutes', (select pending_minutes from public.aroldo_settings where id=1),
    'slotMinutes', (select slot_minutes from public.aroldo_settings where id=1),
    'adminConfigured', true
  )
$$;

create or replace function public.aroldo_settings_update(p_input jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_hour jsonb; v_service jsonb; v_day text; v_special jsonb;
  v_count integer := 0; v_id integer; v_photo text;
begin
  if jsonb_typeof(p_input->'hours')<>'array' or jsonb_array_length(p_input->'hours')<>7 or
     jsonb_typeof(p_input->'services')<>'array' or jsonb_array_length(p_input->'services')>40 or
     jsonb_typeof(p_input->'daysOff')<>'array' or
     (p_input->>'pendingMinutes')::integer not between 5 and 1440 or
     (p_input ? 'slotMinutes' and (p_input->>'slotMinutes')::integer not in (15,30,60)) or
     (p_input ? 'specialHours' and (jsonb_typeof(p_input->'specialHours')<>'array' or
       jsonb_array_length(p_input->'specialHours')>90)) then raise exception 'Configuração inválida.'; end if;
  perform pg_advisory_xact_lock(hashtext('aroldo:settings'));
  for v_hour in select value from jsonb_array_elements(p_input->'hours') loop
    if (v_hour->>'weekday')::integer<>v_count then raise exception 'Expediente inválido.'; end if;
    update public.aroldo_hours set opens=nullif(v_hour->>'opens',''),closes=nullif(v_hour->>'closes',''),
      break_start=nullif(v_hour->>'breakStart',''),break_end=nullif(v_hour->>'breakEnd','') where weekday=v_count;
    v_count := v_count+1;
  end loop;
  for v_service in select value from jsonb_array_elements(p_input->'services') loop
    v_id := nullif(v_service->>'id','')::integer;
    v_photo := nullif(v_service->>'photoUrl','');
    if v_id is null then
      insert into public.aroldo_services(id,name,duration,enabled,price_cents,photo_url,description)
      values((select coalesce(max(id),0)+1 from public.aroldo_services),trim(v_service->>'name'),
        (v_service->>'duration')::integer,(v_service->>'enabled')::boolean,
        nullif(v_service->>'priceCents','')::integer,v_photo,nullif(v_service->>'description',''));
    else
      update public.aroldo_services set name=coalesce(nullif(trim(v_service->>'name'),''),name),
        duration=(v_service->>'duration')::integer, enabled=(v_service->>'enabled')::boolean,
        price_cents=case when v_service ? 'priceCents' then nullif(v_service->>'priceCents','')::integer else price_cents end,
        photo_url=case when v_service ? 'photoUrl' then v_photo else photo_url end,
        description=case when v_service ? 'description' then nullif(v_service->>'description','') else description end
        where id=v_id;
      if not found then raise exception 'Serviço inválido.'; end if;
    end if;
  end loop;
  delete from public.aroldo_days_off;
  for v_day in select distinct value from jsonb_array_elements_text(p_input->'daysOff') loop
    insert into public.aroldo_days_off(day) values(v_day::date);
  end loop;
  if p_input ? 'specialHours' then
    delete from public.aroldo_special_hours;
    for v_special in select value from jsonb_array_elements(p_input->'specialHours') loop
      insert into public.aroldo_special_hours(day,opens,closes,break_start,break_end)
      values((v_special->>'day')::date,v_special->>'opens',v_special->>'closes',
        nullif(v_special->>'breakStart',''),nullif(v_special->>'breakEnd',''));
    end loop;
  end if;
  update public.aroldo_settings set pending_minutes=(p_input->>'pendingMinutes')::integer,
    slot_minutes=coalesce((p_input->>'slotMinutes')::integer,slot_minutes) where id=1;
  return public.aroldo_settings_read();
end $$;

revoke all on function public.aroldo_schedule(date) from public, anon, authenticated;
grant execute on function public.aroldo_schedule(date) to service_role;

create or replace function public.aroldo_minutes(p_time text)
returns integer language sql immutable as $$
  select split_part(p_time,':',1)::integer*60 + split_part(p_time,':',2)::integer
$$;

create or replace function public.aroldo_agenda(p_day date)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_hours record; v_step integer; v_start integer; v_end integer;
  v_break_start integer; v_break_end integer; v_status text; v_result jsonb := '[]'::jsonb;
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_now integer := extract(hour from now() at time zone 'America/Bahia')::integer*60 + extract(minute from now() at time zone 'America/Bahia')::integer;
begin
  if p_day < v_today or p_day > v_today+60 then raise exception 'Escolha uma data nos próximos 60 dias.'; end if;
  if exists(select 1 from public.aroldo_days_off where day=p_day) then return v_result; end if;
  select * into v_hours from public.aroldo_schedule(p_day);
  if v_hours.opens is null or v_hours.closes is null then return v_result; end if;
  select slot_minutes into v_step from public.aroldo_settings where id=1;
  v_start := ((public.aroldo_minutes(v_hours.opens)+v_step-1)/v_step)*v_step;
  v_end := public.aroldo_minutes(v_hours.closes);
  if v_hours.break_start is not null and v_hours.break_end is not null then
    v_break_start := public.aroldo_minutes(v_hours.break_start);
    v_break_end := public.aroldo_minutes(v_hours.break_end);
  end if;
  while v_start+v_step <= v_end loop
    if not (p_day=v_today and v_start<=v_now) then
      if v_break_start is not null and v_start<v_break_end and v_start+v_step>v_break_start then
        v_status := 'unavailable';
      else
        select a.status into v_status from public.aroldo_active(p_day) a
          where a.starts<v_start+v_step and a.ends>v_start
          order by case a.status when 'confirmed' then 0 when 'blocked' then 1 else 2 end limit 1;
      end if;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'time',lpad((v_start/60)::text,2,'0')||':'||lpad((v_start%60)::text,2,'0'),
        'status',coalesce(v_status,'available')));
      v_status := null;
    end if;
    v_start := v_start+v_step;
  end loop;
  return v_result;
end $$;

create or replace function public.aroldo_slots(p_day date, p_service_id integer)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_duration integer; v_hours record; v_step integer; v_start integer; v_end integer;
  v_break_start integer; v_break_end integer; v_status text; v_result jsonb := '[]'::jsonb;
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_now integer := extract(hour from now() at time zone 'America/Bahia')::integer*60 + extract(minute from now() at time zone 'America/Bahia')::integer;
begin
  if p_day < v_today or p_day > v_today+60 then raise exception 'Escolha uma data nos próximos 60 dias.'; end if;
  select duration into v_duration from public.aroldo_services where id=p_service_id and enabled;
  if v_duration is null then raise exception 'Serviço indisponível.'; end if;
  if exists(select 1 from public.aroldo_days_off where day=p_day) then return v_result; end if;
  select * into v_hours from public.aroldo_schedule(p_day);
  if v_hours.opens is null or v_hours.closes is null then return v_result; end if;
  select slot_minutes into v_step from public.aroldo_settings where id=1;
  v_start := ((public.aroldo_minutes(v_hours.opens)+v_step-1)/v_step)*v_step;
  v_end := public.aroldo_minutes(v_hours.closes);
  if v_hours.break_start is not null and v_hours.break_end is not null then
    v_break_start := public.aroldo_minutes(v_hours.break_start);
    v_break_end := public.aroldo_minutes(v_hours.break_end);
  end if;
  while v_start+v_duration <= v_end loop
    if not (v_break_start is not null and v_start<v_break_end and v_start+v_duration>v_break_start)
      and not (p_day=v_today and v_start<=v_now) then
      select a.status into v_status from public.aroldo_active(p_day) a
        where a.starts<v_start+v_duration and a.ends>v_start
        order by case a.status when 'confirmed' then 0 when 'blocked' then 1 else 2 end limit 1;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'time',lpad((v_start/60)::text,2,'0')||':'||lpad((v_start%60)::text,2,'0'),
        'status',coalesce(v_status,'available')));
      v_status := null;
    end if;
    v_start := v_start+v_step;
  end loop;
  return v_result;
end $$;

create or replace function public.aroldo_request(p_service_id integer, p_day date, p_start integer, p_name text, p_phone text)
returns jsonb language plpgsql set search_path = public as $$
declare v_service public.aroldo_services%rowtype; v_hours record;
  v_step integer; v_break_start integer; v_break_end integer; v_id bigint; v_expires timestamptz;
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_now integer := extract(hour from now() at time zone 'America/Bahia')::integer*60 + extract(minute from now() at time zone 'America/Bahia')::integer;
begin
  if p_day < v_today or p_day > v_today+60 then raise exception 'Escolha uma data nos próximos 60 dias.'; end if;
  select slot_minutes into v_step from public.aroldo_settings where id=1;
  if p_start is null or p_start<0 or p_start>1440-v_step or p_start%v_step<>0 or
     length(trim(p_name)) not between 2 and 80 or p_phone !~ '^[0-9]{10,13}$' then
    raise exception 'Revise nome, telefone e horário.';
  end if;
  perform pg_advisory_xact_lock(hashtext('aroldo:'||p_day::text));
  select * into v_service from public.aroldo_services where id=p_service_id and enabled;
  if not found then raise exception 'Serviço indisponível.'; end if;
  if exists(select 1 from public.aroldo_days_off where day=p_day) then raise exception 'Horário indisponível. Atualize a agenda.'; end if;
  select * into v_hours from public.aroldo_schedule(p_day);
  if v_hours.opens is null or v_hours.closes is null or
     p_start<public.aroldo_minutes(v_hours.opens) or
     p_start+v_service.duration>public.aroldo_minutes(v_hours.closes) or
     (p_day=v_today and p_start<=v_now) then raise exception 'Horário indisponível. Atualize a agenda.'; end if;
  if v_hours.break_start is not null and v_hours.break_end is not null then
    v_break_start := public.aroldo_minutes(v_hours.break_start);
    v_break_end := public.aroldo_minutes(v_hours.break_end);
    if p_start<v_break_end and p_start+v_service.duration>v_break_start then raise exception 'Horário indisponível. Atualize a agenda.'; end if;
  end if;
  if exists(select 1 from public.aroldo_active(p_day) a where a.starts<p_start+v_service.duration and a.ends>p_start) then
    raise exception 'Horário indisponível. Atualize a agenda.';
  end if;
  select now()+make_interval(mins=>pending_minutes) into v_expires from public.aroldo_settings where id=1;
  insert into public.aroldo_appointments(day,starts,ends,service_id,client_name,phone,status,expires_at)
    values(p_day,p_start,p_start+v_service.duration,v_service.id,trim(p_name),p_phone,'pending',v_expires) returning id into v_id;
  return jsonb_build_object('id',v_id,'day',p_day,'time',lpad((p_start/60)::text,2,'0')||':'||lpad((p_start%60)::text,2,'0'),
    'service',v_service.name,'expiresAt',v_expires,'status','pending');
end $$;

create or replace function public.aroldo_block(p_day date, p_start integer, p_duration integer)
returns jsonb language plpgsql set search_path = public as $$
declare v_hours record; v_step integer; v_id bigint;
begin
  select slot_minutes into v_step from public.aroldo_settings where id=1;
  if p_duration is null or p_duration<v_step or p_duration>480 or p_duration%v_step<>0 or
     p_start is null or p_start<0 or p_start%v_step<>0 or p_start+p_duration>1440 then raise exception 'Hora ou duração inválida.'; end if;
  perform pg_advisory_xact_lock(hashtext('aroldo:'||p_day::text));
  if p_day<(now() at time zone 'America/Bahia')::date or p_day>(now() at time zone 'America/Bahia')::date+60 or
     exists(select 1 from public.aroldo_days_off where day=p_day) or
     exists(select 1 from public.aroldo_active(p_day) a where a.starts<p_start+p_duration and a.ends>p_start) then
    raise exception 'Horário indisponível.';
  end if;
  select * into v_hours from public.aroldo_schedule(p_day);
  if v_hours.opens is null or v_hours.closes is null or
     p_start<public.aroldo_minutes(v_hours.opens) or p_start+p_duration>public.aroldo_minutes(v_hours.closes) or
     (p_day=(now() at time zone 'America/Bahia')::date and
       p_start<=extract(hour from now() at time zone 'America/Bahia')::integer*60+extract(minute from now() at time zone 'America/Bahia')::integer) then
    raise exception 'Horário indisponível.';
  end if;
  if v_hours.break_start is not null and v_hours.break_end is not null and
     p_start<public.aroldo_minutes(v_hours.break_end) and p_start+p_duration>public.aroldo_minutes(v_hours.break_start) then
    raise exception 'Horário indisponível.';
  end if;
  insert into public.aroldo_appointments(day,starts,ends,status) values(p_day,p_start,p_start+p_duration,'blocked') returning id into v_id;
  return jsonb_build_object('id',v_id);
end $$;

revoke all on function public.aroldo_minutes(text), public.aroldo_agenda(date), public.aroldo_slots(date,integer),
  public.aroldo_request(integer,date,integer,text,text), public.aroldo_block(date,integer,integer) from public, anon, authenticated;
grant execute on function public.aroldo_minutes(text), public.aroldo_agenda(date), public.aroldo_slots(date,integer),
  public.aroldo_request(integer,date,integer,text,text), public.aroldo_block(date,integer,integer) to service_role;

commit;
