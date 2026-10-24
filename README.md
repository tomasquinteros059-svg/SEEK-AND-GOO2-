# Asistente de Negocio

Programa local, para un solo usuario, que:

1. **Escanea fotos** de boletas, facturas, listas y formularios y extrae sus datos con IA (Claude).
2. **Guarda los datos en Excel** con formato chileno.
3. **Aprende de tu negocio**: notas, documentos y listas de clientes.
4. **Redacta mensajes** de WhatsApp, correo o SMS a partir de una instrucción simple (no envía nada).

También hay un **prototipo web** de una sola página en [`prototipo/`](prototipo/) que se abre en claude.ai y usa
tu propia cuenta de Claude (sin clave de API).

La propuesta técnica completa está en [`docs/PLAN.md`](docs/PLAN.md).

## Instalación

Necesitas **Python 3.11 o superior**.

```bash
# 1. Entra a la carpeta del proyecto
cd SEEK-AND-GOO2-

# 2. (Recomendado) crea un entorno virtual
python -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate

# 3. Instala las dependencias
pip install -r requirements.txt

# 4. Configura tu clave de API
cp .env.example .env             # En Windows: copy .env.example .env
```

Abre `.env` y escribe tu clave en `ANTHROPIC_API_KEY=` (se obtiene en <https://console.anthropic.com>).
La clave queda solo en tu computador; el archivo `.env` no se sube a git.

## Uso

```bash
streamlit run Inicio.py
```

Se abre el navegador en `http://localhost:8501`.

### Escanear documentos

1. Ve a **Escanear** en el menú lateral.
2. Sube una o varias fotos (JPG, PNG, HEIC) o PDF.
3. Elige el tipo de documento o deja **Automático**.
4. Presiona **Escanear**.
5. Revisa cada documento:
   - Lo marcado en **amarillo** la IA no lo pudo leer con seguridad. Revísalo con la foto al lado.
   - Si las sumas no cuadran (líneas vs. neto, neto + IVA vs. total) aparece un aviso en rojo.
     Los avisos se actualizan apenas corriges un valor.
   - Si el documento ya estaba guardado (mismo proveedor y número, o la misma foto) se avisa,
     y para guardarlo igual tienes que marcar «Guardar de todas formas».
6. Presiona **Guardar** (o **Descartar**).

La IA nunca rellena datos que no se ven: si algo no se lee, queda vacío y marcado para revisar.

### Excel

- **Descargar Excel**: crea un archivo con las hojas «Boletas y Facturas», «Detalle», «Listas», «Formularios»
  y «Resumen» (totales por mes y por proveedor).
- **Agregar a un Excel existente**: sube tu archivo; se agregan solo los documentos que no estaban.
- **Columnas**: renombra, oculta, ordena o agrega columnas. Para una columna nueva escribe qué debe buscar
  la IA (ej. «Forma de pago: efectivo, débito o crédito»); se llenará en los próximos escaneos.
- Cada vez que guardas un documento se actualiza `datos/documentos.xlsx` (si lo tienes abierto en Excel,
  ciérralo para que se pueda actualizar).
- Los montos usan el formato `$#,##0`: Excel configurado en español de Chile los muestra como $12.345.

### Base de conocimiento

- **Clientes y contactos**: importa tu lista desde Excel o CSV (puedes elegir qué columna es el nombre,
  teléfono, correo, deuda y vencimiento) o agrégalos a mano. Los teléfonos se dejan como +56 9 1234 5678.
  Lo que falta (sin teléfono, sin correo) queda marcado en amarillo. Hay un ejemplo en
  `ejemplos/contactos_ejemplo.xlsx`.
- **Notas**: cosas que el asistente debe saber («Juan Pérez paga siempre los días 5»).
- **Documentos**: sube PDF, Word, Excel o TXT con información del negocio (precios, horarios, datos de pago).

### Crear mensajes

1. Escribe la instrucción, por ejemplo: «Escríbeles a los clientes que deben más de $50.000 que el pago vence el viernes».
2. Elige el canal (WhatsApp, correo o SMS) y el tono (formal, cercano o breve).
3. El asistente muestra cómo entendió la instrucción (ej. «Deuda mayor a $50.000 · Fecha: viernes 30 de octubre»).
   Si algo no está claro, lo pregunta antes de escribir.
4. Escribe un mensaje por cliente con sus datos reales. Los clientes sin teléfono o correo aparecen aparte.
5. Revisa, edita y copia cada mensaje (o todos juntos). Quedan en el historial.

**No se envía nada automáticamente.** La estructura para conectar el envío está en `core/envio/`.

### Probar sin clave de API (modo demostración)

Pon `MODO_DEMO=1` en `.env` y escanea las fotos de la carpeta `ejemplos/`. Las respuestas son
simuladas (no se gasta dinero). Incluye una boleta, una factura correcta, una factura con error de
suma, una lista escrita a mano, un formulario y una foto borrosa. Para probar los mensajes, importa
`ejemplos/contactos_ejemplo.xlsx` en «Conocimiento»; en modo demostración los mensajes se arman con
plantillas simples.

## Costos

Cada escaneo y cada lote de mensajes muestra su costo aproximado en dólares y en pesos. Con Claude
Opus 5.5 una foto cuesta unos **US$0,02–0,06** (≈ $20–60 CLP) y un lote de 20 mensajes unos US$0,03–0,08. El gasto del día y el total aparecen en la barra lateral.
El tipo de cambio se ajusta con `DOLAR_CLP` en `.env`.

## Errores comunes

| Mensaje | Qué hacer |
|---|---|
| «Falta la clave de API» / «La clave de API no es válida» | Revisa `ANTHROPIC_API_KEY` en `.env` y reinicia la app. |
| «No hay conexión con la IA» | Revisa tu internet. |
| «Llegaste al límite de uso» | Espera un minuto y vuelve a intentar. |
| «Tu cuenta no tiene saldo» | Revisa la facturación en console.anthropic.com. |
| «Foto ilegible» | Toma otra foto con buena luz, de frente y sin mover el celular. |

## Tests

```bash
python -m pytest
```

Los tests usan respuestas de IA simuladas: no necesitan clave ni gastan dinero.

## Estructura

```
Inicio.py              Página de inicio (streamlit run Inicio.py)
pages/                 Escanear · Excel · Conocimiento · Mensajes
core/                  Lógica (IA, esquemas, validación, Excel, conocimiento, mensajes, base de datos)
core/envio/            Interfaz para conectar el envío de mensajes más adelante
ejemplos/              Fotos de prueba, respuestas simuladas y contactos de ejemplo
prototipo/             Prototipo web de una sola página (para claude.ai)
tests/                 Tests automáticos
datos/                 Base de datos y Excel (se crea sola, no se sube a git)
```

Las fotos de ejemplo se pueden regenerar con `python ejemplos/generar_ejemplos.py`.
