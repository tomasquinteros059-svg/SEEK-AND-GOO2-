-- Fase 3 · el día del conductor: publicar, jornada, eventos idempotentes, fotos y mensaje obligatorios.
begin;
select plan(32);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'carolina@cordillera.cl', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'matias@correo.cl', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'otro@correo.cl', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'beatriz@elroble.cl', 'authenticated', 'authenticated');
insert into public.usuarios (id, nombre, telefono, correo) values
  ('00000000-0000-0000-0000-0000000000a1', 'Carolina Fuentes', '+56911111111', 'carolina@cordillera.cl'),
  ('00000000-0000-0000-0000-0000000000c1', 'Matías Rojas', '+56966666666', 'matias@correo.cl'),
  ('00000000-0000-0000-0000-0000000000c2', 'Otro Conductor', '+56977777777', 'otro@correo.cl'),
  ('00000000-0000-0000-0000-0000000000b1', 'Beatriz Soto', '+56933333333', 'beatriz@elroble.cl');
insert into public.empresas (id, nombre, telefono_contacto) values
  ('00000000-0000-0000-0000-00000000e001', 'Despachos Cordillera SpA', '+56222222222'),
  ('00000000-0000-0000-0000-00000000e002', 'Ferretería El Roble', '+56244444444');
insert into public.membresias (usuario_id, empresa_id, rol) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 'admin'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000e001', 'conductor'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000e001', 'conductor'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000e002', 'admin');
insert into public.receptores (id, empresa_id, nombre, direccion, comuna) values
  ('00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-00000000e001', 'Jumbo La Florida', 'Av. Vicuña Mackenna 7110', 'La Florida');
insert into public.entregas (id, empresa_id, receptor_id, conductor_id, fecha, direccion, guia, bultos) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-0000000000c1', '2026-10-27', 'x', 'G-1', 12),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-0000000000c1', '2026-10-27', 'x', 'G-2', 3),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-0000000000c1', '2026-10-27', 'x', 'G-3', 1),
  ('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-0000000000c2', '2026-10-27', 'x', 'G-4', 1);
insert into public.pagos (entrega_id, empresa_id, tipo, monto, forma, estado) values
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000e001', 'cobrar', 45990, 'cualquiera', 'pendiente');

set local role authenticated;

-- ===== Antes de publicar =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select public.registrar_adjunto('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-00000000d001', 'guia',
  '00000000-0000-0000-0000-00000000e001/00000000-0000-0000-0000-00000000d001/f1.jpg') $$, '42501', null,
  'Antes de publicar, el conductor no puede registrar nada');

-- ===== Carolina publica el día =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.publicar_dia('00000000-0000-0000-0000-00000000e001', '2026-10-27'), 4, 'Publicar el día publica las 4 asignadas');

-- ===== Matías inicia la ruta =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.iniciar_jornada('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000e001', '2026-10-27', now()),
  '00000000-0000-0000-0000-00000000aa01'::uuid, 'Matías inicia su ruta');
select is((select count(*) from public.entregas where jornada_id = '00000000-0000-0000-0000-00000000aa01'), 3::bigint,
  'Sus 3 entregas quedan en la jornada (y ve solo las suyas)');
select is(public.iniciar_jornada('00000000-0000-0000-0000-00000000aa99', '00000000-0000-0000-0000-00000000e001', '2026-10-27', now()),
  '00000000-0000-0000-0000-00000000aa01'::uuid, 'Iniciar otra vez el mismo día reabre la misma jornada');

select lives_ok($$ select public.registrar_evento('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-00000000d001', 'en_camino', now()) $$,
  'Sale hacia la primera');
select is((select estado::text from public.entregas where id = '00000000-0000-0000-0000-00000000d001'), 'en_camino', 'que queda en camino');
select is(public.registrar_evento('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-00000000d001', 'llegue', now()), 'ok', 'Toca «Llegué»');
select is((select estado::text from public.entregas where id = '00000000-0000-0000-0000-00000000d001'), 'en_destino', 'y queda en destino');

-- ===== Entregar: foto y mensaje obligatorios =====
select throws_ok($$ select public.registrar_evento('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-00000000d001', 'entregada', now(), 'Recibió Pedro') $$,
  'P0001', null, 'Sin foto no se entrega');
select is(public.registrar_adjunto('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-00000000d001', 'guia',
  '00000000-0000-0000-0000-00000000e001/00000000-0000-0000-0000-00000000d001/f1.jpg'), 'ok', 'Sube la foto de la guía firmada');
select is(public.registrar_adjunto('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-00000000d001', 'guia',
  '00000000-0000-0000-0000-00000000e001/00000000-0000-0000-0000-00000000d001/f1.jpg'), 'ya_recibido', 'La misma foto dos veces no se duplica');
select throws_ok($$ select public.registrar_evento('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-00000000d001', 'entregada', now(), '  ',
  null, null, null, null, false, array['00000000-0000-0000-0000-0000000f0001'::uuid]) $$, 'P0001', null, 'Sin mensaje no se entrega');
