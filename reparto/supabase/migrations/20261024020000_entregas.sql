-- Reparto · Fase 2 · entregas y asignación (SPEC 2, 4.1, 4.2; decisiones del 24-oct-2026)
--
-- Las entregas son a EMPRESAS CLIENTES (por ejemplo, un local de Jumbo):
--   receptores           cada local que recibe, con su dirección, punto en el mapa y horario de recepción
--   contactos_recepcion  quién recibe en ese local (nombre y teléfono). El conductor NUNCA los ve
--   sectores             división del territorio por comunas (una comuna, un sector)
--   entregas             cada despacho: guía (obligatoria), orden de compra, bultos, fecha y hora
--   pagos                si se cobra al entregar, cuánto y cómo
--   cargas               la vista previa de un Excel antes de crear nada
--   geocodificaciones    direcciones ya ubicadas, para no volver a pagar por la misma (por empresa)

create extension if not exists unaccent with schema extensions;

-- Clave para comparar textos sin importar mayúsculas, tildes ni espacios de más.
create or replace function public.clave(texto text)
returns text
language sql immutable parallel safe set search_path = ''
as $$ select lower(regexp_replace(btrim(extensions.unaccent(coalesce(texto, ''))), '\s+', ' ', 'g')) $$;

-- ---------------------------------------------------------------------------
-- Sectores
-- ---------------------------------------------------------------------------
create table public.sectores (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 60),
  comunas    text[] not null default '{}',
  color      text not null default '#143b5c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  creado_en  timestamptz not null default now()
);
create unique index sectores_nombre_unico on public.sectores (empresa_id, public.clave(nombre));
comment on table public.sectores is 'División del territorio por comunas. Una comuna pertenece a un solo sector de la empresa.';

-- Las comunas se guardan normalizadas y una comuna no puede estar en dos sectores.
create or replace function public.revisar_sector()
returns trigger language plpgsql set search_path = ''
as $$
declare
  repetida text;
begin
  new.comunas := array(select distinct public.clave(c) from unnest(new.comunas) c where btrim(c) <> '' order by 1);
  select c into repetida
  from public.sectores s, unnest(s.comunas) c
  where s.empresa_id = new.empresa_id and s.id <> new.id and c = any (new.comunas)
  limit 1;
  if repetida is not null then
    raise exception 'La comuna % ya está en otro sector.', repetida using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger sectores_revisar before insert or update on public.sectores
  for each row execute function public.revisar_sector();

create or replace function public.sector_de(empresa uuid, comuna text)
returns uuid language sql stable set search_path = ''
as $$ select s.id from public.sectores s where s.empresa_id = empresa and public.clave(comuna) = any (s.comunas) limit 1 $$;

-- ---------------------------------------------------------------------------
-- Clientes (locales que reciben) y sus contactos
-- ---------------------------------------------------------------------------
create type public.fuente_ubicacion as enum ('cache', 'nominatim', 'google', 'manual', 'simulado');

create table public.receptores (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  nombre        text not null check (char_length(btrim(nombre)) between 2 and 120),  -- "Jumbo La Florida"
  clave         text generated always as (public.clave(nombre)) stored,
  direccion     text not null check (char_length(btrim(direccion)) between 3 and 200),
  comuna        text not null default '',
  punto         extensions.geography(Point, 4326),
  fuente        public.fuente_ubicacion,
  sector_id     uuid references public.sectores (id) on delete set null,
  horario_desde time,
  horario_hasta time,
  notas         text check (char_length(notas) <= 500),
  usuario_id    uuid references public.usuarios (id) on delete set null,  -- se vincula en la Fase 5
  creado_en     timestamptz not null default now(),
  check (horario_desde is null or horario_hasta is null or horario_desde < horario_hasta)
);
create unique index receptores_clave_unica on public.receptores (empresa_id, clave);
comment on table public.receptores is 'Los locales de las empresas clientes donde se entrega. Sin teléfonos: esos viven en contactos_recepcion.';

