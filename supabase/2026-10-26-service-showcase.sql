-- Execute after schema.sql. Existing appointments and services are preserved.
alter table public.aroldo_services
  add column if not exists price_cents integer check (price_cents between 0 and 10000000),
  add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aroldo-services', 'aroldo-services', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.aroldo_settings_read()
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'duration',duration,'enabled',enabled,
      'priceCents',price_cents,'photoUrl',photo_url) order by id),'[]'::jsonb) from public.aroldo_services),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'opens',opens,'closes',closes,'breakStart',break_start,'breakEnd',break_end) order by weekday),'[]'::jsonb) from public.aroldo_hours),
    'daysOff', (select coalesce(jsonb_agg(day order by day),'[]'::jsonb) from public.aroldo_days_off),
    'pendingMinutes', (select pending_minutes from public.aroldo_settings where id=1),
    'adminConfigured', true
  )
$$;

create or replace function public.aroldo_agenda(p_day date)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_hours public.aroldo_hours%rowtype; v_start integer; v_end integer;
  v_break_start integer; v_break_end integer; v_status text; v_result jsonb := '[]'::jsonb;
  v_today date := (now() at time zone 'America/Bahia')::date;
  v_now integer := extract(hour from now() at time zone 'America/Bahia')::integer * 60 + extract(minute from now() at time zone 'America/Bahia')::integer;
begin
  if p_day < v_today or p_day > v_today+60 then raise exception 'Escolha uma data nos próximos 60 dias.'; end if;
  if exists(select 1 from public.aroldo_days_off where day=p_day) then return v_result; end if;
  select * into v_hours from public.aroldo_hours where weekday=extract(dow from p_day)::integer;
  if v_hours.opens is null or v_hours.closes is null then return v_result; end if;
  v_start := ((split_part(v_hours.opens,':',1)::integer*60 + split_part(v_hours.opens,':',2)::integer + 29)/30)*30;
  v_end := split_part(v_hours.closes,':',1)::integer*60 + split_part(v_hours.closes,':',2)::integer;
  if v_hours.break_start is not null and v_hours.break_end is not null then
    v_break_start := split_part(v_hours.break_start,':',1)::integer*60 + split_part(v_hours.break_start,':',2)::integer;
    v_break_end := split_part(v_hours.break_end,':',1)::integer*60 + split_part(v_hours.break_end,':',2)::integer;
  end if;
  while v_start+30 <= v_end loop
    if not (p_day=v_today and v_start <= v_now) then
      if v_break_start is not null and v_start < v_break_end and v_start+30 > v_break_start then
        v_status := 'blocked';
      else
        select a.status into v_status from public.aroldo_active(p_day) a
          where a.starts < v_start+30 and a.ends > v_start
          order by case a.status when 'confirmed' then 0 when 'blocked' then 1 else 2 end limit 1;
      end if;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'time',lpad((v_start/60)::text,2,'0') || ':' || lpad((v_start%60)::text,2,'0'),
        'status',coalesce(v_status,'available')));
      v_status := null;
    end if;
    v_start := v_start+30;
  end loop;
  return v_result;
end $$;

create or replace function public.aroldo_settings_update(p_input jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_hour jsonb; v_service jsonb; v_day text; v_count integer := 0; v_id integer; v_photo text;
begin
  if jsonb_typeof(p_input->'hours')<>'array' or jsonb_array_length(p_input->'hours')<>7 or
     jsonb_typeof(p_input->'services')<>'array' or jsonb_array_length(p_input->'services')>40 or
     jsonb_typeof(p_input->'daysOff')<>'array' or
     (p_input->>'pendingMinutes')::integer not between 5 and 1440 then raise exception 'Configuração inválida.'; end if;
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
      insert into public.aroldo_services(id,name,duration,enabled,price_cents,photo_url)
      values((select coalesce(max(id),0)+1 from public.aroldo_services),trim(v_service->>'name'),
        (v_service->>'duration')::integer,(v_service->>'enabled')::boolean,
        nullif(v_service->>'priceCents','')::integer,v_photo);
    else
      update public.aroldo_services set name=coalesce(nullif(trim(v_service->>'name'),''),name),
        duration=(v_service->>'duration')::integer, enabled=(v_service->>'enabled')::boolean,
        price_cents=case when v_service ? 'priceCents' then nullif(v_service->>'priceCents','')::integer else price_cents end,
        photo_url=case when v_service ? 'photoUrl' then v_photo else photo_url end where id=v_id;
      if not found then raise exception 'Serviço inválido.'; end if;
    end if;
  end loop;
  delete from public.aroldo_days_off;
  for v_day in select distinct value from jsonb_array_elements_text(p_input->'daysOff') loop
    insert into public.aroldo_days_off(day) values(v_day::date);
  end loop;
  update public.aroldo_settings set pending_minutes=(p_input->>'pendingMinutes')::integer where id=1;
  return public.aroldo_settings_read();
end $$;

revoke all on function public.aroldo_agenda(date) from public, anon, authenticated;
grant execute on function public.aroldo_agenda(date) to service_role;
