# Fase 2 · Entregas y asignación

**Estado:** construida y probada aquí contra un Supabase real (local). Falta tu prueba.
**Listo cuando** (SPEC 16): subes un Excel de 50 filas y ves las listas, las por revisar y las con error; las entregas aparecen en el mapa en su sector.

## Qué se construyó (panel web)
| Sección | Qué hace |
|---|---|
| **Entregas** | Las entregas de un día: guía, cliente (local), comuna y sector, bultos, hora comprometida y horario de recepción, conductor y estado. Muestra cuántas entregas y bultos hay, cuántas faltan por asignar y cuántas no tienen ubicación. Se asigna el conductor fila por fila, se cancela, y se crea una entrega a mano: al escribir un cliente conocido, completa solo su dirección |
| **Cargar archivo** | Sube un Excel (.xlsx) o CSV. Reconoce las columnas aunque se llamen distinto («Local», «Guía de despacho», «Cajas», «Chofer»…) y aunque haya un título arriba. **Vista previa antes de crear nada:** listas, por revisar y con error, cada una con el motivo en palabras. Luego ubica las direcciones en el mapa con una barra de avance. Se puede descargar la **plantilla**, con una hoja de instrucciones |
| **Mapa** | Las entregas del día como puntos del color de su sector, con la lista por sector al lado. Las que no se encontraron aparecen en «Sin ubicación»: tocas «Marcar en el mapa» y haces clic donde está el local. **Se recuerda para las próximas entregas a ese local** |
| **Sectores** | Agrupar comunas en sectores con un color. Una comuna solo puede estar en un sector; al cambiarlos, se recalcula el sector de clientes y entregas que aún no salen |

### Qué revisa en cada fila
- **Con error (no se crea):** falta el cliente, la dirección, la guía, los bultos o la fecha; bultos en cero o con texto; fecha u hora imposibles; horario de recepción al revés; «cobrar» sin monto; guía repetida en el archivo (se marcan las dos filas, porque no se sabe cuál es la buena) o ya registrada.
- **Por revisar (se crea, pero conviene mirarla):** comuna que no es de la Región Metropolitana; sin teléfono de contacto (no se le podrá avisar por WhatsApp) o con un teléfono inválido; conductor que no existe o con nombre repetido (queda sin asignar); hora fuera del horario de recepción; fecha pasada; dirección no encontrada o aproximada.

### Datos de cada entrega (decisión del 24-oct-2026)
Cliente (local), dirección, comuna, contacto de recepción y su teléfono, fecha, hora comprometida, horario de recepción, **N° de guía (obligatorio)**, orden de compra, **bultos**, cobro al entregar (sí o no, monto y forma de pago), conductor y notas.
- **Un local se reconoce por su nombre:** «Jumbo La Florida» en dos cargas es el mismo cliente, no se duplica.
- **El teléfono del contacto lo ve solo el administrador; el conductor nunca** (SPEC 9).

## Ubicar direcciones, con costo casi cero
Orden de búsqueda:
1. **Memoria de la empresa.** En entregas a empresas los locales se repiten, así que cada dirección se busca una sola vez.
2. El proveedor configurado:
   - **Google Geocoding** si hay clave (`GOOGLE_GEOCODING_KEY`; unas 10.000 gratis al mes);
   - si no, **Nominatim**: el público, solo para poco volumen (1 por segundo), o el propio cuando exista el VPS en la Fase 8.
3. Si no se encuentra o queda aproximada, **por revisar**, y se marca a mano en el mapa.

Las memorias de direcciones son **por empresa**: nadie puede cambiar la ubicación de las direcciones de otra.

## Lo que se probó (todo en verde)
- **75 pruebas de base de datos** (30 nuevas):
  - sectores sin comunas repetidas;
  - el sector se asigna solo según la comuna;
  - asignar conductor pasa la entrega a «asignada»;
  - no se asigna un conductor de otra empresa;
  - la misma guía no se repite;
  - bultos de 1 en adelante;
  - no se salta de «asignada» a «entregada»;
  - una carga se crea una sola vez y reconoce el local existente;
  - el conductor no ve sus entregas hasta que se publican, y nunca ve el teléfono del contacto;
  - otra empresa no ve nada.
- **65 pruebas de reglas compartidas** (planilla, columnas, CSV, horas, montos, comunas y lectura de Google y Nominatim).
- **5 pruebas nuevas de punta a punta**, con el Excel de 50 filas de `apps/web/e2e/archivos/entregas-50.xlsx`:
  - da **41 listas, 5 por revisar y 4 con error**;
  - se crean 46 entregas;
  - aparecen 45 puntos en el mapa por sector;
  - la que faltaba se marca a mano y se agrega al mapa;
  - asignar conductor;
  - una entrega a mano que reconoce al cliente;
  - la guía repetida se rechaza.

**No se pudo probar aquí**, porque este entorno no llega a esos servicios: la búsqueda real en Google o Nominatim y las teselas del mapa (OpenFreeMap). Las respuestas de Google y Nominatim se probaron con ejemplos de su formato real. Tu prueba con direcciones de verdad es la que lo confirma.

## Configurar
En `reparto/apps/web/.env.local`, además de lo de la Fase 1:
```
GOOGLE_GEOCODING_KEY=...      (recomendado; sin esto usa el Nominatim público, más lento)
CORREO_CONTACTO=tu@correo.cl  (Nominatim pide identificarse)
```
Para la clave de Google: Google Cloud → APIs → habilita **Geocoding API** → Credenciales → crea una clave y restríngela a esa API. Pon un **tope diario**, por ejemplo 300 consultas, para no pagar sorpresas.

## Lista de aceptación (tu prueba)
1. [ ] En **Sectores**, crea al menos dos sectores con sus comunas. Una comuna ya usada aparece bloqueada.
2. [ ] En **Cargar archivo**, descarga la plantilla y llénala con **50 entregas reales o parecidas**: tus clientes, sus direcciones, guías y bultos. Deja algunas con errores a propósito (sin guía, bultos en 0, una comuna mal escrita).
3. [ ] Súbela. Ves cuántas quedaron **listas, por revisar y con error**, cada una con su motivo, y la barra mientras ubica las direcciones.
4. [ ] Crea las entregas. En **Entregas** ves el día con sus cifras.
5. [ ] En **Mapa**, los puntos están donde corresponden y del color de su sector. Si alguno no se encontró, márcalo a mano.
6. [ ] Asigna conductores y crea una entrega a mano para un cliente que ya existe.
7. [ ] GitHub → Actions: «Reparto · revisión» en verde.

## Decisiones de esta fase
- **Una entrega sin conductor queda «sin asignar» (borrador)**; al asignarle uno pasa a «asignada». Publicarla para el conductor es la Fase 3.
- **Las filas por revisar sí se crean**, para no frenar una carga de 50 por un detalle. Las sin ubicación se marcan después en el mapa.
- **Las filas con error no se crean:** se corrigen en el archivo y se vuelve a subir. Las ya creadas no se duplican, porque la guía es única.
- **El cobro al entregar se mantiene**, aunque la mayoría de las entregas a empresas van con factura.
