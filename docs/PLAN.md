# Asistente de Negocio — Propuesta técnica (v1)

Documento para aprobar **antes** de programar. Primera versión: un solo usuario, corre en el computador local.

## 0. Stack

Mantengo el stack sugerido, con estos agregados:

| Pieza | Uso | Por qué |
|---|---|---|
| Python 3.11+ y Streamlit | Interfaz web local | Simple, sin frontend aparte |
| `anthropic` (SDK oficial), modelo `claude-opus-5-5` | Visión + redacción | `client.messages.parse()` con modelos Pydantic = JSON validado contra un esquema |
| Pydantic v2 | Esquemas de datos | Lo usa el SDK para las salidas estructuradas |
| openpyxl | Excel | Formatos, filtros, varias hojas |
| SQLite (`sqlite3` estándar) | Base de conocimiento, historial, configuración | Un solo archivo, sin servidor |
| pillow + pillow-heif | Abrir HEIC, girar según EXIF, reducir tamaño | Fotos de iPhone; imágenes más livianas = más barato |
| pypdf, python-docx, openpyxl | Leer PDF/Word/Excel de la base de conocimiento | Extraer texto localmente, sin gastar IA |
| python-dotenv | Leer `.env` | La clave nunca va en el código |
| pytest | Tests | IA simulada (sin llamadas reales) |

Notas sobre el modelo (Opus 5.5): el "pensamiento" no se puede apagar; se controla con `effort`. Uso `effort="medium"` para escanear y `"low"` para mensajes, para bajar costo. Precio: US$4 por millón de tokens de entrada y US$20 por millón de salida.

## 1. Estructura de carpetas

```
SEEK-AND-GOO2-/
├── app.py                      # Inicio: estado de la clave de API, accesos rápidos
├── pages/
│   ├── 1_Escanear.py           # Subir fotos → revisar tabla editable → guardar
│   ├── 2_Excel.py              # Columnas configurables, crear/agregar, descargar
│   ├── 3_Conocimiento.py       # Notas, documentos, contactos (ver/editar/borrar)
│   └── 4_Mensajes.py           # Instrucción → lista de mensajes editables
├── core/
│   ├── config.py               # Lee .env, rutas, precios, tipo de cambio USD→CLP
│   ├── db.py                   # Conexión SQLite y creación de tablas
│   ├── ia.py                   # Cliente Claude: llamadas, errores en español, costo
│   ├── esquemas.py             # Modelos Pydantic (lo que la IA debe devolver)
│   ├── imagenes.py             # HEIC→JPG, rotación, reducción, hash para duplicados
│   ├── escaneo.py              # Prompt + extracción por tipo de documento
│   ├── validacion.py           # Sumas, IVA, RUT (dígito verificador), duplicados
│   ├── columnas.py             # Columnas configurables por tipo de documento
│   ├── excel.py                # Escribir/actualizar el Excel con formato
│   ├── conocimiento.py         # Notas, lectura de documentos, importación de contactos
│   ├── mensajes.py             # Interpretar instrucción, filtrar, redactar
│   └── envio/
│       ├── base.py             # Interfaz "Enviador" (para conectar envío más adelante)
│       └── solo_texto.py       # Implementación actual: no envía nada
├── ejemplos/                   # Fotos de prueba (boleta, factura, lista a mano, formulario)
│                               # + contactos_ejemplo.xlsx
├── tests/
│   ├── fixtures/               # Respuestas de IA simuladas (JSON)
│   ├── test_escaneo.py
│   ├── test_validacion.py
│   ├── test_excel.py
│   ├── test_conocimiento.py
│   └── test_mensajes.py
├── datos/                      # (ignorado por git) negocio.db, excels generados
├── .env.example                # ANTHROPIC_API_KEY=...
├── .gitignore                  # .env, datos/
├── requirements.txt
└── README.md
```

## 2. Esquema de datos

### 2.1 Lo que devuelve la IA al escanear (Pydantic → JSON Schema)

