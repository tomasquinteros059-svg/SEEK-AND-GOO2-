-- Fase 0: la base tiene lo que la SPEC necesita y la consulta de salud responde.
begin;
select plan(4);

select has_extension('postgis', 'PostGIS está instalado (cálculos geográficos)');
select has_function('public', 'salud', 'Existe la consulta de salud');
select is((public.salud() ->> 'ok')::boolean, true, 'La consulta de salud responde ok');
select ok(
  extensions.st_distancesphere(
    extensions.st_makepoint(-70.6109, -33.4263), -- Los Leones 1180, Providencia (caso de Matías)
    extensions.st_makepoint(-70.6017, -33.4549)  -- Irarrázaval 3410, Ñuñoa
  ) between 2500 and 4500,
  'PostGIS calcula distancias en metros entre dos puntos de Santiago'
);

select * from finish();
rollback;
