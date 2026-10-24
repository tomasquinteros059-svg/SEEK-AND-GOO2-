# Revisión de viabilidad (24 de octubre de 2026)

Revisión pedida por el cliente: «esto debe ser viable y realista». Se contrastan el diseño ampliado (`agentes-y-whatsapp.md`), los precios (`06-precios.md`) y lo construido (Fases 0 y 1).

## 1. Lo que está bien encaminado
- **Costo fijo bajo:** ~USD 45 al mes durante la validación (SPEC 12).
- **Lo construido funciona y está probado contra un Supabase real:** cuentas, empresas, invitaciones, licencias y reglas de acceso, con 45 pruebas de base de datos y 9 de punta a punta.
- **Sin dependencias raras:** Supabase, Expo y Next.js son estándar, y cualquier programador puede seguir el proyecto.

## 2. El problema principal: WhatsApp y las llamadas no caben en el precio
El plan Flota cobra **$10.990 + IVA por conductor al mes (≈ USD 11,7)**. Operar la app sin WhatsApp cuesta ~USD 3 por conductor (SPEC 12).

| Por conductor al mes | Entregas a personas (SPEC: 20 al día) | Entregas a empresas (supuesto: 10 paradas al día) |
|---|---|---|
| Operación base (SPEC 12) | USD 3,0 | USD 3,0 |
| 1 WhatsApp por entrega (USD 0,020 c/u) | USD 9,6 | USD 4,8 |
| Llamadas Twilio (si el 10 % cae a teléfono, ~1 min) | USD 4,0 | USD 2,0 |
| **Costo total** | **USD 16,6: pérdida** | **USD 9,8: margen ~16 %** |
| Ingreso del plan Flota | USD 11,7 | USD 11,7 |

**Conclusión:** con WhatsApp y llamadas incluidos en el precio actual, el negocio **pierde plata** con entregas a personas, y gana muy poco con entregas a empresas.

**Recomendación (lo que hace el mercado):**
- **Incluido en el plan:** la app, la web de seguimiento y las notificaciones dentro de la app, que son casi gratis.
- **WhatsApp: extra cobrado por uso**, por ejemplo **$25 por mensaje** (≈ USD 0,027, margen ~30 %). Alternativa: incluir un cupo, por ejemplo 200 mensajes por conductor al mes, y cobrar lo que pase de ahí.
- **Llamada automática: apagada por defecto**, y se cobra por minuto si la empresa la activa.
- **Aprovechar lo gratis:** las respuestas dentro de las 24 horas son gratis hasta 1.000 al mes por número. Las plantillas (avisos que salen de la empresa) siempre se pagan.

## 3. Entregas a empresas (como Jumbo): lo que la SPEC no contempla
La SPEC se pensó para entregas a personas en su casa. Una entrega a un local de una cadena suele tener:
- **horario de recepción del local** (por ejemplo, 7:00 a 11:00) y a veces **cita agendada**;
- **número de guía de despacho u orden de compra** y **cantidad de bultos**;
- **la guía firmada o timbrada** como comprobante (es la foto que importa);
- **rechazos parciales** (recibieron 10 de 12 cajas).

Si se usan, conviene incluirlos **en la Fase 2**, que es donde se define la entrega. Agregarlos después obliga a rehacer.

**Y una consecuencia:** el personal de recepción de un local no va a instalar una app. Para ellos sirven **WhatsApp y la página web con enlace**. La app del receptor puede esperar, y eso **recorta a la mitad la Fase 5**.

## 4. Alcance: demasiado antes de validar
Quedan 11 fases y 5 agentes. Cada fase necesita que tú la pruebes con teléfonos. Para validar con **una empresa y ~5 conductores** basta con:

| Orden | Qué | Por qué |
|---|---|---|
| 1 | **Fase 2:** entregas (con los datos para empresas), carga por Excel, mapa | Sin entregas no hay nada que probar |
| 2 | **Fase 3:** el día del conductor, con foto y mensaje obligatorios, y el Agente de Entregas | Es el corazón: el mensaje que llega al administrador |
| 3 | **Prueba temprana del GPS** (1 hora con Waze abierto en Android y en iPhone) | Es **el mayor riesgo técnico** (iOS cierra apps en segundo plano). Mejor saberlo pronto que en la Fase 4 |
| 4 | **WhatsApp básico:** `aviso_llegada` y `paquete_entregado` desde el panel, con el número de prueba | Lo que el cliente pidió, con costo controlado |
| 5 | Seguimiento web con enlace (Fase 5, versión corta) | Lo que verá el cliente |
| Después, **si la validación lo pide** | Llamadas Twilio, Agente de Rutas con optimización, «Enseñarle» y memoria, app del receptor | Son útiles, pero no deciden si el producto sirve |

## 5. Trámites con plazos que no dependen del código
| Trámite | Plazo | Bloquea |
|---|---|---|
| Verificación del negocio en Meta (lo estás haciendo) | Días a semanas | WhatsApp con número propio |
| App Review de Meta (permisos de WhatsApp) | Días | WhatsApp para otras empresas |
| Google Play: formulario y video de ubicación en segundo plano | 1 a 2 semanas | Publicar en Android |
| Apple: revisión de apps que rastrean empleados | Puede pedir ajustes | Publicar en iPhone |
| Número chileno en Twilio (papeles de la empresa) | Días | Llamadas (si se hacen) |

## 6. Otros riesgos, dichos claro
- **Ley 21.719** (datos personales): entra en vigencia el **1 de diciembre de 2026**, en 5 semanas, salvo que se postergue. Los textos legales son borradores sin revisión de un abogado.
- **Lo que aún no se probó en el mundo real:** la app instalada en tu teléfono, la compilación en Expo, Meta y Twilio. Hasta tu prueba, eso es «construido», no «funcionando».
- **Con un solo cliente se pierde plata** (`06-precios.md`): el plan de prueba tiene que apuntar a convertir.