create table public.contactos_recepcion (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  receptor_id uuid not null references public.receptores (id) on delete cascade,
  nombre      text check (char_length(nombre) <= 120),
  telefono    text not null check (telefono ~ '^\+56[0-9]{9}$'),
  principal   boolean not null default true,
  creado_en   timestamptz not null default now(),
  unique (receptor_id, telefono)
);
comment on table public.contactos_recepcion is 'Quién recibe en cada local. Solo lo ven los administradores (SPEC 9: el conductor nunca ve teléfonos).';

-- ---------------------------------------------------------------------------
-- Entregas y pagos
-- ---------------------------------------------------------------------------
create type public.estado_entrega as enum
  ('borrador', 'asignada', 'publicada', 'en_camino', 'cerca', 'en_destino', 'entregada', 'fallida', 'cancelada');
create type public.tipo_pago as enum ('pagada', 'cobrar');
create type public.forma_pago as enum ('transferencia', 'efectivo', 'cualquiera');
create type public.estado_pago as enum ('no_aplica', 'pendiente', 'informado', 'confirmado', 'rechazado');

create table public.cargas (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  creada_por uuid references public.usuarios (id) on delete set null,
  archivo    text not null,
  estado     text not null default 'vista_previa' check (estado in ('vista_previa', 'creada', 'descartada')),
  filas      jsonb not null default '[]'::jsonb,
  creada_en  timestamptz not null default now()
);
comment on table public.cargas is 'Vista previa de un archivo de entregas: nada se crea hasta que el administrador confirma.';

create table public.entregas (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas (id) on delete cascade,
  receptor_id       uuid not null references public.receptores (id) on delete restrict,
  conductor_id      uuid references public.usuarios (id) on delete set null,
  jornada_id        uuid,  -- Fase 3
  fecha             date not null,
  hora_comprometida time,
  ventana_desde     time,
  ventana_hasta     time,
  direccion         text not null,
  comuna            text not null default '',
  punto             extensions.geography(Point, 4326),
  sector_id         uuid references public.sectores (id) on delete set null,
  guia              text not null check (char_length(btrim(guia)) between 1 and 40),
  orden_compra      text check (char_length(orden_compra) <= 40),
  bultos            integer not null check (bultos between 1 and 9999),
  notas             text check (char_length(notas) <= 500),
  estado            public.estado_entrega not null default 'borrador',
  orden             integer,
  eta               timestamptz,
  retraso_min       integer,
  carga_id          uuid references public.cargas (id) on delete set null,
  creada_por        uuid references public.usuarios (id) on delete set null,
  creada_en         timestamptz not null default now(),
  check (ventana_desde is null or ventana_hasta is null or ventana_desde < ventana_hasta)
);
create index on public.entregas (empresa_id, fecha);
create index on public.entregas (conductor_id, fecha);
create index on public.entregas using gist (punto);
-- Una guía corresponde a una entrega viva. Si falló o se canceló, se puede volver a despachar.
create unique index entregas_guia_viva on public.entregas (empresa_id, public.clave(guia))
  where estado not in ('fallida', 'cancelada');
comment on table public.entregas is 'Cada despacho a un local cliente, con su guía y sus bultos.';