```python
class LineaDetalle(BaseModel):
    descripcion: str | None
    cantidad: float | None
    precio_unitario: int | None      # pesos, sin decimales
    total: int | None

class CampoExtra(BaseModel):         # columnas que agregaste tú
    clave: str
    valor: str | None

class DocumentoTributario(BaseModel):    # boleta o factura
    tipo: Literal["boleta", "factura"]
    fecha: str | None                # "aaaa-mm-dd"; null si no se lee
    proveedor: str | None
    rut_proveedor: str | None
    numero_documento: str | None
    lineas: list[LineaDetalle]
    neto: int | None
    iva: int | None
    total: int | None
    campos_extra: list[CampoExtra]
    campos_dudosos: list[str]        # ej: ["fecha", "lineas[2].cantidad"]
    observaciones: str | None        # ej: "foto borrosa abajo a la derecha"

class ItemLista(BaseModel):
    texto: str | None
    cantidad: str | None
    marcado: bool | None             # tachado / con check

class Lista(BaseModel):
    titulo: str | None
    fecha: str | None
    items: list[ItemLista]
    campos_extra: list[CampoExtra]
    campos_dudosos: list[str]
    observaciones: str | None

class CampoFormulario(BaseModel):
    etiqueta: str
    valor: str | None

class Formulario(BaseModel):
    titulo: str | None
    fecha: str | None
    campos: list[CampoFormulario]
    campos_extra: list[CampoExtra]
    campos_dudosos: list[str]
    observaciones: str | None

class ResultadoEscaneo(BaseModel):   # lo que se pide en modo "automático"
    tipo_detectado: Literal["boleta_factura", "lista", "formulario", "otro"]
    legible: bool                    # false = foto muy borrosa → se avisa
    documento_tributario: DocumentoTributario | None
    lista: Lista | None
    formulario: Formulario | None
```

Reglas del prompt: todo campo que no se vea va en `null` y se agrega a `campos_dudosos`; nunca se completa con suposiciones. Los proveedores conocidos de la base de conocimiento se pasan como referencia para normalizar el nombre, **solo si el RUT o el nombre visible coinciden**.

### 2.2 Tablas SQLite

```
documentos          id, tipo, fecha, proveedor, rut_proveedor, numero_documento,
                    neto, iva, total, datos_json (lista/formulario/extras),
                    campos_dudosos_json, archivo_nombre, hash_imagen,
                    costo_usd, creado_en
lineas_documento    id, documento_id → documentos, descripcion, cantidad,
                    precio_unitario, total
columnas            id, tipo_documento, clave, nombre_visible, descripcion,
                    orden, activa, es_base (las base no se borran, solo se ocultan/renombran)
notas               id, texto, etiquetas, creado_en, actualizado_en
archivos_conocimiento id, nombre, tipo (pdf/docx/xlsx/txt), texto_extraido, creado_en
contactos           id, nombre, telefono, correo, deuda, fecha_vencimiento,
                    extra_json (cualquier otra columna del Excel), origen, actualizado_en
lotes_mensajes      id, instruccion, canal, tono, filtro_json, avisos_json,
                    costo_usd, creado_en
mensajes            id, lote_id → lotes_mensajes, contacto_id, destinatario,
                    destino (teléfono/correo), asunto, texto, estado ('borrador'|'enviado'),
                    editado (bool)
uso_ia              id, operacion ('escaneo'|'mensajes'|...), tokens_entrada,
                    tokens_salida, costo_usd, creado_en
```

### 2.3 Excel generado

| Hoja | Contenido |
|---|---|
| Boletas y Facturas | 1 fila por documento (fecha, proveedor, RUT, N°, neto, IVA, total + columnas extra) |
| Detalle | 1 fila por línea de producto, con N° documento y proveedor para cruzar |
| Listas | 1 fila por ítem |
| Formularios | 1 fila por formulario, 1 columna por etiqueta |
| Resumen | Totales por mes (aaaa-mm) y por proveedor, recalculados en cada guardado |

Formato: encabezados en negrita con fondo, moneda `$#.##0` (punto de miles), fechas `dd-mm-aaaa`, filtros automáticos, ancho de columnas ajustado, fila de encabezado inmovilizada. "Agregar a existente" lee el archivo, no duplica documentos ya presentes (por proveedor+N°) y reescribe el Resumen.

## 3. Flujo de cada función

### 3.1 Escanear
```
Subir 1..N archivos (JPG/PNG/HEIC/PDF) + elegir tipo (o "Automático")
  → imagenes.py: HEIC→JPG, girar según EXIF, reducir a ~1600 px, calcular hash
  → ¿hash ya guardado? → aviso "Esta foto ya fue escaneada"
  → escaneo.py: 1 llamada a Claude por archivo
        system: reglas (no inventar, null + dudoso), columnas activas,
                proveedores conocidos (base de conocimiento, con caché de prompt)
        user:   imagen (o PDF) + tipo pedido
        salida: ResultadoEscaneo validado con Pydantic
  → validacion.py:
        - suma de líneas = neto (tolerancia ±$1 por redondeo)
        - neto + IVA = total; IVA ≈ 19% del neto
        - RUT con dígito verificador válido
        - duplicado: mismo RUT/proveedor + N° documento ya en la base
  → Pantalla de revisión: tabla editable (st.data_editor)
        celdas dudosas en amarillo, avisos de sumas en rojo, costo del escaneo
  → [Guardar] → SQLite (+ se agrega al Excel si está activado)
```
Errores manejados: foto borrosa (`legible=false`), sin conexión, clave inválida, límite de uso (429), servicio saturado, archivo no soportado o muy grande. Cada uno con un mensaje claro en español.

