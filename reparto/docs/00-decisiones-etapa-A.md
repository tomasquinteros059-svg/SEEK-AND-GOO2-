# Decisiones tomadas en la Etapa A

Respuestas del cliente a las preguntas de la Etapa A. Este archivo manda sobre el encargo original cuando hay diferencias.

## Acceso del receptor
- El **asistente de IA del administrador genera el código** de seguimiento de cada receptor.
- El administrador se lo envía al receptor **por privado** (por su cuenta, fuera de la app).
- Si el receptor **descarga la app**, la vinculación se hace dentro de la app (mismo número de teléfono).
- **No se usará WhatsApp** por ahora. Los avisos y mensajes viven dentro de la app y la web.

## Llamadas
- **Las llamadas entran en la primera versión.** Son llamadas **dentro de la app** (por internet, VoIP).
- Ningún perfil ve el número real del otro. El número se registra al crear la cuenta.

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
