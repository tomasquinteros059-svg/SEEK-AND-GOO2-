-- Reparto · Fase 1 · cuentas y perfiles (SPEC 4.1 y 4.2)
--
-- Quién es quién y dónde trabaja:
--   usuarios               toda persona con cuenta (la crea su propio inicio de sesión)
--   empresas               los clientes de la app
--   membresias             quién trabaja en qué empresa y con qué rol (admin o conductor)
--   invitaciones           a quién invitó una empresa, por correo, antes de que tenga cuenta
--   documentos_conductor   licencia y papeles del camión (fotos privadas)
--   revisiones_documento   cada empresa revisa por su cuenta los papeles de sus conductores
--   consentimientos        Términos, Privacidad (y más adelante ubicación), con versión y fecha
--
-- LA REGLA DE ORO: las reglas de acceso viven aquí (RLS), no en la app. Valen
-- aunque la app o el panel tengan un error. Cada regla tiene su prueba en
-- supabase/tests/database/.
--
-- Las funciones que deciden permisos son `security definer` con
-- `search_path = ''`: así una regla no se puede engañar creando una tabla con
-- el mismo nombre en otro esquema, y no entra en bucle consultando la misma
-- tabla que protege.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null check (char_length(btrim(nombre)) between 3 and 120),
  telefono    text not null check (telefono ~ '^\+56[0-9]{9}$'),
  correo      text not null,
  foto_ruta   text,
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.usuarios is 'Toda persona con cuenta. El id es el de Supabase Auth; el correo se copia de ahí.';

create table public.empresas (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null check (char_length(btrim(nombre)) between 2 and 120),
  telefono_contacto text not null check (telefono_contacto ~ '^\+56[0-9]{9}$'),
  foto_ruta         text,
  -- Umbrales, hora de publicación, modo del asistente… (se llenan en fases siguientes).
  configuracion     jsonb not null default '{}'::jsonb,
  creada_por        uuid references public.usuarios (id) on delete set null,
  creada_en         timestamptz not null default now()
);
comment on table public.empresas is 'Las empresas que usan la app. Responsables de los datos de sus conductores y clientes (SPEC 10).';

create type public.rol_membresia as enum ('admin', 'conductor');
create type public.estado_membresia as enum ('activo', 'suspendido');

create table public.membresias (
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  rol         public.rol_membresia not null,
  estado      public.estado_membresia not null default 'activo',
  desde       timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);
create index on public.membresias (empresa_id);
comment on table public.membresias is
  'Quién trabaja dónde. Un conductor puede estar en varias empresas; una empresa puede tener varios administradores.';

create type public.estado_invitacion as enum ('pendiente', 'aceptada', 'rechazada', 'anulada');

create table public.invitaciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  correo       text not null check (correo = lower(btrim(correo)) and correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  rol          public.rol_membresia not null,
  estado       public.estado_invitacion not null default 'pendiente',
  invitada_por uuid references public.usuarios (id) on delete set null,
  creada_en    timestamptz not null default now(),
  respondida_en timestamptz,
  expira_en    timestamptz not null default now() + interval '14 days'
);
-- Una sola invitación pendiente por correo y empresa: invitar dos veces no duplica.
create unique index invitaciones_una_pendiente on public.invitaciones (empresa_id, correo) where estado = 'pendiente';
create index on public.invitaciones (correo) where estado = 'pendiente';
comment on table public.invitaciones is
  'Invitación por correo. Quien entra con ese correo (probado con el código) la ve y la acepta. No hay enlaces secretos que se puedan reenviar.';

create type public.tipo_documento as enum ('licencia', 'camion');
create type public.estado_revision as enum ('pendiente', 'aprobado', 'rechazado');

create table public.documentos_conductor (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  tipo        public.tipo_documento not null,
  ruta        text not null,   -- ruta en el bucket privado `documentos`: {usuario_id}/{archivo}
  vence       date,
  subido_en   timestamptz not null default now(),
  check (ruta like usuario_id::text || '/%')
);
create index on public.documentos_conductor (usuario_id);
comment on table public.documentos_conductor is 'Licencia y papeles del camión. La foto vive en un bucket privado.';

create table public.revisiones_documento (
  documento_id uuid not null references public.documentos_conductor (id) on delete cascade,
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  estado       public.estado_revision not null default 'pendiente',
  nota         text check (char_length(nota) <= 500),
  revisado_por uuid references public.usuarios (id) on delete set null,
  revisado_en  timestamptz,
  primary key (documento_id, empresa_id)
);
comment on table public.revisiones_documento is
  'Cada empresa revisa los papeles de sus conductores por su cuenta. Que otra empresa los aprobara no cuenta acá.';

