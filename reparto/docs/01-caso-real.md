# Caso real de referencia: un día de Matías

Este relato es el **caso de prueba de referencia** del proyecto. Cada fase de construcción debe poder reproducirlo. Al final, la app completa debe recorrerlo de punta a punta.

Todos los nombres, direcciones, montos y patentes son **ficticios**.

## Reparto
- **Empresa:** Despachos Cordillera SpA. Dos administradores: Carolina Fuentes y Rodrigo Paz.
- **Conductor:** Matías Rojas, camioneta patente KXTR-41. También trabaja para otra empresa, Ferretería El Roble, pero hoy no tiene entregas con ella.
- **Sectores:** Oriente (Providencia, Ñuñoa) y Sur (La Florida, Puente Alto).

| # | Receptor | Dirección | Sector | Hora comprometida | Pago | Cómo entra el receptor |
|---|---|---|---|---|---|---|
| E1 | Javiera Muñoz | Los Leones 1180, Providencia | Oriente | 09:15 | Ya pagada | App instalada |
| E2 | Pedro Álvarez | Irarrázaval 3410, Ñuñoa | Oriente | 09:50 | Cobrar $45.990, transferencia | App instalada |
| E3 | Sofía Contreras | Walker Martínez 2050, La Florida | Sur | 10:40 | Ya pagada | Web con código |
| E4 | Luis Bravo | Pje. Los Aromos 455, Puente Alto | Sur | 11:45 | Cobrar $22.500, efectivo | Web con código |

## Umbrales que usa este relato
Son una propuesta que se fija en `SPEC.md`.
- **Hora estimada de llegada (ETA):** hora a la que se calcula que el conductor llegará. Se recalcula cada 60 segundos con la posición actual.
- **"Cerca":** cuando faltan 5 minutos o menos según la ETA.
- **"Llegó":** cuando el conductor está a menos de 80 metros durante 60 segundos, o cuando toca "Llegué".
- **Retraso:** cuando la ETA supera la hora comprometida por más de 15 minutos **y eso se mantiene 5 minutos seguidos**. Así, un semáforo largo no dispara la alerta.

## La víspera (lunes, 19:30)
| Hora | Quién | Qué hace | Qué debe pasar en el sistema |
|---|---|---|---|
| 19:30 | Carolina | Crea las 4 entregas en el panel web, asigna a Matías y marca E2 y E4 como "cobrar". | Las entregas quedan en estado *asignada*. Matías aún no ve nada, porque se publican al día siguiente a las 07:00. |
| 19:35 | Carolina | Le pide al asistente: "genera los códigos de mañana". | El asistente crea un código único por receptor y le muestra la lista a Carolina. **No envía nada.** Queda registrado: "Carolina pidió generar 4 códigos, 19:35". |
| 19:40 | Carolina | Copia los códigos de Sofía y Luis y se los manda por privado. Javiera y Pedro ya tienen la app. | Javiera y Pedro ven la entrega en su app sin buscarla, porque está vinculada a su número de teléfono. |
| 20:00 | Carolina | Programa un mensaje para todos los conductores: "Mañana corte de calle en Irarrázaval entre 08:00 y 10:00". Se publicará a las 08:20. | El mensaje queda *programado*. |

