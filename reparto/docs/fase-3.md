# Fase 3 · El día del conductor

**Estado:** construida y probada aquí contra un Supabase real (local), con la función del agente funcionando. Falta tu prueba con dos teléfonos.
**Listo cuando** (SPEC 16): con dos teléfonos haces el día de Matías y el administrador ve cada estado cambiar al instante.

## Qué se construyó
### App del conductor
| Pantalla | Qué hace |
|---|---|
| **Ruta de hoy** | Las entregas publicadas del día con local, dirección, guía, bultos, hora y horario de recepción. **Iniciar ruta** y **Terminar ruta**. Al terminar avisa si quedan entregas abiertas o envíos sin señal, y muestra el resumen: entregadas, no entregadas, bultos y lo cobrado |
| **Entrega** | Botones **Waze** y **Google Maps** (al salir marca «en camino»), **Llegué**, **Entregar** y **No entregado**. El conductor ve el local y la nota, **nunca el teléfono del contacto** |
| **Entregar** | Foto de la **guía firmada o timbrada (obligatoria)**, foto de los bultos (opcional) y **mensaje obligatorio**, que se puede dictar con el micrófono del teclado. Si hay cobro: forma de pago y «Recibí el pago». Guarda **la hora y la ubicación** automáticamente |
| **No entregado** | **Motivo** con un toque (local cerrado, fuera de horario, rechazado…), foto y mensaje, los tres obligatorios |
| **Revisión de la foto** | Si hay señal, el **Agente de Entregas** revisa la foto en el momento (hasta ~8 s). Si no sirve, dice por qué y pide otra. Si no hay respuesta a tiempo, la entrega queda registrada igual y el agente la revisa después |
| **Sin señal** | Cada acción se guarda primero en el teléfono, con un **identificador único** y la **hora real**, y se envía cuando hay conexión. Si llega dos veces, el servidor responde «ya recibido» y no duplica. La ruta muestra «N envíos pendientes» |

### Panel del administrador
| Qué | Qué hace |
|---|---|
| **Publicar el día** | Botón en Entregas, que publica las asignadas para los conductores. Además se publican solas cada mañana a la hora configurada (por defecto 07:00) |
| **Entregas en vivo** | La lista se actualiza **sola** cuando el conductor entrega o el agente clasifica, con el indicador «En vivo». Muestra cuántas entregadas y cuántas **urgentes**, y marca «Foto por revisar» y «Revisar» |
| **Detalle de cada entrega** | Lo que pasó, con hora real («registrado sin señal» si corresponde) y **enlace a la ubicación**; **las fotos**; el **mensaje del conductor**; lo que concluyó el agente (entregada, no entregada o con incidencia, resumen y si es urgente); y el **mensaje propuesto para el cliente**, que el administrador corrige y guarda |

### El Agente de Entregas (`supabase/functions/agente-entregas`)
- **Recibe:** la foto principal y el mensaje del conductor.
- **Responde:**
  - si la foto sirve como comprobante;
  - si la entrega fue entregada, no entregada o con incidencia;
  - si es urgente;
  - un resumen;
  - el mensaje para el cliente, **hecho solo con lo que dijo el conductor**.
- **Nunca cambia el estado de la entrega:** lo decide el conductor (gana el hecho físico). Si lo que concluye no calza con lo que marcó el conductor, lo marca «Revisar».
- **Modelo:** Claude Haiku 5.5 (decisión del cliente, SPEC 3.11), con salida en JSON con esquema. Cuesta ~USD 0,0004 por entrega. Cada revisión queda en la auditoría (`acciones_asistente`) con su costo.
- **Revisión gratis previa:** una foto casi vacía (en negro) se rechaza sin llamar a la IA.
- **Sin clave de Anthropic corre en «modo simulado»:** reglas simples y gratis. Así se probó todo aquí. **Con la clave, la revisión de la foto la hace la IA de verdad; eso no se pudo probar aquí** y es parte de tu prueba.
- **Lo que escribe el conductor se trata como dato, no como orden** (SPEC 5.4.5).
- **Los agentes se comunican por una cola de trabajo** (`cola_agentes`), nunca llamándose entre sí. Cada 2 minutos un reloj procesa lo que quedó pendiente.

## Lo que se probó (todo en verde)
- **107 pruebas de base de datos** (32 nuevas):
  - publicar el día;
  - la jornada (reabrir el mismo día);
  - el mismo envío dos veces no duplica;
  - foto y mensaje obligatorios;
  - motivo obligatorio en «No entregado»;
  - un «en camino» que llega tarde no retrocede una entrega;
  - el cobro queda confirmado;
  - otro conductor no toca entregas ajenas;
  - la hora real «11:58 sin señal» se conserva;
  - otra empresa no ve nada;
  - el resumen al terminar.
