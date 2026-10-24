-- Fase 2 · entregas a locales de empresas clientes: sectores, guía, bultos, carga por archivo y quién ve qué.
begin;
select plan(30);

-- Personas y empresas (preparadas como superusuario; las reglas se prueban después).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'carolina@cordillera.cl', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'matias@correo.cl',       'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'otro@correo.cl',         'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'beatriz@elroble.cl',     'authenticated', 'authenticated');
insert into public.usuarios (id, nombre, telefono, correo) values
  ('00000000-0000-0000-0000-0000000000a1', 'Carolina Fuentes', '+56911111111', 'carolina@cordillera.cl'),
  ('00000000-0000-0000-0000-0000000000c1', 'Matías Rojas',     '+56966666666', 'matias@correo.cl'),
  ('00000000-0000-0000-0000-0000000000c2', 'Otro Conductor',   '+56977777777', 'otro@correo.cl'),
  ('00000000-0000-0000-0000-0000000000b1', 'Beatriz Soto',     '+56933333333', 'beatriz@elroble.cl');
insert into public.empresas (id, nombre, telefono_contacto) values
  ('00000000-0000-0000-0000-00000000e001', 'Despachos Cordillera SpA', '+56222222222'),
  ('00000000-0000-0000-0000-00000000e002', 'Ferretería El Roble', '+56244444444');
insert into public.membresias (usuario_id, empresa_id, rol) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 'admin'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000e001', 'conductor'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000e002', 'admin'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000e002', 'conductor');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- ===== Sectores =====
select lives_ok($$ insert into public.sectores (id, empresa_id, nombre, comunas) values
  ('00000000-0000-0000-0000-000000005e01', '00000000-0000-0000-0000-00000000e001', 'Oriente', array['Providencia', 'Ñuñoa']) $$,
  'Carolina crea el sector Oriente');
select lives_ok($$ insert into public.sectores (id, empresa_id, nombre, comunas) values
  ('00000000-0000-0000-0000-000000005e02', '00000000-0000-0000-0000-00000000e001', 'Sur', array['La Florida', 'Puente Alto']) $$,
  'y el sector Sur');
select is((select comunas from public.sectores where nombre = 'Oriente'), array['nunoa', 'providencia'],
  'Las comunas se guardan sin tildes ni mayúsculas');
select throws_ok($$ insert into public.sectores (empresa_id, nombre, comunas) values
  ('00000000-0000-0000-0000-00000000e001', 'Centro', array['ÑUÑOA']) $$,
  'P0001', null, 'Una comuna no puede estar en dos sectores');

-- ===== Un local cliente y su contacto =====
select lives_ok($$ insert into public.receptores (id, empresa_id, nombre, direccion, comuna, horario_desde, horario_hasta) values
  ('00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-00000000e001', 'Jumbo La Florida',
   'Av. Vicuña Mackenna 7110', 'La Florida', '07:00', '11:00') $$, 'Carolina crea el local Jumbo La Florida');
select is((select sector_id from public.receptores where nombre = 'Jumbo La Florida'), '00000000-0000-0000-0000-000000005e02'::uuid,
  'El local queda en el sector Sur por su comuna');
select lives_ok($$ insert into public.contactos_recepcion (empresa_id, receptor_id, nombre, telefono) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', 'Pedro (bodega)', '+56955555555') $$,
  'y su contacto de recepción');

-- ===== Entregas =====
select lives_ok($$ insert into public.entregas (id, empresa_id, receptor_id, fecha, direccion, comuna, guia, bultos) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01',
   '2026-10-27', 'Av. Vicuña Mackenna 7110', 'La Florida', 'G-1001', 12) $$, 'Una entrega con guía y bultos');
select is((select estado::text from public.entregas where guia = 'G-1001'), 'borrador', 'Sin conductor queda en borrador');
select is((select sector_id from public.entregas where guia = 'G-1001'), '00000000-0000-0000-0000-000000005e02'::uuid, 'y en su sector');
update public.entregas set conductor_id = '00000000-0000-0000-0000-0000000000c1' where guia = 'G-1001';
select is((select estado::text from public.entregas where guia = 'G-1001'), 'asignada', 'Al asignar conductor pasa a asignada');
select throws_ok($$ update public.entregas set conductor_id = '00000000-0000-0000-0000-0000000000c2' where guia = 'G-1001' $$,
  'P0001', null, 'No se asigna un conductor que no trabaja en la empresa');
