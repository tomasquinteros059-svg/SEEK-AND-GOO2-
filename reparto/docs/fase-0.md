# Fase 0 · Los cimientos

**Estado:** construida y probada aquí; falta tu prueba en el teléfono y el computador.
**Listo cuando** (SPEC 16): la revisión automática de GitHub pasa en verde, la app de prueba abre en tu teléfono (Android e iPhone) y el panel abre en tu computador.

## Qué se construyó
| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Monorepo | `reparto/` (npm workspaces) | Una sola instalación para la app, el panel y el código compartido |
| App móvil | `apps/movil` (Expo SDK 58, React Native 0.88) | Pantalla de prueba con los colores, las tipografías, el modo oscuro, el código compartido y el aviso de errores. Configurada para Android e iPhone. Nombre e identificador provisorios, que se cambian con variables |
| Panel web | `apps/web` (Next.js 16.4) | La misma prueba en el navegador |
| Reglas del negocio | `paquetes/dominio` | Estados de una entrega y la clase `Entrega`: no se entrega sin foto **y mensaje**, «No entregado» exige motivo, y gana el hecho físico si estaba cancelada |
| Identidad visual | `paquetes/ui-tokens` | Paleta del prototipo (claro y oscuro), tipografías y medidas. Una prueba exige contraste de 4,5:1 |
| Base de datos | `supabase/` | Configuración, primera migración (PostGIS y consulta de salud) y pruebas pgTAP |
| Revisión automática | `.github/workflows/reparto.yml` | Tipos, estilo, pruebas, compila el panel, empaqueta la app para los dos sistemas, prueba la base y busca claves subidas por error |
| Botones en GitHub → Actions | `reparto-app-de-prueba.yml`, `reparto-migraciones.yml` | Armar la app de prueba en Expo; aplicar las migraciones a tu Supabase de desarrollo |
| Dependencias | `.github/dependabot.yml` | Revisión semanal de librerías con fallas conocidas (SPEC 9) |

## Lo que se probó aquí
- 17 pruebas automáticas en verde: 13 de reglas del negocio y 4 de identidad visual.
- Tipos de TypeScript y estilo sin errores en los cuatro paquetes.
- El panel compila y se ve bien en modo claro y oscuro (revisado con capturas).
- La app se empaqueta completa para Android y para iPhone.
- Las 4 pruebas de la base pasan en Postgres con PostGIS. Aquí se probaron en Postgres 16; la revisión de GitHub las corre en el Postgres 17 de Supabase.

**La prueba encontró dos colores del prototipo que no cumplían la SPEC:** el verde «A tiempo» y el naranjo de aviso daban 4,3:1 sobre su fondo. Quedaron un poco más oscuros (`#197542` y `#a04a09`).

**No se pudo probar aquí:** abrir la app en un teléfono real ni conectarse a tus cuentas. Eso es tu parte de la lista de aceptación.

## Configurar tus cuentas (una vez)
Todo se hace en las páginas web de cada servicio, también desde el teléfono. **Nunca pegues una clave en el chat.**