create type public.tipo_consentimiento as enum ('terminos', 'privacidad', 'ubicacion');

create table public.consentimientos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  tipo        public.tipo_consentimiento not null,
  version     text not null check (char_length(version) between 1 and 20),
  aceptado_en timestamptz not null default now(),
  revocado_en timestamptz
);
create index on public.consentimientos (usuario_id, tipo);
comment on table public.consentimientos is 'Aceptaciones legales con versión y fecha (SPEC 10). Nunca se borran: se revocan.';

-- ---------------------------------------------------------------------------
-- Quién es quién (funciones de permiso)
-- ---------------------------------------------------------------------------

create or replace function public.mi_correo()
returns text
language sql stable security definer set search_path = ''
as $$ select lower(email) from auth.users where id = auth.uid() $$;

create or replace function public.es_admin(empresa uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membresias m
    where m.empresa_id = empresa and m.usuario_id = auth.uid()
      and m.rol = 'admin' and m.estado = 'activo'
  )
$$;

create or replace function public.es_miembro(empresa uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membresias m
    where m.empresa_id = empresa and m.usuario_id = auth.uid() and m.estado = 'activo'
  )
$$;

-- ¿Soy administrador de alguna empresa donde trabaja esta persona?
create or replace function public.administro_a(persona uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.membresias suya
    join public.membresias mia on mia.empresa_id = suya.empresa_id
    where suya.usuario_id = persona
      and mia.usuario_id = auth.uid() and mia.rol = 'admin' and mia.estado = 'activo'
  )
$$;

revoke all on function public.mi_correo(), public.es_admin(uuid), public.es_miembro(uuid), public.administro_a(uuid) from public, anon;
grant execute on function public.mi_correo(), public.es_admin(uuid), public.es_miembro(uuid), public.administro_a(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reglas de acceso (RLS)
-- ---------------------------------------------------------------------------

alter table public.usuarios             enable row level security;
alter table public.empresas             enable row level security;
alter table public.membresias           enable row level security;
alter table public.invitaciones         enable row level security;
alter table public.documentos_conductor enable row level security;
alter table public.revisiones_documento enable row level security;
alter table public.consentimientos      enable row level security;

-- Nadie anónimo ve nada de esto.
revoke all on public.usuarios, public.empresas, public.membresias, public.invitaciones,
  public.documentos_conductor, public.revisiones_documento, public.consentimientos from anon;

-- usuarios: cada uno se ve y se edita a sí mismo; el administrador ve a la gente de su empresa.
create policy usuarios_ver on public.usuarios for select to authenticated
  using (id = auth.uid() or public.administro_a(id));
create policy usuarios_crear on public.usuarios for insert to authenticated
  with check (id = auth.uid() and correo = public.mi_correo());
create policy usuarios_editar on public.usuarios for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and correo = public.mi_correo());

-- empresas: la ven sus miembros; la editan sus administradores. Se crean con `crear_empresa()`.
create policy empresas_ver on public.empresas for select to authenticated
  using (public.es_miembro(id));
create policy empresas_editar on public.empresas for update to authenticated
  using (public.es_admin(id)) with check (public.es_admin(id));

-- membresias: cada uno ve las suyas; el administrador ve y cambia las de su empresa.
create policy membresias_ver on public.membresias for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin(empresa_id));
create policy membresias_editar on public.membresias for update to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id));
create policy membresias_quitar on public.membresias for delete to authenticated
  using (public.es_admin(empresa_id));
-- Las altas solo entran por `crear_empresa()` y `aceptar_invitacion()`.

-- invitaciones: el administrador las crea, ve y anula; el invitado ve las de su correo.
create policy invitaciones_ver on public.invitaciones for select to authenticated
  using (public.es_admin(empresa_id) or correo = public.mi_correo());
create policy invitaciones_crear on public.invitaciones for insert to authenticated
  with check (public.es_admin(empresa_id) and estado = 'pendiente' and invitada_por = auth.uid());
create policy invitaciones_anular on public.invitaciones for update to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id) and estado = 'anulada');

-- documentos_conductor: el conductor sube y ve los suyos; el administrador de su empresa los ve.
create policy documentos_ver on public.documentos_conductor for select to authenticated
  using (usuario_id = auth.uid() or public.administro_a(usuario_id));
create policy documentos_subir on public.documentos_conductor for insert to authenticated
  with check (usuario_id = auth.uid());