- **6 pruebas del agente** (sin red):
  - la petición a la IA;
  - el mensaje del conductor como dato;
  - respuestas inválidas o rechazadas;
  - costo, modo simulado y «revisar».
- **5 pruebas de punta a punta en la app:** el día completo de Matías:
  - entra, se registra y acepta la invitación;
  - inicia la ruta;
  - entrega con una **foto en negro → el agente la rechaza → toma otra → aceptada**;
  - cobra $22.500 (sin «Recibí el pago» no deja);
  - marca un «No entregado» por local cerrado;
  - termina la ruta con el resumen correcto;
  - y Carolina ve mensajes, ubicación, cobro y clasificación.
- **3 pruebas de punta a punta en el panel:**
  - publicar el día;
  - **ver en vivo, sin recargar**, cómo la entrega de Matías pasa a «Entregada» y «Urgente» (2 cajas dañadas);
  - el detalle con mensaje, foto y ubicación;
  - corregir el mensaje para el cliente.

**Errores que encontraron las pruebas, ya corregidos:**
- una ambigüedad en el registro del cobro;
- el agente se caía al leer una respuesta vacía de la base y la app no recibía el veredicto;
- la app no podía llamar al agente desde el navegador por los permisos;
- el detalle de la entrega daba «no encontrada» (dos vínculos con la tabla de personas);
- «Volver a la ruta» dejaba al conductor en la entrega.

## Configurar
1. **Botón de GitHub «Reparto · migraciones (desarrollo)»:** ahora también publica la función del agente.
2. **Supabase → Edge Functions → Secrets:** `ANTHROPIC_API_KEY` (de platform.claude.com). Sin ella, el agente queda en modo simulado.
3. **Supabase → Vault:** `reparto_url_funciones` (`https://<ref>.supabase.co/functions/v1`) y `reparto_clave_servicio` (la `service_role`). Con eso, el reloj procesa lo pendiente cada 2 minutos.
4. **Hora de publicación:** por defecto 07:00 (hora de Chile). La configuración por empresa llega con la pantalla de Configuración.
5. **Vuelve a armar la app** con el botón «Reparto · app de prueba»: pide el permiso de ubicación «mientras se usa» y el de la cámara.

## Lista de aceptación (tu prueba, con dos teléfonos y el panel)
1. [ ] En el panel, crea o carga entregas de **hoy**, asígnalas a tu correo de conductor y toca **Publicar el día**.
2. [ ] En el teléfono del conductor: **Ruta de hoy → Iniciar ruta**. Ves las entregas en orden.
3. [ ] Abre una entrega, toca **Waze**: se abre la navegación y en el panel pasa a «En camino» **sin recargar**.
4. [ ] **Llegué**, y luego **Entregar** sin foto: no te deja. Toma una foto tapando la cámara: el agente la rechaza y pide otra. Toma la guía firmada y escribe o dicta el mensaje: queda entregada.
5. [ ] En el panel, sin recargar, la entrega pasa a «Entregada». En el detalle ves la foto, el mensaje, la hora, la ubicación y el mensaje propuesto para el cliente.
6. [ ] Haz una entrega escribiendo «2 cajas dañadas»: aparece como **Urgente**.
7. [ ] Marca otra como **No entregado** con su motivo.
8. [ ] **Modo avión:** entrega una con el teléfono sin señal. La app dice «Sin señal: quedó guardado». Al volver la señal se envía **una sola vez** y el panel muestra «registrado sin señal» con la hora real.
9. [ ] **Terminar ruta:** ves el resumen.

## Decisiones y límites de esta fase
- **La cola sin señal vive en la memoria de la app (AsyncStorage)** y las fotos en la carpeta temporal. Si el teléfono borra esa carpeta antes de recuperar la señal, se pierde la foto pendiente. La Fase 10 la pasa a una base local (SQLite) y a una carpeta permanente.
- **Las notificaciones push** («Tienes N entregas hoy») no están todavía. El conductor ve sus entregas al abrir la app. Llegan junto con los avisos.
- **El orden de las entregas** es por hora comprometida. El orden optimizado es del Agente de Rutas (Fase 8).
- **El mensaje para el cliente se prepara y se corrige, pero todavía no se envía:** eso es la fase de WhatsApp.
- **Las fotos de entrega van a la IA (Anthropic, EE.UU.)** cuando hay clave. Hay que agregarlo a la Política de privacidad antes de usarlo con clientes reales (pendiente de la lista general).