### 1. Expo (la app)
1. En [expo.dev](https://expo.dev), crea un proyecto llamado `reparto` y copia su **Project ID**.
2. En **Account settings → Access tokens**, crea un token.
3. En GitHub, abre el repositorio → **Settings → Secrets and variables → Actions** y agrega:
   - **Secreto** `EXPO_TOKEN` = el token.
   - **Variables** `EAS_PROJECT_ID` = el Project ID y `EXPO_OWNER` = tu usuario u organización de Expo.
   - Opcional: las variables `APP_NOMBRE` y `APP_ID` cuando la app tenga nombre.

### 2. Sentry (aviso de errores)
1. Crea dos proyectos: `reparto-movil` (React Native) y `reparto-web` (Next.js).
2. En expo.dev → proyecto → **Environment variables**, agrega `EXPO_PUBLIC_SENTRY_DSN` con el DSN de `reparto-movil`, en los ambientes `development` y `preview`.
3. Para el panel, el DSN de `reparto-web` va en `NEXT_PUBLIC_SENTRY_DSN`, en el archivo `.env.local` de tu computador.

### 3. Supabase (base de datos de desarrollo)
1. Crea un proyecto `reparto-desarrollo` en la región **São Paulo** (SPEC 3.4) y guarda la contraseña de la base.
2. En GitHub agrega:
   - **Secreto** `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens).
   - **Secreto** `SUPABASE_DB_PASSWORD` (la contraseña de la base).
   - **Variable** `SUPABASE_PROYECTO_DESARROLLO` (el «Reference ID» del proyecto, en Project Settings → General).
3. En **Actions → «Reparto · migraciones (desarrollo)» → Run workflow**.

> **Ojo (lección de Cotigestión):** el token de acceso de Supabase vence. Si un día el botón de migraciones falla con un error 401, renueva el token.

## Lista de aceptación (tu prueba)
1. [ ] En GitHub → **Actions**, «Reparto · revisión» está en **verde** en el último cambio.
2. [ ] **Android:** Actions → «Reparto · app de prueba» → Run workflow (`android`, `preview`). En unos 15 minutos aparece en expo.dev → **Builds** un enlace o código QR. Ábrelo en el teléfono, instala el APK y **la app abre** con el encabezado azul «Fase 0 · los cimientos».
3. [ ] **iPhone:** iOS solo instala apps de prueba en teléfonos registrados en tu cuenta de Apple. **Una sola vez**, desde un computador (no necesita ser Mac) con Node 22:
   ```bash
   cd reparto/apps/movil
   npx eas-cli@25.3.0 login
   npx eas-cli@25.3.0 device:create                     # muestra un QR: ábrelo con el iPhone para registrarlo
   npx eas-cli@25.3.0 build -p ios --profile preview    # te pide entrar con tu cuenta de Apple y crea los certificados
   ```
   Después de eso, el botón de GitHub también arma la versión de iPhone. Instálala desde el enlace de expo.dev y **la app abre**.
4. [ ] Con la app abierta, cambia el teléfono a **modo oscuro**: la pantalla cambia sola.
5. [ ] Si configuraste Sentry, toca **«Enviar prueba de error»** y el mensaje aparece en el proyecto `reparto-movil`.
6. [ ] **Panel:** en tu computador, dentro de `reparto/`, corre `npm install` y después `npm run web`, y abre `http://localhost:3000`. Se ve el panel de prueba.
7. [ ] Si configuraste Supabase, el botón de migraciones termina en verde, y en Supabase → **SQL editor**, `select public.salud();` responde `"ok": true`.

## Comandos útiles (en `reparto/`)
| Comando | Qué hace |
|---|---|
| `npm install` | Instala todo |
| `npm run verificar` | Tipos, estilo y pruebas, igual que la revisión de GitHub |
| `npm run web` | Abre el panel en `http://localhost:3000` |
| `npm run movil` | Servidor de desarrollo de la app (con la versión `development` instalada) |
| `npm run db:iniciar` / `npm run db:probar` | Supabase local con Docker y sus pruebas |

## Decisiones de esta fase
- **Nombre provisorio «Reparto», identificador `cl.reparto.app`.** El nombre visible se cambia cuando quieras. **El identificador se fija antes de la primera subida a Google Play o App Store** y después no se puede cambiar.
- **Tipografías incluidas en la app** (no descargadas de Google al abrir): solo los 4 pesos que se usan, para que pese menos y funcione sin señal.
- **npm workspaces en vez de pnpm:** es lo que Expo soporta sin ajustes en un monorepo.
- **La revisión automática solo corre cuando cambia algo en `reparto/`**, para no gastar minutos de GitHub en el otro proyecto de este repositorio (lección de Cotigestión: se quedó sin minutos).
