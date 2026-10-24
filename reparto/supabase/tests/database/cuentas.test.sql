-- Fase 1 · cuentas y perfiles: "cada uno ve solo lo propio" (SPEC 4.2 y 16).
--
-- Personas del caso real (docs/01-caso-real.md):
--   a1 Carolina  admin de Despachos Cordillera (crea la empresa)
--   a2 Rodrigo   invitado como segundo admin de Despachos Cordillera
--   c1 Matías    conductor de Despachos Cordillera y de Ferretería El Roble
--   b1 Beatriz   admin de Ferretería El Roble
--   e9 Extraño   tiene cuenta, pero no trabaja en ninguna empresa
begin;
select plan(41);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'carolina@cordillera.cl', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'rodrigo@cordillera.cl',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'matias@correo.cl',       'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'beatriz@elroble.cl',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e9', 'extrano@correo.cl',      'authenticated', 'authenticated');

-- ===== Carolina crea su cuenta y su empresa ==================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok($$ insert into public.usuarios (id, nombre, telefono, correo)
  values ('00000000-0000-0000-0000-0000000000a1', 'Carolina Fuentes', '+56911111111', 'carolina@cordillera.cl') $$,
  'Carolina completa sus datos');
select throws_ok($$ insert into public.usuarios (id, nombre, telefono, correo)
  values ('00000000-0000-0000-0000-0000000000a2', 'Rodrigo Paz', '+56922222222', 'rodrigo@cordillera.cl') $$,
  '42501', null, 'Nadie crea el perfil de otra persona');
select throws_ok($$ update public.usuarios set correo = 'otro@correo.cl' where id = auth.uid() $$,
  '42501', null, 'El correo no se cambia a mano (viene del inicio de sesión)');
select throws_ok($$ select public.crear_empresa('X', '+5622') $$,
  '23514', null, 'Un teléfono de contacto inválido no pasa');
select lives_ok($$ select public.crear_empresa('Despachos Cordillera SpA', '+56222222222') $$,
  'Carolina crea Despachos Cordillera');
select ok((select public.es_admin(id) from public.empresas where nombre = 'Despachos Cordillera SpA'),
  'Quien crea la empresa queda como administrador');

select lives_ok($$ insert into public.invitaciones (id, empresa_id, correo, rol, invitada_por)
  select '00000000-0000-0000-0000-00000000f001', id, 'rodrigo@cordillera.cl', 'admin', auth.uid()
  from public.empresas where nombre = 'Despachos Cordillera SpA' $$,
  'Carolina invita a Rodrigo como administrador');
select lives_ok($$ insert into public.invitaciones (id, empresa_id, correo, rol, invitada_por)
  select '00000000-0000-0000-0000-00000000f002', id, 'matias@correo.cl', 'conductor', auth.uid()
  from public.empresas where nombre = 'Despachos Cordillera SpA' $$,
  'Carolina invita a Matías como conductor');
select throws_ok($$ insert into public.invitaciones (empresa_id, correo, rol, invitada_por)
  select id, 'matias@correo.cl', 'conductor', auth.uid() from public.empresas where nombre = 'Despachos Cordillera SpA' $$,
  '23505', null, 'Invitar dos veces al mismo correo no duplica');

-- ===== Rodrigo entra con su correo y acepta ==================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
insert into public.usuarios (id, nombre, telefono, correo)
  values ('00000000-0000-0000-0000-0000000000a2', 'Rodrigo Paz', '+56922222222', 'rodrigo@cordillera.cl');

select is((select count(*) from public.mis_invitaciones()), 1::bigint, 'Rodrigo ve la invitación a su correo');
select is((select empresa from public.mis_invitaciones()), 'Despachos Cordillera SpA', '…con el nombre de la empresa');
select is_empty($$ select 1 from public.empresas $$, 'Antes de aceptar, Rodrigo no ve la empresa');
select lives_ok($$ select public.aceptar_invitacion('00000000-0000-0000-0000-00000000f001') $$, 'Rodrigo acepta');
select ok((select public.es_admin(id) from public.empresas where nombre = 'Despachos Cordillera SpA'),
  'Rodrigo ya es administrador: la empresa tiene dos');
select throws_ok($$ select public.aceptar_invitacion('00000000-0000-0000-0000-00000000f001') $$,
  'P0001', null, 'Una invitación aceptada no se vuelve a usar');

-- ===== Beatriz crea Ferretería El Roble e invita a Matías ====================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
insert into public.usuarios (id, nombre, telefono, correo)
  values ('00000000-0000-0000-0000-0000000000b1', 'Beatriz Soto', '+56933333333', 'beatriz@elroble.cl');
select public.crear_empresa('Ferretería El Roble', '+56244444444');
insert into public.invitaciones (id, empresa_id, correo, rol, invitada_por)
  select '00000000-0000-0000-0000-00000000f003', id, 'matias@correo.cl', 'conductor', auth.uid()
  from public.empresas where nombre = 'Ferretería El Roble';