select is(public.registrar_evento('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-00000000d001', 'entregada', '2026-10-27 11:58-03',
  'Recibió Pedro en andén 3, 12 bultos', null, -33.52, -70.59, 8, true, array['00000000-0000-0000-0000-0000000f0001'::uuid]), 'ok',
  'Con foto y mensaje, entrega (registrada sin señal a las 11:58)');
select is(public.registrar_evento('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-00000000d001', 'entregada', now(),
  'otra vez', null, null, null, null, false, array['00000000-0000-0000-0000-0000000f0001'::uuid]), 'ya_recibido',
  'El mismo envío otra vez responde «ya recibido»');
select is((select estado::text from public.entregas where id = '00000000-0000-0000-0000-00000000d001'), 'entregada', 'La entrega queda entregada');
select is(public.registrar_evento('00000000-0000-0000-0000-0000000e0004', '00000000-0000-0000-0000-00000000d001', 'en_camino', now()), 'ok',
  'Un «en camino» que llega tarde se guarda…');
select is((select estado::text from public.entregas where id = '00000000-0000-0000-0000-00000000d001'), 'entregada', '…pero no retrocede la entrega');

-- ===== Cobro registrado =====
select lives_ok($$ select public.registrar_adjunto('00000000-0000-0000-0000-0000000f0002', '00000000-0000-0000-0000-00000000d002', 'guia',
  '00000000-0000-0000-0000-00000000e001/00000000-0000-0000-0000-00000000d002/f2.jpg') $$, 'Foto de la segunda entrega');
select lives_ok($$ select public.registrar_evento('00000000-0000-0000-0000-0000000e0005', '00000000-0000-0000-0000-00000000d002', 'entregada', now(), 'Pagó por transferencia',
  null, null, null, null, false, array['00000000-0000-0000-0000-0000000f0002'::uuid], '{"forma":"transferencia"}') $$, 'La entrega con cobro');
select is((select estado::text || '/' || forma::text from public.pagos where entrega_id = '00000000-0000-0000-0000-00000000d002'), 'confirmado/transferencia',
  'El cobro queda registrado como confirmado');

-- ===== No entregado: motivo, foto y mensaje =====
select lives_ok($$ select public.registrar_adjunto('00000000-0000-0000-0000-0000000f0003', '00000000-0000-0000-0000-00000000d003', 'entrega',
  '00000000-0000-0000-0000-00000000e001/00000000-0000-0000-0000-00000000d003/f3.jpg') $$, 'Foto del local cerrado');
select throws_ok($$ select public.registrar_evento('00000000-0000-0000-0000-0000000e0006', '00000000-0000-0000-0000-00000000d003', 'no_entregada', now(),
  'Cortina abajo', null, null, null, null, false, array['00000000-0000-0000-0000-0000000f0003'::uuid]) $$, 'P0001', null, '«No entregado» exige motivo');
select is(public.registrar_evento('00000000-0000-0000-0000-0000000e0006', '00000000-0000-0000-0000-00000000d003', 'no_entregada', now(),
  'Cortina abajo a las 10:40', 'Local cerrado', null, null, null, false, array['00000000-0000-0000-0000-0000000f0003'::uuid]), 'ok', 'Con motivo, queda no entregada');
select is((select estado::text from public.entregas where id = '00000000-0000-0000-0000-00000000d003'), 'fallida', 'en estado fallida');

-- ===== Otro conductor no toca lo de Matías =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.registrar_evento('00000000-0000-0000-0000-0000000e0099', '00000000-0000-0000-0000-00000000d001', 'llegue', now()) $$,
  '42501', null, 'Otro conductor no registra eventos en entregas ajenas');
select throws_ok($$ select * from public.tomar_trabajo('entregas') $$, '42501', null, 'Ni nadie de la app toma trabajo de los agentes');

-- ===== Lo que ve Carolina y lo que no ve Beatriz =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select mensaje from public.eventos_entrega where id = '00000000-0000-0000-0000-0000000e0003'), 'Recibió Pedro en andén 3, 12 bultos',
  'Carolina ve el mensaje del conductor');
select is((select to_char(ocurrido_en at time zone 'America/Santiago', 'HH24:MI') from public.eventos_entrega where id = '00000000-0000-0000-0000-0000000e0003'), '11:58',
  'con la hora real en que ocurrió');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is_empty($$ select 1 from public.eventos_entrega union all select 1 from public.adjuntos union all select 1 from public.jornadas $$,
  'Beatriz no ve nada de Despachos Cordillera');

-- ===== Terminar ruta =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.terminar_jornada('00000000-0000-0000-0000-00000000aa01', now()) ->> 'entregadas', '2', 'El resumen al terminar cuenta 2 entregadas');

reset role;
select is((select count(*) from public.cola_agentes where agente = 'entregas'), 3::bigint,
  'Quedaron 3 trabajos para el Agente de Entregas (2 entregas y 1 no entregada), sin duplicar');

select * from finish();
rollback;
