# Precio de suscripción propuesto

Análisis del 19 de octubre de 2026. Precios en pesos chilenos, **más IVA**. Tipo de cambio supuesto: CLP 940 por USD (dólar observado aproximado de septiembre de 2026). El detalle con fórmulas está en la hoja **Precios** de `Reparto-costos-y-plan.xlsx`.

## Modelo: cobro por conductor activo
- **Quién paga:** la empresa (el administrador). Los **receptores y los administradores son ilimitados y gratis**.
- **Qué se cobra:** cada **conductor activo**, es decir, el que inició al menos una ruta en el mes.
- **Por qué este modelo:**
  - el costo de operar la app crece con los conductores (GPS, entregas, IA, llamadas), así que el precio crece igual;
  - es fácil de entender para el cliente;
  - un mes con menos conductores le cuesta menos.

## Planes
| Plan | Para quién | Precio + IVA | Equivale aprox. |
|---|---|---|---|
| **Prueba** | Validar sin riesgo | Gratis 30 días, hasta 5 conductores | — |
| **Pyme** | Hasta 5 conductores | **$59.990 al mes**, monto fijo | US$64 |
| **Flota** | 6 a 49 conductores | **$10.990 por conductor activo al mes** | US$11,7 |
| **Empresa** | 50 o más conductores | **$8.490 por conductor activo al mes**, contrato anual con pago mensual | US$9 |
| **Entregas extra** | Sobre el uso justo (800 entregas por conductor al mes) | $2.990 por cada 100 | US$3,2 |

- **Pago anual:** 2 meses gratis (pagas 10).
- **Todos los planes incluyen todo**, también el asistente de IA, que es el diferenciador.

## Márgenes
Margen sobre el costo de operar (servidores, IA, llamadas, comisión de pago). **No incluye** tu sueldo, soporte ni impuesto a la renta.

| Escenario | Ingreso al mes | Costo al mes | Margen al mes |
|---|---|---|---|
| 1 cliente Pyme (validación) | $59.990 | $92.816 | **−$32.826** (pérdida) |
| 3 clientes Pyme | $179.970 | $128.047 | $51.923 (29 %) |
| 1 cliente Flota de 20 conductores | $219.800 | $144.955 | $74.845 (34 %) |
| 10 clientes de 10 conductores (meta de la especificación) | $1.099.000 | $423.975 | **$675.025 (61 %)** |
| 1 cliente Empresa de 100 conductores | $849.000 | $415.200 | $433.800 (51 %) |

- **Punto de equilibrio:** con **2 clientes Pyme** se cubre el costo fijo de la plataforma.
- **Para tu cliente:** el plan Flota cuesta unos **$23 por entrega**, con 20 entregas al día durante 24 días.

## Comparación con la competencia
| Competidor | Precio publicado | Modelo |
|---|---|---|
| Tookan | US$29–100 por usuario al mes | Por usuario |
| Circuit for Teams | US$100–1.000 al mes | Por volumen de paradas |
| Onfleet | US$299–1.300 al mes | Por volumen |
| Shipday | Gratis hasta 300 pedidos al mes | Por pedidos |
| SimpliRoute (Chile) | Desde ~US$40, sin detalle | Por cotización |

Los precios de la competencia vienen de comparadores, no de páginas oficiales.

**Posición de Reparto:** más barato que las alternativas internacionales, en español de Chile, con el asistente de IA y el seguimiento del receptor incluidos.

## Advertencias
- Con un solo cliente se pierde plata. El plan de prueba gratis debe durar poco y apuntar a convertir.
- Los precios son una **hipótesis**: se validan en la Etapa B, preguntándole al administrador cuánto pagaría hoy por dejar de coordinar por WhatsApp.
- Para cobrar suscripciones con tarjeta en Chile se puede usar Flow (2,95 % + IVA, fuente secundaria) o Mercado Pago (~3,5 % + IVA). Necesitarás emitir factura o boleta electrónica (SII).
- El tipo de cambio afecta los costos, que están en dólares. Conviene revisar los precios cada 6 meses.
