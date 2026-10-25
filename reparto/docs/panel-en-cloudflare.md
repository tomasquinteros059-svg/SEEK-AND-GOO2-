# El panel web en Cloudflare

El panel (Next.js) se publica en **Cloudflare Workers** desde GitHub, con el botón **Actions → «Reparto · panel en Cloudflare»** o solo al subir cambios. Se usa el **plan gratis** de Workers.

## Cómo funciona
| Rama | Qué pasa |
|---|---|
| La rama de publicación (variable `PANEL_RAMA`; si no está, la rama principal del repositorio) | Publica en la dirección fija del panel, por ejemplo `https://reparto-panel.<tu-subdominio>.workers.dev` |
| Cualquier otra rama | Sube una **versión de prueba** con su propia dirección. La versión publicada no cambia |
| Faltan las claves de Cloudflare | No hace nada y termina en verde, con un aviso |

La revisión automática («Reparto · revisión») también prueba el panel compilado para Cloudflare: corre las 16 pruebas de punta a punta dentro de **workerd**, el mismo motor que usa Cloudflare, y falla si el panel pasa el tope de tamaño.

## Configurar (una vez, desde el navegador)
**Nunca pegues una clave en el chat.**

### 1. Cloudflare
1. Crea la cuenta en [dash.cloudflare.com](https://dash.cloudflare.com) (gratis).
2. **Workers & Pages**: la primera vez te pide elegir un subdominio `*.workers.dev`. Elige uno.
3. Copia el **Account ID**: está en la columna derecha de *Workers & Pages* (o en la dirección del navegador, después de `dash.cloudflare.com/`).
4. **My Profile → API Tokens → Create Token → plantilla «Edit Cloudflare Workers»**. En *Account Resources* elige tu cuenta y en *Zone Resources* «All zones». Crea el token y cópialo (se muestra una sola vez).

### 2. GitHub
Repositorio → **Settings → Secrets and variables → Actions**:

| Tipo | Nombre | Valor |
|---|---|---|
| Secreto | `CLOUDFLARE_API_TOKEN` | El token del paso 1.4 |
| Secreto | `CLOUDFLARE_ACCOUNT_ID` | El Account ID del paso 1.3 |
| Variable | `SUPABASE_PROYECTO_DESARROLLO` | Ya existe desde la Fase 0 (el Reference ID) |
| Variable | `SUPABASE_CLAVE_PUBLICA_DESARROLLO` | Supabase → Project Settings → **API Keys** → la clave pública (`anon` o «publishable»). Es pública por diseño; la seguridad está en las reglas de la base. **No uses la `service_role`** |
| Variable | `PANEL_RAMA` | La rama que se publica. Mientras el trabajo siga en esta rama, `ccr-7b2afc44-u644e8` |

Opcionales, para que el panel mande correos y ubique direcciones de verdad:

| Tipo | Nombre | Para qué |
|---|---|---|
| Secreto | `RESEND_API_KEY` | Correos de invitación (Resend) |
| Secreto | `GOOGLE_GEOCODING_KEY` | Ubicar direcciones con Google |
| Variable | `GEOCODER` | `google`, `nominatim` o `simulado` |
| Variable | `CORREO_REMITENTE`, `CORREO_CONTACTO` | Remitente de los correos y correo de contacto en los textos |
| Variable | `PANEL_URL` | La dirección del panel publicado, para el texto de las invitaciones |
| Variable | `APP_NOMBRE` | El nombre de la app, cuando lo tenga |
| Variable | `SENTRY_DSN_WEB` | Aviso de errores del panel (proyecto `reparto-web` de Sentry) |

Las claves del servidor se copian a Cloudflare en cada publicación (`wrangler secret bulk`). No quedan en el código ni en los registros.

### 3. Supabase
El panel entra con un **código por correo**, así que no hay direcciones de retorno que registrar. Solo revisa que las migraciones estén aplicadas (botón «Reparto · migraciones (desarrollo)» de la Fase 0).

## Lista de aceptación (tu prueba)
1. [ ] Actions → «Reparto · panel en Cloudflare» → **Run workflow** en la rama `PANEL_RAMA`. Termina en **verde** y el paso «Publicar» muestra la dirección `https://reparto-panel.….workers.dev`.
2. [ ] Abre esa dirección en el computador y en el teléfono: aparece la pantalla para entrar.
3. [ ] Entra con tu correo y el código que llega: ves tus empresas.
4. [ ] Abre `/legal/terminos` y `/legal/privacidad`: se leen los textos (son las direcciones que piden Meta, Google y Apple).
5. [ ] Sube una planilla de entregas en **Cargar**: se ve la vista previa.

## Tamaño y costo
- El plan gratis de Workers acepta hasta **3 MB comprimido**. Hoy el panel pesa **~2,8 MB**. La revisión avisa desde 2,9 MB y falla si pasa de 3 MB.
- Para caber se hicieron tres ajustes: el aviso de errores del servidor es un envío directo a Sentry (sin la librería completa), la planilla Excel se lee **en el navegador** y el código va minimizado.
- Si el panel crece más, el plan **Workers Paid** cuesta **USD 5 al mes** y sube el tope a 10 MB. También incluye más uso: el gratis permite 100.000 visitas al día, de sobra para la validación.

## Detalles técnicos
- Adaptador: `@opennextjs/cloudflare` (`apps/web/open-next.config.ts`, `apps/web/wrangler.jsonc`).
- Los datos públicos (`NEXT_PUBLIC_*`) quedan dentro del panel **al compilar**. Si cambias de proyecto de Supabase, vuelve a publicar.
- En Cloudflare no hay disco: los textos legales de `docs/legal` se copian al código antes de compilar (`herramientas/textos-legales.mjs`, genera `apps/web/src/lib/textos-legales.ts`).
- Probar en tu computador: en `apps/web`, crea `.dev.vars` con `GEOCODER=simulado`, y corre `npm run cf:build` y luego `npm run cf:preview`.