### 3.2 Excel
```
Página Excel:
  - Editor de columnas por tipo: agregar (nombre + descripción para la IA),
    renombrar, ocultar/quitar, reordenar → tabla `columnas`
  - Botones: "Crear Excel nuevo" | "Agregar a Excel existente" (subir archivo)
  - excel.py arma las hojas desde SQLite con las columnas activas
  - [Descargar Excel]
Las columnas nuevas se envían en el prompt de las siguientes extracciones
y vuelven en `campos_extra`.
```

### 3.3 Base de conocimiento
```
Pestaña Notas:      escribir / editar / borrar texto libre
Pestaña Documentos: subir PDF/Word/Excel/TXT → se extrae el texto localmente
                    → se guarda; se puede ver y borrar
Pestaña Contactos:  subir Excel → vista previa → mapear columnas
                    (nombre, teléfono, correo, deuda, vencimiento, otras)
                    → normalizar teléfono (+569...) y montos → guardar
                    → tabla editable para corregir o borrar
Uso por la IA: notas + resumen de documentos + proveedores se pasan como
contexto (con caché de prompt para no pagar dos veces). Para un negocio
pequeño cabe completo; si crece, se agrega búsqueda por palabras clave.
```

### 3.4 Mensajes
```
Instrucción + canal (WhatsApp/correo/SMS) + tono (formal/cercano/breve)
  → Paso 1 (IA): interpretar la instrucción → JSON:
        filtros [{campo:"deuda", operador:">", valor:50000}],
        datos a incluir (nombre, monto, fecha "viernes" → fecha exacta),
        ambigüedades (ej. "¿qué viernes?", "¿deuda total o vencida?")
  → Si hay ambigüedades: se muestran y se pide aclarar (no se adivina)
  → Paso 2 (código, sin IA): aplicar filtros sobre contactos/documentos
        → lista de destinatarios; los que no tienen teléfono/correo
          según el canal quedan en "No se puede contactar" con el motivo
  → Paso 3 (IA): redactar un mensaje por destinatario con sus datos reales,
        respetando largo del canal (SMS ≤160 caracteres; correo con asunto)
  → Lista editable + [Copiar] por mensaje + [Copiar todos] + costo del lote
  → Se guarda el lote en el historial (estado "borrador")
```
El filtro lo aplica el código, no la IA: así no hay clientes inventados ni montos alterados. `envio/base.py` define `Enviador.enviar(mensaje) -> Resultado`; hoy solo existe la versión que no envía. Más adelante se agregan WhatsApp Business API, SMTP o un proveedor de SMS sin tocar el resto.

## 4. Costos (aproximados)

- Escaneo de 1 foto: ~2.000–4.000 tokens de entrada + 800–2.000 de salida ≈ **US$0,02–0,06 (≈ $20–60 CLP)**.
- Lote de 20 mensajes: ≈ **US$0,03–0,08**.
- Se calcula con los tokens reales que informa la API y se muestra en pantalla. El tipo de cambio va en `.env` (por defecto 950).

## 5. Tests (sin llamadas reales a la IA)

- `test_escaneo`: cliente IA falso que devuelve JSON fijo → verifica armado de la tabla, campos dudosos, foto ilegible, errores de API traducidos.
- `test_validacion`: sumas que cuadran / no cuadran, IVA, RUT válido/inválido, duplicados.
- `test_excel`: crea el archivo, revisa hojas, negritas, formato `$#.##0`, fechas `dd-mm-aaaa`, filtros, Resumen, agregar sin duplicar, columnas renombradas.
- `test_conocimiento`: importar contactos desde Excel, normalizar teléfonos, extraer texto de TXT/DOCX/PDF.
- `test_mensajes`: filtro "deuda > 50000", contacto sin teléfono, instrucción ambigua, límite SMS.

## 6. Orden de construcción

1. Escaneo (+ esquemas, IA, validación, tests) → demostración con las fotos de ejemplo.
2. Excel → demostración descargando el archivo.
3. Base de conocimiento.
4. Mensajes.

## 7. Decisiones para confirmar

1. **IVA 19%** fijo y montos en pesos enteros (sin decimales).
2. **Boletas/facturas en dos hojas** (encabezado + detalle), en vez de repetir el encabezado en cada línea.
3. **Fotos de ejemplo**: las genero como imágenes sintéticas (boleta, factura, lista "a mano", formulario). Si tienes fotos reales (sin datos sensibles), son mejores para probar.
4. **Respaldo ante rechazo del modelo**: activar la opción del SDK que reintenta con otro modelo si Opus 5.5 rechaza una solicitud (costo similar). Recomendado: sí.