create table public.pagos (
  entrega_id uuid primary key references public.entregas (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo       public.tipo_pago not null default 'pagada',
  monto      integer check (monto is null or monto > 0),
  forma      public.forma_pago,
  estado     public.estado_pago not null default 'no_aplica',
  check ((tipo = 'pagada' and monto is null) or (tipo = 'cobrar' and monto is not null))
);
comment on table public.pagos is 'Lo que se cobra al entregar (la mayoría de las entregas a empresas van con factura y no cobran aquí).';

create table public.geocodificaciones (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  clave      text not null,
  direccion  text not null,
  punto      extensions.geography(Point, 4326) not null,
  fuente     public.fuente_ubicacion not null,
  creada_en  timestamptz not null default now(),
  primary key (empresa_id, clave)
);
comment on table public.geocodificaciones is
  'Direcciones ya ubicadas. Por empresa: así nadie puede "envenenar" la ubicación de las direcciones de otra.';

-- Qué estado puede seguir a cuál: la misma tabla que paquetes/dominio/src/estados.ts.
create or replace function public.puede_pasar(de public.estado_entrega, a public.estado_entrega)
returns boolean language sql immutable set search_path = ''
as $$
  select case de
    when 'borrador'   then a in ('asignada', 'cancelada')
    when 'asignada'   then a in ('publicada', 'borrador', 'cancelada')
    when 'publicada'  then a in ('en_camino', 'en_destino', 'entregada', 'fallida', 'cancelada')
    when 'en_camino'  then a in ('cerca', 'en_destino', 'entregada', 'fallida', 'cancelada')
    when 'cerca'      then a in ('en_destino', 'entregada', 'fallida', 'cancelada')
    when 'en_destino' then a in ('entregada', 'fallida', 'cancelada')
    else false
  end
$$;

-- Al guardar una entrega: sector según comuna, estado según si tiene conductor,
-- el conductor debe trabajar en la empresa, y los cambios de estado respetan la tabla.
create or replace function public.revisar_entrega()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.sector_id is null or (tg_op = 'UPDATE' and new.comuna is distinct from old.comuna) then
    new.sector_id := public.sector_de(new.empresa_id, new.comuna);
  end if;

  if new.conductor_id is not null and not exists (
    select 1 from public.membresias m
    where m.empresa_id = new.empresa_id and m.usuario_id = new.conductor_id
      and m.rol = 'conductor' and m.estado = 'activo'
  ) then
    raise exception 'Esa persona no es un conductor activo de la empresa.' using errcode = 'P0001';
  end if;

  -- Asignar o quitar conductor mueve solo entre borrador y asignada.
  if new.estado = 'borrador' and new.conductor_id is not null then new.estado := 'asignada'; end if;
  if new.estado = 'asignada' and new.conductor_id is null then new.estado := 'borrador'; end if;

  if tg_op = 'UPDATE' and new.estado is distinct from old.estado
     and not public.puede_pasar(old.estado, new.estado)
     -- Gana el hecho físico (SPEC 6): una cancelada puede quedar entregada.
     and not (old.estado = 'cancelada' and new.estado = 'entregada') then
    raise exception 'Una entrega % no puede pasar a %.', old.estado, new.estado using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger entregas_revisar before insert or update on public.entregas
  for each row execute function public.revisar_entrega();

create or replace function public.revisar_receptor()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.sector_id is null or (tg_op = 'UPDATE' and new.comuna is distinct from old.comuna) then
    new.sector_id := public.sector_de(new.empresa_id, new.comuna);
  end if;
  return new;
end;
$$;
create trigger receptores_revisar before insert or update on public.receptores
  for each row execute function public.revisar_receptor();

-- Al cambiar los sectores, se recalcula el sector de clientes y entregas aún no publicadas.
create or replace function public.resectorizar()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  empresa uuid := coalesce(new.empresa_id, old.empresa_id);
begin
  update public.receptores r set sector_id = public.sector_de(empresa, r.comuna) where r.empresa_id = empresa;
  update public.entregas e set sector_id = public.sector_de(empresa, e.comuna)
   where e.empresa_id = empresa and e.estado in ('borrador', 'asignada');
  return null;
end;
$$;
create trigger sectores_resectorizar after insert or update or delete on public.sectores
  for each row execute function public.resectorizar();

-- ---------------------------------------------------------------------------
-- ¿Es una entrega que el conductor puede ver? (SPEC 4.2: solo sus entregas publicadas)
-- ---------------------------------------------------------------------------
create or replace function public.veo_como_conductor(entrega public.entregas)
returns boolean language sql stable security definer set search_path = ''
as $$
  select entrega.conductor_id = auth.uid()
     and entrega.estado not in ('borrador', 'asignada')
     and public.es_miembro(entrega.empresa_id)
$$;

create or replace function public.atiendo_a(receptor uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.entregas e
    where e.receptor_id = receptor and public.veo_como_conductor(e)
  )
$$;

-- ---------------------------------------------------------------------------
-- Reglas de acceso
-- ---------------------------------------------------------------------------
alter table public.sectores            enable row level security;
alter table public.receptores          enable row level security;
alter table public.contactos_recepcion enable row level security;
alter table public.entregas            enable row level security;
alter table public.pagos               enable row level security;
alter table public.cargas              enable row level security;
alter table public.geocodificaciones   enable row level security;

revoke all on public.sectores, public.receptores, public.contactos_recepcion, public.entregas,
  public.pagos, public.cargas, public.geocodificaciones from anon, authenticated;

-- Administrador: todo lo de su empresa.
create policy sectores_admin on public.sectores for all to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id));
create policy receptores_admin on public.receptores for all to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id));
create policy contactos_admin on public.contactos_recepcion for all to authenticated
  using (public.es_admin(empresa_id))
  with check (public.es_admin(empresa_id)
    and exists (select 1 from public.receptores r where r.id = receptor_id and r.empresa_id = contactos_recepcion.empresa_id));