create policy documentos_borrar on public.documentos_conductor for delete to authenticated
  using (usuario_id = auth.uid());

-- revisiones_documento: solo la empresa que revisa; el conductor ve en qué quedaron los suyos.
create policy revisiones_ver on public.revisiones_documento for select to authenticated
  using (
    public.es_admin(empresa_id)
    or exists (select 1 from public.documentos_conductor d where d.id = documento_id and d.usuario_id = auth.uid())
  );
create policy revisiones_crear on public.revisiones_documento for insert to authenticated
  with check (public.es_admin(empresa_id) and revisado_por = auth.uid()
    and exists (select 1 from public.documentos_conductor d where d.id = documento_id and public.administro_a(d.usuario_id)));
create policy revisiones_editar on public.revisiones_documento for update to authenticated
  using (public.es_admin(empresa_id)) with check (public.es_admin(empresa_id) and revisado_por = auth.uid());

-- consentimientos: cada uno registra y ve los suyos. No se editan ni se borran (solo se revocan con una función).
create policy consentimientos_ver on public.consentimientos for select to authenticated
  using (usuario_id = auth.uid());
create policy consentimientos_dar on public.consentimientos for insert to authenticated
  with check (usuario_id = auth.uid() and revocado_en is null);

-- Permisos por tabla (RLS decide además qué filas).
-- Supabase da por defecto TODOS los permisos a `authenticated` en cada tabla
-- nueva. Se quitan y se da solo lo necesario: así un cambio no permitido
-- falla con un error claro en vez de "no afectar ninguna fila" en silencio.
revoke all on public.usuarios, public.empresas, public.membresias, public.invitaciones,
  public.documentos_conductor, public.revisiones_documento, public.consentimientos from authenticated;
grant select, insert, update on public.usuarios to authenticated;
grant select, update on public.empresas to authenticated;
grant select, update, delete on public.membresias to authenticated;
grant select, insert, update on public.invitaciones to authenticated;
grant select, insert, delete on public.documentos_conductor to authenticated;
grant select, insert, update on public.revisiones_documento to authenticated;
grant select, insert on public.consentimientos to authenticated;

-- Columnas que nadie cambia a mano desde la app.
revoke update on public.usuarios from authenticated;
grant update (nombre, telefono, foto_ruta, actualizado_en) on public.usuarios to authenticated;
revoke update on public.empresas from authenticated;
grant update (nombre, telefono_contacto, foto_ruta, configuracion) on public.empresas to authenticated;
revoke update on public.membresias from authenticated;
grant update (estado) on public.membresias to authenticated;
revoke update on public.invitaciones from authenticated;
grant update (estado, respondida_en) on public.invitaciones to authenticated;

-- ---------------------------------------------------------------------------
-- Reglas que no son de lectura
-- ---------------------------------------------------------------------------

-- Una empresa nunca se queda sin administrador activo.
create or replace function public.cuidar_ultimo_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  empresa uuid := coalesce(old.empresa_id, new.empresa_id);
begin
  if old.rol = 'admin' and old.estado = 'activo'
     and (tg_op = 'DELETE' or new.estado <> 'activo')
     -- Si se borra la empresa entera, el borrado en cascada sí puede llevarse al último.
     and exists (select 1 from public.empresas e where e.id = empresa)
     and not exists (
       select 1 from public.membresias m
       where m.empresa_id = empresa and m.rol = 'admin' and m.estado = 'activo'
         and m.usuario_id <> old.usuario_id
     ) then
    raise exception 'La empresa no puede quedarse sin administrador. Invita a otro antes.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger membresias_ultimo_admin
  before update or delete on public.membresias
  for each row execute function public.cuidar_ultimo_admin();

create or replace function public.tocar_actualizado()
returns trigger language plpgsql set search_path = ''
as $$ begin new.actualizado_en := now(); return new; end; $$;

create trigger usuarios_actualizado before update on public.usuarios
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------------
-- Acciones (RPC)
-- ---------------------------------------------------------------------------

