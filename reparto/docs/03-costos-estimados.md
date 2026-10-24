# Costo mensual estimado con 100 conductores

Estimación **aproximada**, en dólares (USD), hecha en octubre de 2026 con precios publicados. En la Etapa C se rehace con la arquitectura definitiva. Las cifras que marco "a confirmar" vienen de fuentes secundarias.

## Supuestos de volumen
| Dato | Valor supuesto |
|---|---|
| Conductores | 100 |
| Entregas por conductor al día | 20 |
| Días hábiles al mes | 24 |
| **Entregas al mes** | **48.000** |
| Jornada en ruta | 9 h |
| Envío de ubicación | cada 15 s → ~5,2 millones de posiciones al mes |
| Fotos por entrega | 3, de ~250 KB cada una → ~36 GB al mes |
| Entregas con llamada | 30 %, de 2 min promedio |
| Administradores | 5 |
| Mensajes que procesa el asistente de IA | ~54.000 al mes (1 por entrega más las órdenes del administrador) |

Si el volumen real es distinto, el costo variable sube o baja más o menos en la misma proporción.

## Escenario A: económico (recomendado)
Usa mapas y cálculo de rutas propios, sobre datos libres de OpenStreetMap, y la IA combina un modelo barato con uno potente.

| Servicio | Para qué | USD/mes |
|---|---|---|
| Supabase Pro + servidor mediano | Base de datos, cuentas, tiempo real, fotos | ~105 |
| Servidor de rutas propio (VPS) | Hora estimada y orden de entregas, sin pagar por consulta | ~30 |
| Mapas propios (archivo de mapa de Chile) | Mostrar el mapa en la app y la web | ~5 |
| Llamadas por internet (Agora) | ~58.000 minutos-participante, los primeros 10.000 gratis | ~50 |
| Correo (Resend Pro) | Códigos de inicio de sesión | 20 |
| IA (Claude Haiku 5.5 + Sonnet 5.5) | Haiku para clasificar y redactar, Sonnet para las órdenes del administrador | ~100 |
| Compilación de apps (Expo EAS) | Generar las versiones de Android e iOS | 0–19 |
| Alojamiento del panel web | Panel del administrador y web del receptor | 0–20 |
| Cuenta de Apple ($99/año) y de Google ($25 una vez) | Publicar en las tiendas | ~8 |
| Dominio .cl | Dirección web | ~1 |
| Notificaciones push | Avisos al teléfono | 0 |
| **Total** | | **~320–360** |

Esto equivale a **~3,5 USD por conductor al mes**, o **menos de 1 centavo de dólar por entrega**.

## Escenario B: servicios comerciales de mapas y rutas
Usa Mapbox o Google para mapas y rutas, y Claude Sonnet 5.5 para todo el asistente.

| Cambio respecto de A | USD/mes |
|---|---|
| Mapas web Mapbox (~145.000 cargas; 50.000 gratis, luego $5 y $4 por cada 1.000) | ~430 |
| Rutas y hora estimada por consulta (~400.000 consultas) | ~600 (Mapbox, a confirmar) a ~2.000 (Google) |
| IA solo con Sonnet 5.5 | ~400–600 |
| Resto, igual que en A | ~230 |
| **Total** | **~1.700–3.300** |

## Por qué A sale 5 a 10 veces más barato
- **El mapa y la hora estimada son lo más caro.** Recalcular la hora estimada de 100 conductores cada pocos minutos con un servicio que cobra por consulta se dispara. Un servidor propio cuesta fijo, sin importar cuántas consultas haga.
- **Lo que A pierde:** el servidor propio no conoce el tráfico en vivo. La hora estimada se corrige con la velocidad real del conductor. Se puede consultar a Google solo cuando hay una sospecha de retraso, lo que agrega poco costo.
- **La IA:** Haiku 5.5 cuesta 20 veces menos que Sonnet 5.5, y clasificar o redactar mensajes es una tarea sencilla. Sonnet se reserva para entender órdenes como "avísale a Juan que…".

## Qué no incluye
- Horas de desarrollo y de mantención (se estiman en la Etapa G).
- Comisiones de las tiendas: solo aplican si se cobra dentro de la app, que no es el caso.
- Asesoría legal.

## Precios verificados (octubre 2026)
- Claude: Haiku 5.5 $0,10 / $0,50, Sonnet 5.5 $2 / $10 por millón de tokens de entrada y salida. Fuente: documentación de Anthropic.
- Supabase Pro: $25/mes; 8 GB de base de datos, 100 GB de archivos, $0,021 por GB adicional. Fuente secundaria. La cuota de mensajes en tiempo real está **a confirmar**.
- Mapbox: 50.000 cargas de mapa gratis, luego $5, $4 y $3 por cada 1.000. 100.000 consultas de rutas gratis; la tarifa posterior está **a confirmar**.
- Google Maps: desde marzo de 2025 da ~10.000 consultas gratis por servicio y luego cobra por cada 1.000. La tarifa de Routes está **a confirmar**.
- Agora: voz a $0,99 por cada 1.000 minutos-participante, con 10.000 gratis al mes.
- Resend: gratis hasta 3.000 correos al mes (100 al día); Pro a $20 por 50.000.
- Expo EAS: gratis con 15 compilaciones de Android y 15 de iOS al mes; Starter a $19.
- Apple: $99 al año. Google Play: $25 una sola vez.
