-- Reparto · Fase 0 · cimientos de la base de datos
--
-- PostGIS para los cálculos geográficos (SPEC 3.4: puntos de entrega,
-- distancia "cerca" y "llegó"). Las tablas del negocio llegan en la Fase 1.

create extension if not exists postgis with schema extensions;

-- Una consulta mínima para comprobar desde la app, el panel o la CI que la
-- base responde y tiene lo que necesita. No expone ningún dato.
create or replace function public.salud()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'postgres', current_setting('server_version'),
    'postgis', (select extversion from pg_catalog.pg_extension where extname = 'postgis')
  );
$$;

comment on function public.salud() is
  'Responde si la base está viva y qué versión de Postgres y PostGIS tiene. Sin datos de nadie.';

revoke all on function public.salud() from public;
grant execute on function public.salud() to anon, authenticated;