-- Crear una empresa: quien la crea queda como su primer administrador.
create or replace function public.crear_empresa(nombre text, telefono_contacto text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  nueva uuid;
begin
  if auth.uid() is null then
    raise exception 'Tienes que entrar con tu correo primero.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.usuarios u where u.id = auth.uid()) then
    raise exception 'Completa tus datos antes de crear la empresa.' using errcode = 'P0001';
  end if;

  insert into public.empresas (nombre, telefono_contacto, creada_por)
  values (btrim(crear_empresa.nombre), crear_empresa.telefono_contacto, auth.uid())
  returning id into nueva;

  insert into public.membresias (usuario_id, empresa_id, rol) values (auth.uid(), nueva, 'admin');
  return nueva;
end;
$$;

-- Aceptar una invitación dirigida a MI correo.
create or replace function public.aceptar_invitacion(invitacion uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitaciones;
begin
  if auth.uid() is null then
    raise exception 'Tienes que entrar con tu correo primero.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.usuarios u where u.id = auth.uid()) then
    raise exception 'Completa tus datos antes de aceptar.' using errcode = 'P0001';
  end if;

  select * into inv from public.invitaciones i
  where i.id = invitacion and i.correo = public.mi_correo()
  for update;

  if not found then
    raise exception 'Esa invitación no es para tu correo.' using errcode = '42501';
  end if;
  if inv.estado <> 'pendiente' then
    raise exception 'Esa invitación ya no está vigente.' using errcode = 'P0001';
  end if;
  if inv.expira_en < now() then
    raise exception 'Esa invitación venció. Pide que te inviten de nuevo.' using errcode = 'P0001';
  end if;

  insert into public.membresias (usuario_id, empresa_id, rol)
  values (auth.uid(), inv.empresa_id, inv.rol)
  on conflict (usuario_id, empresa_id) do update
    set rol = case when public.membresias.rol = 'admin' then 'admin'::public.rol_membresia else excluded.rol end,
        estado = 'activo';

  update public.invitaciones set estado = 'aceptada', respondida_en = now() where id = inv.id;
  return inv.empresa_id;
end;
$$;

create or replace function public.rechazar_invitacion(invitacion uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.invitaciones
     set estado = 'rechazada', respondida_en = now()
   where id = invitacion and correo = public.mi_correo() and estado = 'pendiente';
  if not found then
    raise exception 'Esa invitación no es para tu correo o ya no está vigente.' using errcode = 'P0001';
  end if;
end;
$$;

-- Lo que una persona puede saber de la empresa que la invita, antes de aceptar
-- (todavía no es miembro, así que la regla de `empresas` no la deja verla).
create or replace function public.mis_invitaciones()
returns table (id uuid, empresa_id uuid, empresa text, rol public.rol_membresia, creada_en timestamptz, expira_en timestamptz)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.empresa_id, e.nombre, i.rol, i.creada_en, i.expira_en
  from public.invitaciones i
  join public.empresas e on e.id = i.empresa_id
  where i.correo = public.mi_correo() and i.estado = 'pendiente' and i.expira_en > now()
  order by i.creada_en desc
$$;

create or replace function public.revocar_consentimiento(tipo_consentimiento public.tipo_consentimiento)
returns void
language sql security definer set search_path = ''
as $$
  update public.consentimientos set revocado_en = now()
  where usuario_id = auth.uid() and tipo = tipo_consentimiento and revocado_en is null
$$;

revoke all on function public.crear_empresa(text, text), public.aceptar_invitacion(uuid),
  public.rechazar_invitacion(uuid), public.mis_invitaciones(),
  public.revocar_consentimiento(public.tipo_consentimiento) from public, anon;
grant execute on function public.crear_empresa(text, text), public.aceptar_invitacion(uuid),
  public.rechazar_invitacion(uuid), public.mis_invitaciones(),
  public.revocar_consentimiento(public.tipo_consentimiento) to authenticated;
revoke all on function public.cuidar_ultimo_admin(), public.tocar_actualizado() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fotos privadas: licencias y papeles (SPEC 9)
-- ---------------------------------------------------------------------------
-- El bucket es privado: no hay enlaces públicos. Se ven con enlaces firmados
-- que vencen en minutos. Cada conductor escribe solo en su carpeta
-- `{su id}/`; el administrador de su empresa solo puede leer.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Sin esquema storage (Postgres sin Supabase): se omite el bucket de documentos.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documentos', 'documentos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy documentos_subir_propios on storage.objects for insert to authenticated
      with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy documentos_ver_propios_o_de_mi_equipo on storage.objects for select to authenticated
      using (bucket_id = 'documentos' and (
        (storage.foldername(name))[1] = auth.uid()::text
        -- Solo archivos registrados como documento de alguien de mi empresa.
        or exists (select 1 from public.documentos_conductor d
                   where d.ruta = name and public.administro_a(d.usuario_id))
      ))
  $p$;
  execute $p$
    create policy documentos_borrar_propios on storage.objects for delete to authenticated
      using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
end;
$$;