select throws_ok($$ insert into public.entregas (empresa_id, receptor_id, fecha, direccion, guia, bultos) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', '2026-10-28', 'x', 'g-1001', 1) $$,
  '23505', null, 'La misma guía no se despacha dos veces mientras esté viva');
select throws_ok($$ insert into public.entregas (empresa_id, receptor_id, fecha, direccion, guia, bultos) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', '2026-10-28', 'x', 'G-2', 0) $$,
  '23514', null, 'Los bultos son al menos 1');
select throws_ok($$ update public.entregas set estado = 'entregada' where guia = 'G-1001' $$,
  'P0001', null, 'No se salta de asignada a entregada');

-- ===== Carga por archivo =====
insert into public.cargas (id, empresa_id, creada_por, archivo, filas) values
  ('00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1', 'martes.xlsx',
   '[{"n":2,"estado":"lista","datos":{"cliente":"jumbo la florida","direccion":"Av. Vicuña Mackenna 7110","comuna":"La Florida","fecha":"2026-10-27","hora":"09:30","desde":"07:00","hasta":"11:00","guia":"G-2001","oc":"OC-77","bultos":8,"cobro":"pagada","lat":-33.5206,"lng":-70.5986,"fuente":"simulado","conductor_id":"00000000-0000-0000-0000-0000000000c1","telefono":"+56955555555","contacto":"Pedro"}},
     {"n":3,"estado":"revisar","datos":{"cliente":"Líder Ñuñoa","direccion":"Irarrázaval 3410","comuna":"Ñuñoa","fecha":"2026-10-27","guia":"G-2002","bultos":3,"cobro":"cobrar","monto":45990,"forma":"transferencia"}},
     {"n":4,"estado":"error","datos":{"cliente":"","guia":"G-2003"}}]');
select is(public.crear_entregas_desde_carga('00000000-0000-0000-0000-00000000ca01'), 2, 'Crea las filas listas y por revisar, y salta las con error');
select is((select count(*) from public.receptores where clave = 'jumbo la florida'), 1::bigint, 'Reconoce el local ya existente: no lo duplica');
select is((select count(*) from public.contactos_recepcion), 1::bigint, 'Ni duplica su contacto');
select is((select p.estado::text from public.pagos p join public.entregas e on e.id = p.entrega_id where e.guia = 'G-2002'), 'pendiente',
  'La entrega con cobro queda con pago pendiente');
select is((select sector_id from public.entregas where guia = 'G-2002'), '00000000-0000-0000-0000-000000005e01'::uuid,
  'Líder Ñuñoa cae en el sector Oriente');
select throws_ok($$ select public.crear_entregas_desde_carga('00000000-0000-0000-0000-00000000ca01') $$,
  'P0001', null, 'Una carga no se crea dos veces');

-- ===== Ubicación a mano y el mapa =====
select lives_ok($$ select public.fijar_ubicacion((select id from public.receptores where clave = 'lider nunoa'), -33.4549, -70.6017) $$,
  'Carolina marca a mano el punto de Líder Ñuñoa');
select is((select round(lat::numeric, 4) from public.entregas_del_dia('00000000-0000-0000-0000-00000000e001', '2026-10-27') where guia = 'G-2002'),
  -33.4549, 'El mapa recibe el punto de la entrega');
select throws_ok($$ select public.fijar_ubicacion((select id from public.receptores where clave = 'lider nunoa'), 40.4, -3.7) $$,
  'P0001', null, 'Un punto fuera de Chile no se acepta');

-- ===== Lo que ve el conductor =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is_empty($$ select 1 from public.entregas $$, 'Matías no ve sus entregas mientras no se publiquen');
reset role;
update public.entregas set estado = 'publicada' where guia in ('G-1001', 'G-2001');
set local role authenticated;
select is((select count(*) from public.entregas), 2::bigint, 'Publicadas, Matías ve solo las suyas');
select is((select count(*) from public.receptores), 1::bigint, 'Ve el local al que va');
select is_empty($$ select 1 from public.contactos_recepcion $$, 'Pero nunca el teléfono del contacto');

-- ===== Otra empresa =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is_empty($$ select 1 from public.entregas union all select 1 from public.receptores union all select 1 from public.sectores $$,
  'Beatriz no ve nada de Despachos Cordillera');
select throws_ok($$ insert into public.entregas (empresa_id, receptor_id, fecha, direccion, guia, bultos) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', '2026-10-28', 'x', 'G-9', 1) $$,
  '42501', null, 'ni puede crear entregas en ella');

select * from finish();
rollback;
