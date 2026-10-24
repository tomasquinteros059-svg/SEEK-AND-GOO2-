# Fase 1 · Cuentas y perfiles

**Estado:** construida y probada aquí contra un Supabase real (local). Falta tu prueba.
**Listo cuando** (SPEC 16): creas una empresa, invitas a otro administrador y a un conductor, cada uno entra con el código de su correo, y las pruebas de "ver solo lo propio" pasan.

## Qué se construyó
| Pieza | Qué hace |
|---|---|
| **Base de datos** (`supabase/migrations/…_cuentas.sql`) | Tablas `usuarios`, `empresas`, `membresias`, `invitaciones`, `documentos_conductor`, `revisiones_documento` y `consentimientos`, con sus reglas de acceso (RLS). Bucket privado `documentos` para las licencias. Una empresa nunca se queda sin administrador. Cada empresa revisa las licencias de sus conductores por su cuenta |
| **Entrar con código** | Correo → código de 6 dígitos, que dura 10 minutos y sirve una vez. Se puede pedir otro cada 60 segundos (SPEC 9). Sin contraseñas |
| **Panel web** | Entrar · registrar la empresa (nombre, teléfono, empresa y su teléfono, aceptar Términos) · invitar administradores y conductores por correo · ver el equipo · suspender o reactivar · ver la licencia (enlace que vence en 5 minutos) y aprobarla o rechazarla · Términos y Privacidad publicados en `/legal/terminos` y `/legal/privacidad` (Meta, Google y Apple piden esas direcciones) |
| **App** (Android e iPhone) | Entrar · elegir perfil ("Soy conductor" o "Recibo pedidos") · registro del conductor con foto de la licencia (obligatoria), fecha de vencimiento y documento del camión (opcionales) · aceptar invitaciones · ver mis empresas y en qué quedó la revisión de mis documentos |
| **Fotos de documentos** | Se achican y se vuelven a guardar como JPEG: así se pierden los datos de ubicación (EXIF), como pide la SPEC 9 |
| **Reglas compartidas** (`paquetes/dominio/src/perfil.ts`) | Teléfono chileno (acepta `9 1234 5678`, `+56 9…`, `(2) 2345 6789`), correo, código, nombre completo, fechas `dd-mm-aaaa` y el registro de cada perfil |

## Lo que se probó (todo en verde)
- **45 pruebas de base de datos** en Supabase real, con las personas del caso de Matías:
  - Carolina crea la empresa e invita.
  - Rodrigo no ve la empresa hasta aceptar.
  - Matías trabaja para dos empresas y no ve a nadie más.
  - Beatriz (de la otra empresa) no ve a Carolina ni las aprobaciones ajenas.
  - Un extraño no ve nada, y sin cuenta tampoco.
- **8 pruebas de punta a punta del panel** en un navegador real. Incluyen el código leído del correo, la licencia subida por Matías y aprobada por Carolina, el bloqueo de 60 segundos y la regla de que la empresa no se queda sin administrador.
- **1 prueba de punta a punta de la app**, en su versión web: el conductor entra, se registra con su licencia y acepta la invitación.
- **37 pruebas de reglas del negocio y de colores.**

**Tres cosas que encontraron las pruebas, ya corregidas:**
1. Supabase da por defecto todos los permisos de tabla a los usuarios conectados. Una edición prohibida "no cambiaba nada" en silencio; ahora falla con un error claro.
2. En el panel, si olvidabas marcar los Términos, el formulario se vaciaba entero. Ahora conserva lo que escribiste.
3. En la app, los mensajes de error seguían a la vista después de arreglar el campo, y la casilla marcada era solo un color (ahora lleva ✓).

## Configurar (una vez)
### Supabase de desarrollo (en supabase.com)
1. Corre el botón **Actions → «Reparto · migraciones (desarrollo)»** (ver `fase-0.md`). Así se crean las tablas y el bucket.
2. **Authentication → Sign In / Providers → Email:**
   - largo del código **6**;
   - vencimiento **600** segundos;
   - frecuencia mínima **60** segundos.
3. **Authentication → Emails → Templates:** en **«Confirm signup»** y en **«Magic Link»** pega el contenido de `supabase/plantillas/codigo.html`.
   - Asunto: «Tu código para entrar».
   - **Las dos plantillas deben llevar `{{ .Token }}`**, o el correo llega sin el código (lección de Cotigestión).
4. **Authentication → SMTP:** conecta Resend. El correo que trae Supabase de fábrica solo envía unos pocos correos por hora.
5. **Authentication → URL Configuration:** en *Site URL*, la dirección del panel.

### La app (expo.dev → proyecto → Environment variables, en `development` y `preview`)
- `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`: de Supabase → Project Settings → API.
- `EXPO_PUBLIC_URL_PANEL`: la dirección del panel (para abrir los Términos).

Después arma de nuevo la app con el botón **«Reparto · app de prueba»**.

### El panel (en tu computador, archivo `reparto/apps/web/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
RESEND_API_KEY=...            (opcional: sin esto la invitación se crea, pero avisas tú)
CORREO_REMITENTE=Reparto <avisos@tudominio.cl>
```
Luego `npm install` y `npm run web` dentro de `reparto/`, y abre `http://localhost:3000`.

## Lista de aceptación (tu prueba)
1. [ ] En el panel, entra con tu correo: llega un código de 6 dígitos y entras.
2. [ ] Registra tu empresa. Sin marcar los Términos no avanza, y lo escrito no se borra.
3. [ ] En **Equipo**, invita a otro correo tuyo como **administrador** y a otro como **conductor**.
4. [ ] Con el correo de administrador, entra al panel (en otra ventana privada), completa tus datos y **acepta**: ves a las dos personas en Equipo.
5. [ ] En el teléfono, abre la app, entra con el correo de conductor, elige **«Soy conductor»**, toma la foto de tu licencia y crea tu cuenta. Acepta la invitación.
6. [ ] En el panel, en **Equipo → Licencias y documentos**, ves la foto y la **apruebas**. En la app, desliza hacia abajo para actualizar: dice «Aprobado».
7. [ ] Intenta suspender al único administrador que queda: el panel no lo deja.
8. [ ] GitHub → Actions: «Reparto · revisión» en verde (incluye todas las pruebas de arriba).

## Decisiones de esta fase
- **Las invitaciones van por correo, sin enlaces secretos.** Quien entra con el correo invitado (probado con el código) ve la invitación y la acepta. Un enlace reenviado no sirve de nada.
- **El perfil (conductor o receptor) se elige en cada teléfono** (SPEC 3.1). Ser conductor de una empresa depende de aceptar su invitación; ser receptor se vincula por teléfono en la Fase 5.
- **El consentimiento de ubicación no se pide todavía:** va con el GPS en la Fase 4, en su pantalla propia.
- **Borrar la cuenta** (exigido por las tiendas) llega en la Fase 11, antes de publicar. Hoy un administrador que sea el único de su empresa no puede borrarse sin dejar a otro.
- **La versión web de la app** existe solo para probarla automáticamente; no se publica.