## El día (martes)
| Hora | Quién | Evento | Qué debe pasar en el sistema |
|---|---|---|---|
| 08:20 | Sistema | Se publica el aviso programado en el tablero de conductores. | Matías recibe una notificación. El aviso queda en el tablero. |
| 08:30 | Matías | Abre la app, elige "Despachos Cordillera" y ve sus 4 entregas en el orden propuesto. | Solo ve sus 4 entregas, nunca las de otros conductores. |
| 08:45 | Matías | Toca **Iniciar ruta**. | **Empieza a enviarse la ubicación.** El mapa del administrador lo muestra en el sector Oriente. Javiera recibe "Tu paquete va en camino, llega aprox. 09:12". |
| 09:07 | Sistema | ETA de E1 a 5 minutos. | Aviso "cerca" a Javiera y a Carolina. |
| 09:12 | Matías | Llega, toma una foto del paquete entregado y toca **Confirmar entrega** (ya pagada). | E1 queda *entregada*. Aviso "llegó" a Javiera y a Carolina. Se calcula la ETA de E2. Pedro recibe "en camino". |
| 09:20 | Pedro | Escribe al conductor: "¿Puede dejarlo en conserjería?". | El mensaje llega a Matías y también a la bandeja de Carolina. El asistente sugiere una respuesta, pero no la envía. |
| 09:22 | Matías | Responde "Sí, sin problema". | — |
| 09:40 | Pedro | En **Pago** sube la foto de su transferencia de $45.990. | Estado de pago: *informado por receptor*. Matías y Carolina lo ven. |
| 09:48 | Matías | Entrega en conserjería, ve el comprobante, toma una foto y toca **Confirmar pago y entrega**. | E2 queda *entregada y pagada (transferencia)*. |
| 09:55 | Matías | Sale hacia el sector Sur. Hay un choque en Vicuña Mackenna. | El mapa del administrador lo muestra moviéndose al sector Sur. |
| 10:17 | Sistema | La ETA de E3 pasa a 11:08 (28 min sobre la hora comprometida). | Empieza a contar la ventana de 5 minutos. **Todavía no hay alerta.** |
| 10:22 | Sistema | La ETA sigue más de 15 min atrasada durante 5 minutos. | **Alerta de retraso** a Matías, con el botón "Reportar al administrador". Carolina ve a Matías en rojo en el mapa. |
| 10:23 | Matías | Toca el botón, toma una foto del taco, escribe "Choque en Vicuña Mackenna" y lo envía **al administrador**. | Carolina recibe el reporte con la foto. |
| 10:25 | Carolina | Le dice al asistente: "avísale a Sofía que su entrega se atrasa unos 30 minutos por un accidente". | El asistente identifica a "Sofía" como Sofía Contreras (E3) y le muestra a Carolina el mensaje listo. Carolina toca **Enviar**. Queda registrado quién lo pidió, cuándo y qué se envió. |
| 11:00 | Sofía | Desde la web con código toca **Llamar al conductor**. | Llamada por internet. Ninguno ve el número del otro. |
| 11:08 | Matías | Entrega E3. Sofía sube una foto del paquete recibido con el mensaje "Gracias". | E3 queda *entregada*. El comprobante de Sofía le llega a Carolina. |
| 11:58 | Matías | Llega a E4 dentro de un condominio **sin señal**. Recibe $22.500 en efectivo, toma una foto del dinero y del paquete entregado, y toca **Guardar sin señal**. | La app guarda la entrega en el teléfono con un identificador único. Muestra "1 entrega pendiente de enviar". Ningún aviso sale todavía. |
| 12:14 | Sistema | Matías recupera señal. | Se envía la entrega **una sola vez**. Si llega dos veces, el servidor reconoce el identificador y no la duplica. Se conserva la hora real (11:58), no la del envío. Luis y Carolina reciben "llegó" con la nota "registrado 11:58 sin señal". |
| 12:25 | Matías | Toca **Terminar ruta**. | **Deja de enviarse la ubicación.** Resumen: 4 entregas, 1 retraso, $68.490 cobrados (1 transferencia, 1 efectivo). |

## Qué prueba este caso
- El conductor solo ve lo suyo, el receptor solo su paquete y el administrador solo su empresa.
- La ubicación se envía solo entre "Iniciar ruta" y "Terminar ruta".
- Un semáforo no dispara alerta. Un retraso sostenido sí la dispara.
- El asistente nunca escribe a un receptor sin una orden explícita del administrador.
- Una entrega hecha sin señal no se pierde ni se duplica.
- Las llamadas no exponen números.
- Los cobros quedan registrados con comprobante.