-- ===== El extraño no puede tomar una invitación ajena =========================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
insert into public.usuarios (id, nombre, telefono, correo)
  values ('00000000-0000-0000-0000-0000000000e9', 'Persona Extraña', '+56955555555', 'extrano@correo.cl');
select throws_ok($$ select public.aceptar_invitacion('00000000-0000-0000-0000-00000000f002') $$,
  '42501', null, 'Nadie acepta una invitación dirigida a otro correo');
select is_empty($$ select 1 from public.invitaciones $$, 'El extraño no ve invitaciones ajenas');

-- ===== Matías acepta las dos empresas =========================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select public.aceptar_invitacion('00000000-0000-0000-0000-00000000f002') $$,
  'P0001', null, 'Sin completar sus datos, Matías no puede aceptar');
insert into public.usuarios (id, nombre, telefono, correo)
  values ('00000000-0000-0000-0000-0000000000c1', 'Matías Rojas', '+56966666666', 'matias@correo.cl');
select lives_ok($$ select public.aceptar_invitacion('00000000-0000-0000-0000-00000000f002') $$, 'Matías acepta Despachos Cordillera');
select lives_ok($$ select public.aceptar_invitacion('00000000-0000-0000-0000-00000000f003') $$, 'Matías acepta Ferretería El Roble');
select is((select count(*) from public.empresas), 2::bigint, 'Matías ve sus dos empresas');
select is((select count(*) from public.membresias), 2::bigint, 'Matías ve solo sus propias membresías');
select is_empty($$ select 1 from public.usuarios where id <> auth.uid() $$, 'Matías no ve los datos de nadie más');
select throws_ok($$ insert into public.invitaciones (empresa_id, correo, rol, invitada_por)
  select id, 'amigo@correo.cl', 'conductor', auth.uid() from public.empresas limit 1 $$,
  '42501', null, 'Un conductor no puede invitar');
update public.empresas set nombre = 'Hackeada';  -- RLS: no afecta ninguna fila

select lives_ok($$ insert into public.documentos_conductor (usuario_id, tipo, ruta, vence)
  values (auth.uid(), 'licencia', '00000000-0000-0000-0000-0000000000c1/licencia.jpg', '2028-05-01') $$,
  'Matías sube su licencia a su carpeta');
select throws_ok($$ insert into public.documentos_conductor (usuario_id, tipo, ruta)
  values (auth.uid(), 'camion', '00000000-0000-0000-0000-0000000000a1/trampa.jpg') $$,
  '23514', null, 'No puede registrar un archivo fuera de su carpeta');
select lives_ok($$ insert into public.consentimientos (usuario_id, tipo, version) values (auth.uid(), 'terminos', '1.0') $$,
  'Matías acepta los Términos');
select throws_ok($$ update public.consentimientos set version = '0.1' $$,
  '42501', null, 'Un consentimiento no se edita');

-- ===== Lo que ve Carolina =====================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select nombre from public.empresas), 'Despachos Cordillera SpA', 'Matías no pudo renombrar la empresa, y Carolina ve solo la suya');
select set_eq($$ select nombre from public.usuarios $$,
  array['Carolina Fuentes', 'Rodrigo Paz', 'Matías Rojas'],
  'Carolina ve a su equipo y a nadie de otra empresa');
select is_empty($$ select 1 from public.invitaciones i join public.empresas e on e.id = i.empresa_id where e.nombre = 'Ferretería El Roble' $$,
  'Carolina no ve las invitaciones de otra empresa');
select is((select count(*) from public.documentos_conductor), 1::bigint, 'Carolina ve la licencia de su conductor');
select is_empty($$ select 1 from public.consentimientos $$, 'Carolina no ve los consentimientos de otros');
select lives_ok($$ insert into public.revisiones_documento (documento_id, empresa_id, estado, revisado_por, revisado_en)
  select d.id, e.id, 'aprobado', auth.uid(), now() from public.documentos_conductor d, public.empresas e $$,
  'Carolina aprueba la licencia para su empresa');

-- ===== Lo que ve Beatriz ======================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select set_eq($$ select nombre from public.usuarios $$, array['Beatriz Soto', 'Matías Rojas'],
  'Beatriz ve a Matías (su conductor) pero no a Carolina ni a Rodrigo');
select is_empty($$ select 1 from public.revisiones_documento $$, 'La aprobación de otra empresa no se ve ni cuenta');
select throws_ok($$ update public.membresias set estado = 'suspendido' where usuario_id = auth.uid() $$,
  'P0001', null, 'La única administradora no puede suspenderse: la empresa no queda sin admin');

-- ===== Lo que ve Matías de sus papeles =======================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select estado::text from public.revisiones_documento), 'aprobado', 'Matías ve en qué quedó la revisión de su licencia');

-- ===== El extraño y los anónimos =============================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
select is_empty($$ select 1 from public.empresas $$, 'El extraño no ve ninguna empresa');
select is_empty($$ select 1 from public.documentos_conductor $$, 'El extraño no ve licencias');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.empresas $$, '42501', null, 'Sin cuenta no se ve nada');

select * from finish();
rollback;
