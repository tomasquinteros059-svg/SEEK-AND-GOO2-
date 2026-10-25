-- Reparto · Fase 3 · el día del conductor (SPEC 2 pasos 4–14, SPEC 6; agentes-y-whatsapp.md 0.1 y 7.1)
--
--   jornadas                 un día de ruta de un conductor en una empresa
--   eventos_entrega          lo que pasó, con la hora REAL (no se borra; el id lo crea el teléfono)
--   adjuntos                 fotos (guía firmada, entrega, efectivo…) en un bucket privado
--   clasificaciones_entrega  lo que dijo el Agente de Entregas (no cambia el estado: eso lo hace el conductor)
--   cola_agentes             trabajo pendiente de los agentes (una fila por agente y evento)
--
-- IDEMPOTENCIA (SPEC 6): cada acción del teléfono trae un UUID creado en el teléfono.
-- El mismo envío dos veces responde "ya recibido" y no duplica nada. Lo frena la
-- llave primaria, no un `if`.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.jornadas (
  id           uuid primary key,  -- lo crea el teléfono
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  conductor_id uuid not null references public.usuarios (id) on delete cascade,
  fecha        date not null,
  inicio       timestamptz not null,
  fin          timestamptz,
  estado       text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  resumen      jsonb
);
create unique index jornadas_una_por_dia on public.jornadas (empresa_id, conductor_id, fecha);
comment on table public.jornadas is 'Un día de ruta: entre «Iniciar ruta» y «Terminar ruta» (SPEC 2, pasos 5 y 14).';

alter table public.entregas add constraint entregas_jornada_fk foreign key (jornada_id) references public.jornadas (id) on delete set null;

create type public.tipo_evento as enum ('en_camino', 'llegue', 'entregada', 'no_entregada', 'foto_agregada');

create table public.eventos_entrega (
  id           uuid primary key,  -- lo crea el teléfono: el mismo envío dos veces no duplica
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  entrega_id   uuid not null references public.entregas (id) on delete cascade,
  tipo         public.tipo_evento not null,
  ocurrido_en  timestamptz not null,           -- la hora real en el teléfono
  recibido_en  timestamptz not null default now(),
  sin_senal    boolean not null default false,
  autor        uuid references public.usuarios (id) on delete set null,
  mensaje      text check (char_length(mensaje) <= 1000),
  motivo       text check (char_length(motivo) <= 120),
  lat          double precision,
  lng          double precision,
  precision_m  real,
  datos        jsonb not null default '{}'::jsonb
);
create index on public.eventos_entrega (entrega_id, ocurrido_en);
comment on table public.eventos_entrega is 'Historial que no se borra de lo que pasó en cada entrega, con la hora real (SPEC 4.1 y 6).';

create type public.tipo_adjunto as enum ('guia', 'entrega', 'efectivo', 'comprobante', 'recepcion', 'reporte');

create table public.adjuntos (
  id         uuid primary key,  -- lo crea el teléfono
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  entrega_id uuid not null references public.entregas (id) on delete cascade,
  evento_id  uuid references public.eventos_entrega (id) on delete set null,
  tipo       public.tipo_adjunto not null,
  ruta       text not null unique,
  subido_por uuid references public.usuarios (id) on delete set null,
  creado_en  timestamptz not null default now(),
  check (ruta like empresa_id::text || '/' || entrega_id::text || '/%')
);
create index on public.adjuntos (entrega_id);

create type public.clase_entrega as enum ('entregada', 'fallida', 'incidencia');

create table public.clasificaciones_entrega (
  entrega_id     uuid primary key references public.entregas (id) on delete cascade,
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  evento_id      uuid references public.eventos_entrega (id) on delete set null,
  clase          public.clase_entrega,
  foto_ok        boolean,
  motivo_foto    text,
  resumen        text,
  urgente        boolean not null default false,
  revisar        boolean not null default false,  -- lo que dijo el agente no calza con lo que marcó el conductor
  mensaje_cliente text check (char_length(mensaje_cliente) <= 1000),  -- propuesta para el cliente (se envía en la fase de WhatsApp)
  modelo         text,
  costo_usd      numeric(10, 6),
  actualizada_en timestamptz not null default now()
);
comment on table public.clasificaciones_entrega is
  'Lo que concluyó el Agente de Entregas. Nunca cambia el estado de la entrega: eso lo decide el conductor (gana el hecho físico).';

