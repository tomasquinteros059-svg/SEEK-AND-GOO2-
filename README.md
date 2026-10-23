# Asistente de Negocio

Programa local, para un solo usuario, que:

1. **Escanea fotos** de boletas, facturas, listas y formularios y extrae sus datos con IA (Claude). ✅
2. **Guarda los datos en Excel** con formato chileno. *(en construcción)*
3. **Aprende de tu negocio**: notas, documentos y listas de clientes. *(en construcción)*
4. **Redacta mensajes** de WhatsApp, correo o SMS a partir de una instrucción simple. *(en construcción)*

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

### Probar sin clave de API (modo demostración)

Pon `MODO_DEMO=1` en `.env` y escanea las fotos de la carpeta `ejemplos/`. Las respuestas son
simuladas (no se gasta dinero). Incluye una boleta, una factura correcta, una factura con error de
suma, una lista escrita a mano, un formulario y una foto borrosa.

## Costos

Cada escaneo muestra su costo aproximado en dólares y en pesos. Con Claude Opus 5.5 una foto cuesta
unos **US$0,02–0,06** (≈ $20–60 CLP). El gasto del día y el total aparecen en la barra lateral.
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
pages/1_Escanear.py    Escanear, revisar y guardar
core/                  Lógica (IA, esquemas, validación, base de datos…)
ejemplos/              Fotos de prueba y sus respuestas simuladas
tests/                 Tests automáticos
datos/                 Base de datos y Excel (se crea sola, no se sube a git)
```

Las fotos de ejemplo se pueden regenerar con `python ejemplos/generar_ejemplos.py`.