create policy entregas_admin_ver on public.entregas for select to authenticated using (public.es_admin(empresa_id));
create policy entregas_admin_crear on public.entregas for insert to authenticated
  with check (public.es_admin(empresa_id) and estado in ('borrador', 'asignada')
    and exists (select 1 from public.receptores r where r.id = receptor_id and r.empresa_id = entregas.empresa_id));
create policy entregas_admin_editar on public.entregas for update to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id));
create policy entregas_admin_borrar on public.entregas for delete to authenticated
  using (public.es_admin(empresa_id) and estado in ('borrador', 'asignada'));
create policy pagos_admin on public.pagos for all to authenticated
  using (public.es_admin(empresa_id))
  with check (public.es_admin(empresa_id)
    and exists (select 1 from public.entregas e where e.id = entrega_id and e.empresa_id = pagos.empresa_id));
create policy cargas_admin on public.cargas for all to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id));
create policy geocodificaciones_admin on public.geocodificaciones for all to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id));

-- Conductor: solo sus entregas publicadas, el local (sin teléfonos) y si se cobra.
create policy entregas_conductor_ver on public.entregas for select to authenticated
  using (public.veo_como_conductor(entregas));
create policy receptores_conductor_ver on public.receptores for select to authenticated
  using (public.atiendo_a(id));
create policy pagos_conductor_ver on public.pagos for select to authenticated
  using (exists (select 1 from public.entregas e where e.id = entrega_id and public.veo_como_conductor(e)));

grant select, insert, update, delete on public.sectores, public.receptores, public.contactos_recepcion,
  public.entregas, public.pagos, public.cargas, public.geocodificaciones to authenticated;
-- Lo que el sistema calcula no se escribe a mano.
revoke update on public.entregas from authenticated;
grant update (receptor_id, conductor_id, fecha, hora_comprometida, ventana_desde, ventana_hasta, direccion, comuna,
  punto, guia, orden_compra, bultos, notas, estado, orden) on public.entregas to authenticated;
revoke update on public.receptores from authenticated;
grant update (nombre, direccion, comuna, punto, fuente, horario_desde, horario_hasta, notas) on public.receptores to authenticated;

-- ---------------------------------------------------------------------------
-- Acciones
-- ---------------------------------------------------------------------------

-- Crear las entregas de una vista previa, todo o nada. Corre con los permisos de
-- quien la llama (security invoker): las reglas de arriba deciden.
-- Cada fila de `cargas.filas` trae { estado: lista|revisar|error, datos: {...} }.
create or replace function public.crear_entregas_desde_carga(carga uuid)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  c public.cargas;
  fila jsonb;
  d jsonb;
  rec uuid;
  nueva uuid;
  punto extensions.geography;
  creadas integer := 0;