create table public.cola_agentes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  agente       text not null check (agente in ('entregas', 'central', 'whatsapp', 'llamadas', 'rutas')),
  tipo         text not null,
  datos        jsonb not null default '{}'::jsonb,
  clave_unica  text not null unique,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'tomado', 'hecho', 'fallido')),
  intentos     smallint not null default 0,
  disponible_en timestamptz not null default now(),
  tomado_en    timestamptz,
  error        text,
  creado_en    timestamptz not null default now()
);
create index on public.cola_agentes (agente, disponible_en) where estado = 'pendiente';
comment on table public.cola_agentes is 'Trabajo de los agentes. Se comunican por aquí, nunca llamándose entre sí (agentes-y-whatsapp.md 5).';

create table public.acciones_asistente (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  agente       text not null,
  pedido_por   uuid references public.usuarios (id) on delete set null,
  evento_id    uuid,
  herramienta  text not null,
  datos        jsonb not null default '{}'::jsonb,
  resultado    jsonb not null default '{}'::jsonb,
  modelo       text,
  tokens_entrada integer,
  tokens_salida  integer,
  costo_usd    numeric(10, 6),
  modo         text,
  creada_en    timestamptz not null default now()
);
create index on public.acciones_asistente (empresa_id, creada_en desc);
comment on table public.acciones_asistente is 'Auditoría de TODO lo que hace cada agente (SPEC 5.4.8). Se ve en el panel.';

-- ---------------------------------------------------------------------------
-- Publicar el día (SPEC 2, paso 4)
-- ---------------------------------------------------------------------------
-- Pasa a `publicada` las entregas asignadas de ese día. Lo hace el administrador
-- con un botón o el reloj a la hora configurada (por defecto 07:00).
create or replace function public.publicar_dia(empresa uuid, dia date)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare n integer;
begin
  update public.entregas set estado = 'publicada'
   where empresa_id = empresa and fecha = dia and estado = 'asignada';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- El reloj: publica hoy (hora de Chile) en las empresas cuya hora de publicación ya pasó.
create or replace function public.publicar_programado()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  ahora timestamp := now() at time zone 'America/Santiago';
  n integer;
begin
  update public.entregas e set estado = 'publicada'
    from public.empresas emp
   where emp.id = e.empresa_id
     and e.fecha = ahora::date and e.estado = 'asignada'
     and ahora::time >= coalesce((emp.configuracion ->> 'hora_publicacion')::time, '07:00');
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Acciones del conductor (todas idempotentes por el UUID del teléfono)
-- ---------------------------------------------------------------------------
create or replace function public.iniciar_jornada(jornada uuid, empresa uuid, dia date, ocurrido_en timestamptz)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  existente uuid;
begin
  if not exists (select 1 from public.membresias m where m.empresa_id = empresa and m.usuario_id = auth.uid()
                 and m.rol = 'conductor' and m.estado = 'activo') then
    raise exception 'No eres conductor activo de esta empresa.' using errcode = '42501';
  end if;
  select j.id into existente from public.jornadas j where j.empresa_id = empresa and j.conductor_id = auth.uid() and j.fecha = dia;
  if existente is null then
    insert into public.jornadas (id, empresa_id, conductor_id, fecha, inicio)
    values (jornada, empresa, auth.uid(), dia, coalesce(ocurrido_en, now()))
    on conflict (id) do nothing;
    existente := jornada;
  else
    -- Volver a iniciar el mismo día reabre la jornada (por ejemplo, si la cerró por error).
    update public.jornadas set estado = 'abierta', fin = null where id = existente;
  end if;
  update public.entregas set jornada_id = existente
   where empresa_id = empresa and conductor_id = auth.uid() and fecha = dia and estado <> 'cancelada';
  return existente;
end;
$$;

create or replace function public.terminar_jornada(jornada uuid, ocurrido_en timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  j public.jornadas;
  r jsonb;
begin
  select * into j from public.jornadas where id = jornada and conductor_id = auth.uid();
  if not found then raise exception 'Esa jornada no es tuya.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'entregas', count(*) filter (where e.estado <> 'cancelada'),
    'entregadas', count(*) filter (where e.estado = 'entregada'),
    'no_entregadas', count(*) filter (where e.estado = 'fallida'),
    'pendientes', count(*) filter (where e.estado in ('publicada', 'en_camino', 'cerca', 'en_destino')),
    'bultos_entregados', coalesce(sum(e.bultos) filter (where e.estado = 'entregada'), 0),
    'cobrado', coalesce(sum(p.monto) filter (where e.estado = 'entregada' and p.estado = 'confirmado'), 0)
  ) into r
  from public.entregas e left join public.pagos p on p.entrega_id = e.id
  where e.jornada_id = jornada;
  update public.jornadas set estado = 'cerrada', fin = coalesce(ocurrido_en, now()), resumen = r where id = jornada;
  return r;
