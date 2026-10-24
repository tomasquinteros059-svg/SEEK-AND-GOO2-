# Decisiones tomadas en la Etapa A

Respuestas del cliente a las preguntas de la Etapa A. Este archivo manda sobre el encargo original cuando hay diferencias.

## Acceso del receptor
- El **asistente de IA del administrador genera el código** de seguimiento de cada receptor.
- El administrador se lo envía al receptor **por privado** (por su cuenta, fuera de la app).
- Si el receptor **descarga la app**, la vinculación se hace dentro de la app (mismo número de teléfono).
- ~~**No se usará WhatsApp** por ahora. Los avisos y mensajes viven dentro de la app y la web.~~ **Reemplazada el 24-oct-2026:** sí se usa WhatsApp, solo por la vía oficial de Meta. Ver «Ampliación: agentes, WhatsApp y llamadas» al final.

## Llamadas
- **Las llamadas entran en la primera versión.** Son llamadas **dentro de la app** (por internet, VoIP).
- Ningún perfil ve el número real del otro. El número se registra al crear la cuenta.
- **Ampliada el 24-oct-2026:** además de las llamadas dentro de la app, se agrega una **llamada automática de aviso** al recepcionista. Ver «Ampliación: agentes, WhatsApp y llamadas» al final.

## Datos que se piden al registrarse
| Perfil | Obligatorio | Opcional |
|---|---|---|
| Conductor | Nombre completo, foto de licencia, correo, teléfono | Foto de documentos del camión |
| Administrador | Nombre de la empresa, nombre del administrador, teléfono de contacto | Foto |
| Receptor | Nombre completo, teléfono | — |

- Una empresa puede tener **más de un administrador**.
- Un conductor puede trabajar para **varias empresas**.

## Prioridad
- **El asistente de IA del administrador es lo más importante.** Debe poder comunicarse con cada conductor y cada receptor de la empresa.

## Plataformas
- **Android e iOS** desde el inicio.
- El cliente **tiene una empresa** para validar.

## Cobros
- Primera versión: el cobro se hace **fuera de la app**. La app solo lo registra.
- El receptor tiene una **sección de pago** donde puede:
  - subir una foto de la transferencia;
  - subir una foto del pago en efectivo entregado;
  - escribir un mensaje.
- **Pagar por transferencia dentro de la app** queda para evaluar en la Etapa C, por costo y regulación.

## Decisiones de la Etapa B
- **Asistente de IA con dos modos, que elige cada administrador:**
  - *Propone:* el asistente redacta y el administrador aprueba antes de enviar.
  - *Responde solo:* el asistente contesta sin pedir aprobación.

  En los dos modos todo queda registrado. Activar "responde solo" cuenta como la autorización explícita del administrador.
- **El código de inicio de sesión llega por correo electrónico, no por SMS.**
- **Carga masiva de entregas:** el administrador puede subir un archivo Excel o CSV con todas las entregas del día. El sistema muestra una vista previa con las filas listas, las que hay que revisar y las que tienen error, antes de crear nada. También se le puede pedir al asistente.
- Volumen de referencia para costos: **100 conductores**. Ver `03-costos-estimados.md`.
- **El receptor que instala la app entrega nombre, teléfono y correo.** El correo sirve para recibir el código de inicio de sesión. El receptor que entra por la web con código no necesita cuenta.
- **Presupuesto:** sin mínimo ni máximo fijo. El costo debe crecer en proporción a la cantidad de usuarios: arquitectura de costo fijo bajo y variable por uso.

## Decisiones de la Etapa C
- **Se aprueba la licencia Starter del plugin de GPS** (Transistorsoft): USD 399, pago único, cubre Android e iOS. Se compra al publicar en las tiendas; en desarrollo se usa gratis.
- **Abogado:** no por ahora. Se generaron borradores de Términos y Condiciones, Política de Privacidad y el texto del consentimiento de ubicación en `docs/legal/`.

- **Modelo de IA: Claude Sonnet 5.5 + Claude Haiku 5.5.** Sonnet entiende órdenes y usa herramientas; Haiku clasifica y redacta.
- **Los conductores son independientes** (sin contrato de trabajo).

## Etapa C cerrada
- **Especificación (`SPEC.md`) aprobada** por el cliente. El nombre de la app se define más adelante; mientras tanto se usa "Reparto".

## Pendiente de confirmar
1. Nombre de la app y dominio.
2. Datos de la empresa operadora para los textos legales: razón social, RUT, domicilio y correo de contacto.

## Ampliación: agentes, WhatsApp y llamadas (24 de octubre de 2026)
Pedido del cliente. El diseño completo está en `agentes-y-whatsapp.md` y **espera aprobación**.

| Antes | Ahora |
|---|---|
| «No se usará WhatsApp por ahora.» | **Sí se usa WhatsApp**, solo por la API oficial de Meta (WhatsApp Business Platform / Cloud API), para avisos, rutas y documentos. Prohibidas las librerías no oficiales (Baileys, whatsapp-web.js, conexión por QR). |
| Llamadas solo dentro de la app, con Stream. | Se mantienen, y se agrega una **llamada automática de aviso** al recepcionista: primero por internet (Stream); si no la recibe o no contesta en 15 s, llamada telefónica con costo (Twilio Voice, voz en español), un reintento a los 30 s y después aviso por WhatsApp. |
| Un asistente de IA. | **Cinco agentes** que se comunican por una cola de eventos: Entregas, Central, WhatsApp, Llamadas y Rutas. Siguen los modelos ya decididos (Sonnet 5.5 y Haiku 5.5) y los límites duros de la SPEC 5.4. |
| El asistente no aprende. | Modalidad **«Enseñarle»** y pantalla **«Correcciones»**, con el mismo esquema de Cotigestión: se aprende solo lo seguro y reversible; lo demás espera a una persona. Es memoria consultable, nunca reentrenar el modelo. |

**Se mantiene sin cambios:** los estados de entrega, el stack (Supabase, Expo, Next.js, OSRM y VROOM), la regla de que ninguna persona ve el teléfono de otra, y que las decisiones sobre conductores (asignar, suspender, pagar) las toma una persona.