begin
  select * into c from public.cargas where id = carga for update;
  if not found then raise exception 'No encontré esa carga.' using errcode = 'P0001'; end if;
  if c.estado <> 'vista_previa' then raise exception 'Esa carga ya se procesó.' using errcode = 'P0001'; end if;

  for fila in select * from jsonb_array_elements(c.filas) loop
    continue when fila ->> 'estado' = 'error';
    d := fila -> 'datos';
    punto := case when d ? 'lat' and d ? 'lng' and d ->> 'lat' is not null
      then extensions.st_setsrid(extensions.st_makepoint((d ->> 'lng')::float8, (d ->> 'lat')::float8), 4326)::extensions.geography end;

    insert into public.receptores (empresa_id, nombre, direccion, comuna, punto, fuente, horario_desde, horario_hasta)
    values (c.empresa_id, d ->> 'cliente', d ->> 'direccion', coalesce(d ->> 'comuna', ''), punto,
            (d ->> 'fuente')::public.fuente_ubicacion, (d ->> 'desde')::time, (d ->> 'hasta')::time)
    on conflict (empresa_id, clave) do update
      set direccion = excluded.direccion,
          comuna = excluded.comuna,
          punto = coalesce(excluded.punto, public.receptores.punto),
          fuente = coalesce(excluded.fuente, public.receptores.fuente),
          horario_desde = coalesce(excluded.horario_desde, public.receptores.horario_desde),
          horario_hasta = coalesce(excluded.horario_hasta, public.receptores.horario_hasta)
    returning id into rec;

    if d ->> 'telefono' is not null then
      insert into public.contactos_recepcion (empresa_id, receptor_id, nombre, telefono)
      values (c.empresa_id, rec, d ->> 'contacto', d ->> 'telefono')
      on conflict (receptor_id, telefono) do update set nombre = coalesce(excluded.nombre, public.contactos_recepcion.nombre);
    end if;

    insert into public.entregas (empresa_id, receptor_id, conductor_id, fecha, hora_comprometida, ventana_desde, ventana_hasta,
      direccion, comuna, punto, guia, orden_compra, bultos, notas, carga_id, creada_por)
    values (c.empresa_id, rec, (d ->> 'conductor_id')::uuid, (d ->> 'fecha')::date, (d ->> 'hora')::time,
      (d ->> 'desde')::time, (d ->> 'hasta')::time, d ->> 'direccion', coalesce(d ->> 'comuna', ''), punto,
      d ->> 'guia', d ->> 'oc', (d ->> 'bultos')::integer, d ->> 'notas', c.id, auth.uid())
    returning id into nueva;

    insert into public.pagos (entrega_id, empresa_id, tipo, monto, forma, estado)
    values (nueva, c.empresa_id,
      coalesce((d ->> 'cobro')::public.tipo_pago, 'pagada'),
      case when d ->> 'cobro' = 'cobrar' then (d ->> 'monto')::integer end,
      case when d ->> 'cobro' = 'cobrar' then coalesce((d ->> 'forma')::public.forma_pago, 'cualquiera') end,
      case when d ->> 'cobro' = 'cobrar' then 'pendiente'::public.estado_pago else 'no_aplica'::public.estado_pago end);

    creadas := creadas + 1;
  end loop;

  update public.cargas set estado = 'creada' where id = c.id;
  return creadas;
end;
$$;

-- Marcar a mano el punto de un local (cuando la dirección no se encontró o quedó mal).
-- Corrige el local, sus entregas que aún no salen y la memoria de direcciones.
create or replace function public.fijar_ubicacion(receptor uuid, lat double precision, lng double precision)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  r public.receptores;
  p extensions.geography := extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;