end;
$$;

-- Registra un evento del conductor y aplica el cambio de estado.
-- Devuelve 'ok' o 'ya_recibido' (el mismo UUID otra vez).
--   en_camino   publicada → en_camino
--   llegue      → en_destino
--   entregada   → entregada (exige ≥1 foto de guía o entrega y mensaje; gana el hecho físico si estaba cancelada)
--   no_entregada → fallida (exige motivo, foto y mensaje)
--   foto_agregada  una foto nueva para una entrega ya cerrada (por ejemplo, porque el agente rechazó la anterior)
create or replace function public.registrar_evento(
  evento uuid, entrega uuid, tipo public.tipo_evento, ocurrido_en timestamptz,
  mensaje text default null, motivo text default null, lat double precision default null,
  lng double precision default null, precision_m real default null, sin_senal boolean default false,
  fotos uuid[] default '{}', cobro jsonb default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  e public.entregas;
  nuevo public.estado_entrega;
  fotos_validas integer;
begin
  if exists (select 1 from public.eventos_entrega where id = evento) then
    return 'ya_recibido';
  end if;

  select * into e from public.entregas where id = entrega for update;
  if not found or e.conductor_id is distinct from auth.uid() or e.estado in ('borrador', 'asignada')
     or not exists (select 1 from public.membresias m where m.empresa_id = e.empresa_id and m.usuario_id = auth.uid() and m.estado = 'activo') then
    raise exception 'Esa entrega no es tuya o todavía no está publicada.' using errcode = '42501';
  end if;

  select count(*) into fotos_validas from public.adjuntos a
   where a.id = any (fotos) and a.entrega_id = entrega and a.subido_por = auth.uid();

  if tipo in ('entregada', 'no_entregada') then
    if fotos_validas = 0 then raise exception 'Falta la foto.' using errcode = 'P0001'; end if;
    if coalesce(btrim(mensaje), '') = '' then raise exception 'Falta el mensaje.' using errcode = 'P0001'; end if;
  end if;
  if tipo = 'no_entregada' and coalesce(btrim(motivo), '') = '' then
    raise exception 'Falta el motivo.' using errcode = 'P0001';
  end if;
  if tipo = 'foto_agregada' and fotos_validas = 0 then
    raise exception 'Falta la foto.' using errcode = 'P0001';
  end if;

  insert into public.eventos_entrega (id, empresa_id, entrega_id, tipo, ocurrido_en, sin_senal, autor, mensaje, motivo, lat, lng, precision_m, datos)
  values (evento, e.empresa_id, entrega, tipo, coalesce(ocurrido_en, now()), sin_senal, auth.uid(), nullif(btrim(mensaje), ''),
          nullif(btrim(motivo), ''), lat, lng, precision_m, jsonb_build_object('fotos', to_jsonb(fotos), 'cobro', cobro));
  update public.adjuntos set evento_id = evento where id = any (fotos) and entrega_id = entrega and evento_id is null;

  nuevo := case tipo
    when 'en_camino' then case when e.estado = 'publicada' then 'en_camino'::public.estado_entrega end
    when 'llegue' then case when e.estado in ('publicada', 'en_camino', 'cerca') then 'en_destino'::public.estado_entrega end
    when 'entregada' then 'entregada'::public.estado_entrega
    when 'no_entregada' then 'fallida'::public.estado_entrega
    else null end;

  -- Un evento que llega tarde (sin señal) no retrocede una entrega ya cerrada.
  if nuevo is not null and e.estado not in ('entregada', 'fallida') and nuevo <> e.estado then
    if e.estado = 'cancelada' and nuevo <> 'entregada' then
      null;  -- cancelada solo cede ante el hecho físico de entregar
    else
      update public.entregas set estado = nuevo where id = entrega;
    end if;
  end if;

  -- Cobro registrado al entregar (la app solo registra; el cobro se hace fuera, decisión de la Etapa A).
  if tipo = 'entregada' and cobro is not null then
    update public.pagos p set estado = 'confirmado',
           forma = coalesce((cobro ->> 'forma')::public.forma_pago, p.forma)
     where p.entrega_id = entrega and p.tipo = 'cobrar';
  end if;

  -- Trabajo para el Agente de Entregas (revisar la foto, clasificar, resumir).
  if tipo in ('entregada', 'no_entregada', 'foto_agregada') then
    insert into public.cola_agentes (empresa_id, agente, tipo, datos, clave_unica)
    values (e.empresa_id, 'entregas', 'entrega.registrada', jsonb_build_object('evento_id', evento, 'entrega_id', entrega),
            'entregas:' || evento::text)
    on conflict (clave_unica) do nothing;
  end if;
  return 'ok';
end;
$$;

-- Registra una foto ya subida al bucket (idempotente por su UUID).
create or replace function public.registrar_adjunto(adjunto uuid, entrega uuid, tipo public.tipo_adjunto, ruta text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  e public.entregas;
begin
  if exists (select 1 from public.adjuntos where id = adjunto) then return 'ya_recibido'; end if;
  select * into e from public.entregas where id = entrega;
  if not found or e.conductor_id is distinct from auth.uid() or e.estado in ('borrador', 'asignada') then
    raise exception 'Esa entrega no es tuya o todavía no está publicada.' using errcode = '42501';
  end if;
  insert into public.adjuntos (id, empresa_id, entrega_id, tipo, ruta, subido_por)
  values (adjunto, e.empresa_id, entrega, tipo, ruta, auth.uid());
  return 'ok';
end;
$$;

-- Tomar trabajo de la cola (lo usa la función del agente con la clave de servicio).
create or replace function public.tomar_trabajo(agente_nombre text, cuantos int default 10, clave text default null)
returns setof public.cola_agentes
language sql security definer set search_path = ''
as $$
  update public.cola_agentes
     set estado = 'tomado', tomado_en = now(), intentos = intentos + 1
   where id in (
     select id from public.cola_agentes
      where agente = agente_nombre
        and (clave is null or clave_unica = clave)
        and disponible_en <= now()
        and (estado = 'pendiente' or (estado = 'tomado' and tomado_en < now() - interval '5 minutes'))
      order by disponible_en
      limit cuantos
      for update skip locked)
  returning *
$$;

-- Las entregas del día del conductor, con lo mínimo del local (nunca teléfonos) y su punto.
-- Corre con los permisos de quien llama: el conductor solo ve las suyas publicadas.
create or replace function public.mis_entregas_del_dia(empresa uuid, dia date)
returns table (
  id uuid, empresa_id uuid, estado public.estado_entrega, guia text, bultos integer, orden integer,
  hora_comprometida time, ventana_desde time, ventana_hasta time, notas text, direccion text, comuna text,
  receptor jsonb, pago jsonb
)
language sql stable security invoker set search_path = ''
as $$
  select e.id, e.empresa_id, e.estado, e.guia, e.bultos, e.orden, e.hora_comprometida, e.ventana_desde, e.ventana_hasta,
         e.notas, e.direccion, e.comuna,
         jsonb_build_object('nombre', r.nombre, 'notas', r.notas,
           'lat', extensions.st_y(coalesce(e.punto, r.punto)::extensions.geometry),
           'lng', extensions.st_x(coalesce(e.punto, r.punto)::extensions.geometry)),
         (select jsonb_build_object('tipo', p.tipo, 'monto', p.monto, 'forma', p.forma, 'estado', p.estado) from public.pagos p where p.entrega_id = e.id)
  from public.entregas e
  join public.receptores r on r.id = e.receptor_id
  where e.empresa_id = empresa and e.fecha = dia and e.conductor_id = auth.uid()
    and e.estado not in ('borrador', 'asignada', 'cancelada')
  order by e.orden nulls last, e.hora_comprometida nulls last, r.nombre
$$;
revoke all on function public.mis_entregas_del_dia(uuid, date) from public, anon;
grant execute on function public.mis_entregas_del_dia(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Reglas de acceso
-- ---------------------------------------------------------------------------
alter table public.jornadas                enable row level security;
alter table public.eventos_entrega         enable row level security;
alter table public.adjuntos                enable row level security;
alter table public.clasificaciones_entrega enable row level security;
alter table public.cola_agentes            enable row level security;
alter table public.acciones_asistente      enable row level security;
revoke all on public.jornadas, public.eventos_entrega, public.adjuntos, public.clasificaciones_entrega,
  public.cola_agentes, public.acciones_asistente from anon, authenticated;
create policy acciones_ver on public.acciones_asistente for select to authenticated using (public.es_admin(empresa_id));
grant select on public.acciones_asistente to authenticated;

-- Todo se escribe por las funciones de arriba; aquí solo se lee.
create policy jornadas_ver on public.jornadas for select to authenticated
  using (conductor_id = auth.uid() or public.es_admin(empresa_id));
create policy eventos_ver on public.eventos_entrega for select to authenticated
  using (public.es_admin(empresa_id) or autor = auth.uid());
create policy adjuntos_ver on public.adjuntos for select to authenticated
  using (public.es_admin(empresa_id) or subido_por = auth.uid());
create policy clasificaciones_ver on public.clasificaciones_entrega for select to authenticated
  using (public.es_admin(empresa_id));
-- El administrador puede corregir lo que propuso el agente (resumen, mensaje para el cliente, urgencia).
create policy clasificaciones_editar on public.clasificaciones_entrega for update to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id));
grant select on public.jornadas, public.eventos_entrega, public.adjuntos, public.clasificaciones_entrega to authenticated;
grant update (resumen, urgente, revisar, mensaje_cliente) on public.clasificaciones_entrega to authenticated;
-- cola_agentes: sin acceso desde la app ni el panel.

revoke all on function public.iniciar_jornada(uuid, uuid, date, timestamptz), public.terminar_jornada(uuid, timestamptz),
  public.registrar_evento(uuid, uuid, public.tipo_evento, timestamptz, text, text, double precision, double precision, real, boolean, uuid[], jsonb),
  public.registrar_adjunto(uuid, uuid, public.tipo_adjunto, text), public.publicar_dia(uuid, date)
  from public, anon;
grant execute on function public.iniciar_jornada(uuid, uuid, date, timestamptz), public.terminar_jornada(uuid, timestamptz),
  public.registrar_evento(uuid, uuid, public.tipo_evento, timestamptz, text, text, double precision, double precision, real, boolean, uuid[], jsonb),
  public.registrar_adjunto(uuid, uuid, public.tipo_adjunto, text), public.publicar_dia(uuid, date)
  to authenticated;
revoke all on function public.tomar_trabajo(text, int, text), public.publicar_programado() from public, anon, authenticated;

-- Tiempo real para el panel (SPEC 3.4): las reglas de arriba deciden qué ve cada uno.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.entregas, public.eventos_entrega, public.clasificaciones_entrega;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fotos de entregas: bucket privado (SPEC 9 y 10)
-- ---------------------------------------------------------------------------
-- Ruta: {empresa}/{entrega}/{adjunto}.jpg. El conductor sube solo a sus entregas publicadas;
-- el administrador de la empresa lee. Retención de 12 meses: Fase 11.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('entregas', 'entregas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy entregas_fotos_subir on storage.objects for insert to authenticated
      with check (bucket_id = 'entregas' and exists (
        select 1 from public.entregas e
        where e.id::text = (storage.foldername(name))[2] and e.empresa_id::text = (storage.foldername(name))[1]
          and e.conductor_id = auth.uid() and e.estado not in ('borrador', 'asignada')))
  $p$;
  execute $p$
    create policy entregas_fotos_ver on storage.objects for select to authenticated
      using (bucket_id = 'entregas' and (
        exists (select 1 from public.adjuntos a where a.ruta = name and public.es_admin(a.empresa_id))
        or exists (select 1 from public.entregas e where e.id::text = (storage.foldername(name))[2] and e.conductor_id = auth.uid())))
  $p$;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relojes (pg_cron; la URL y la clave del barrido del agente viven en Vault, nunca aquí)
-- ---------------------------------------------------------------------------
create or replace function public.barrer_agente_entregas()
returns void
language plpgsql security definer set search_path = public, extensions, vault
as $$
declare
  url text;
  clave text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'reparto_url_funciones';
  select decrypted_secret into clave from vault.decrypted_secrets where name = 'reparto_clave_servicio';
  if url is null or clave is null then
    raise notice 'barrer_agente_entregas: faltan los secretos en Vault, no hago nada.';
    return;
  end if;
  if not exists (select 1 from public.cola_agentes where agente = 'entregas' and estado = 'pendiente') then return; end if;
  perform net.http_post(url := rtrim(url, '/') || '/agente-entregas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || clave),
    body := jsonb_build_object('accion', 'barrer'));
end;
$$;
revoke all on function public.barrer_agente_entregas() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'Sin pg_cron: el reloj de publicación y el barrido del agente no corren aquí.';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(j.jobname) from cron.job j where j.jobname in ('reparto_publicar', 'reparto_agente_entregas');
  -- Nunca en el minuto 0 (ahí se encola medio mundo).
  perform cron.schedule('reparto_publicar', '2-57/5 * * * *', 'select public.publicar_programado()');
  perform cron.schedule('reparto_agente_entregas', '1-59/2 * * * *', 'select public.barrer_agente_entregas()');
end;
$$;