begin
  if lat not between -56 and -17 or lng not between -76 and -66 then
    raise exception 'Ese punto está fuera de Chile.' using errcode = 'P0001';
  end if;
  update public.receptores set punto = p, fuente = 'manual' where id = receptor returning * into r;
  if not found then raise exception 'No encontré ese cliente.' using errcode = '42501'; end if;
  update public.entregas set punto = p
   where receptor_id = receptor and estado in ('borrador', 'asignada', 'publicada');
  insert into public.geocodificaciones (empresa_id, clave, direccion, punto, fuente)
  values (r.empresa_id, public.clave(r.direccion || ', ' || r.comuna), r.direccion || ', ' || r.comuna, p, 'manual')
  on conflict (empresa_id, clave) do update set punto = excluded.punto, fuente = 'manual', creada_en = now();
end;
$$;

-- Para el mapa: las entregas de un día con su punto en lat/lng (la API no entrega geografía en JSON legible).
create or replace function public.entregas_del_dia(empresa uuid, dia date)
returns table (
  id uuid, estado public.estado_entrega, guia text, bultos integer, cliente text, direccion text, comuna text,
  sector_id uuid, sector text, color text, conductor_id uuid, conductor text, hora_comprometida time,
  ventana_desde time, ventana_hasta time, lat double precision, lng double precision, receptor_id uuid
)
language sql stable security invoker set search_path = ''
as $$
  select e.id, e.estado, e.guia, e.bultos, r.nombre, e.direccion, e.comuna, e.sector_id, s.nombre, s.color,
         e.conductor_id, u.nombre, e.hora_comprometida, e.ventana_desde, e.ventana_hasta,
         extensions.st_y(e.punto::extensions.geometry), extensions.st_x(e.punto::extensions.geometry), e.receptor_id
  from public.entregas e
  join public.receptores r on r.id = e.receptor_id
  left join public.sectores s on s.id = e.sector_id
  left join public.usuarios u on u.id = e.conductor_id
  where e.empresa_id = empresa and e.fecha = dia
  order by e.hora_comprometida nulls last, r.nombre
$$;

-- Memoria de direcciones de la empresa (la usa el panel al ubicar).
create or replace function public.ubicacion_guardada(empresa uuid, clave_direccion text)
returns table (lat double precision, lng double precision)
language sql stable security invoker set search_path = ''
as $$
  select extensions.st_y(g.punto::extensions.geometry), extensions.st_x(g.punto::extensions.geometry)
  from public.geocodificaciones g where g.empresa_id = empresa and g.clave = clave_direccion
$$;

create or replace function public.guardar_ubicacion(empresa uuid, clave_direccion text, direccion text,
  lat double precision, lng double precision, fuente public.fuente_ubicacion)
returns void
language sql security invoker set search_path = ''
as $$
  insert into public.geocodificaciones (empresa_id, clave, direccion, punto, fuente)
  values (empresa, clave_direccion, direccion,
          extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography, fuente)
  on conflict (empresa_id, clave) do nothing
$$;

revoke all on function public.ubicacion_guardada(uuid, text),
  public.guardar_ubicacion(uuid, text, text, double precision, double precision, public.fuente_ubicacion) from public, anon;
grant execute on function public.ubicacion_guardada(uuid, text),
  public.guardar_ubicacion(uuid, text, text, double precision, double precision, public.fuente_ubicacion) to authenticated;

revoke all on function public.crear_entregas_desde_carga(uuid), public.fijar_ubicacion(uuid, double precision, double precision),
  public.entregas_del_dia(uuid, date) from public, anon;
grant execute on function public.crear_entregas_desde_carga(uuid), public.fijar_ubicacion(uuid, double precision, double precision),
  public.entregas_del_dia(uuid, date) to authenticated;
revoke all on function public.veo_como_conductor(public.entregas), public.atiendo_a(uuid) from public, anon;
grant execute on function public.veo_como_conductor(public.entregas), public.atiendo_a(uuid) to authenticated;
revoke all on function public.revisar_sector(), public.revisar_entrega(), public.revisar_receptor(), public.resectorizar()
  from public, anon, authenticated;
