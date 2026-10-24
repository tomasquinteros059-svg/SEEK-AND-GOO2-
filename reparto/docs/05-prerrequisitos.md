# Etapa D: prerrequisitos

Lista exacta de lo que debe estar listo **antes de la Fase 0**, y de lo que se necesita más adelante (marcado con la fase).
Versiones revisadas el 18 de octubre de 2026.

## 1. Cómo vamos a trabajar
- **El código lo escribo y lo ejecuto yo** en este entorno en la nube. Tú **no necesitas instalar herramientas de programación** ni usar la terminal.
- **Tu parte:**
  - crear las cuentas, desde el navegador de tu tablet o computador;
  - guardar las claves como secretos de GitHub (sección 4);
  - instalar la app de prueba en tus teléfonos;
  - probar con las listas de aceptación.
- **Equipos para probar:**

| Equipo | Para qué | ¿Cuándo? |
|---|---|---|
| 1 teléfono Android | App de conductor y de receptor | Desde la Fase 0 |
| 1 segundo teléfono (Android o iPhone) | Probar dos perfiles a la vez | Desde la Fase 3 |
| Tablet o computador con navegador | Panel del administrador | Desde la Fase 1 |
| iPhone | Probar la versión iOS | Cuando tengas la cuenta de Apple (recomendado antes de la Fase 4) |

En Android la app de prueba se instala con un enlace. En iPhone, Apple exige la cuenta de desarrollador ($99 al año) incluso para probar.

---

## 2. Cuentas

### Ahora (antes de la Fase 0)
| # | Cuenta | Plan | Qué crear | Qué guardar (sección 4) |
|---|---|---|---|---|
| 1 | **GitHub** | Ya la tienes | Nada | — |
| 2 | **Supabase** (supabase.com) | **Free** para desarrollo; Pro ($25) recién con usuarios reales | Una organización y un proyecto llamado `reparto-dev`, región **South America (São Paulo)**. Anota la contraseña de la base de datos en un lugar seguro, como un gestor de contraseñas. | `SUPABASE_ACCESS_TOKEN` (Account → Access Tokens), `SUPABASE_PROJECT_REF` (el código del proyecto en la URL), `SUPABASE_DB_PASSWORD` |
| 3 | **Expo** (expo.dev) | Free | Cuenta y un token de acceso (Account settings → Access tokens) | `EXPO_TOKEN` |
| 4 | **Sentry** (sentry.io) | Developer (gratis) | Organización y dos proyectos: `reparto-movil` (React Native) y `reparto-web` (Next.js) | `SENTRY_AUTH_TOKEN` |
| 5 | **Cloudflare** (cloudflare.com) | Free | Cuenta y un token de API con permiso "Workers" y "R2" | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

**Correos de prueba sin dominio:** mientras no haya nombre ni dominio, Supabase envía los códigos de inicio de sesión solo a los **miembros de tu organización** en Supabase. Para que funcionen tus cuentas de prueba (por ejemplo, un correo para el conductor y otro para el receptor), invítalos como miembros en *Organization → Team*. Así es gratis y no hay que pegar correos en el chat.

### Más adelante
| Cuenta | Fase | Plan | Qué guardar |
|---|---|---|---|
| **Proveedor de VPS** (Hetzner o DigitalOcean, se decide en la Fase 2) | 2 | ~$15–30 al mes | `VPS_API_TOKEN` |
| **Google Cloud**: solo la API Geocoding, con la clave restringida a esa API | 2 (opcional) | Pago por uso, ~10.000 consultas gratis al mes | `GOOGLE_GEOCODING_KEY` |
| **Apple Developer** | Antes de probar en iPhone | $99 al año | Lo configuramos juntos con EAS (no se pega nada) |
| **Anthropic Console** (console.anthropic.com), con límite de gasto mensual | 7 | Pago por uso | `ANTHROPIC_API_KEY` |
| **Stream** (getstream.io) | 9 | Pago por uso, con cupo gratis | `STREAM_API_KEY`, `STREAM_API_SECRET` |
| **Resend** | Cuando haya dominio | Free y después Pro ($20) | `RESEND_API_KEY` |
| **Dominio .cl** (nic.cl) | Cuando haya nombre | ~$12 al año | — |
| **Google Play Console** | Etapa F | $25, pago único | — |
| **Licencia Transistorsoft Starter** | Etapa F | $399, pago único | `TRANSISTORSOFT_LICENSE` |

---

## 3. Herramientas (las instalo yo en el entorno)
| Herramienta | Versión | Comando para verificar |
|---|---|---|
| Node.js | 24 LTS (24.22.0). Hoy el entorno tiene 22.22, que Expo también acepta. | `node -v` |
| pnpm, el gestor de paquetes del monorepo | 12.14 | `pnpm -v` |
| Supabase CLI | 2.121 | `npx supabase --version` y `npx supabase projects list` (comprueba el inicio de sesión) |
| EAS CLI (Expo) | 25.2 | `npx eas-cli --version` y `npx eas-cli whoami` (comprueba el inicio de sesión) |
| Docker, para correr Supabase local en las pruebas | 29.8 (ya instalado) | `docker --version` |
| Expo SDK | 58.0.14 (necesita Node 22.13 o superior) | `npx expo --version` |
| Next.js | 16.4.2 | `npx next --version` |
| Git | 2.43 (ya instalado) | `git --version` |

Ninguna CLI pide contraseña: inician sesión solas leyendo `SUPABASE_ACCESS_TOKEN` y `EXPO_TOKEN`.

---

## 4. Dónde van las claves: secretos de GitHub (decisión del cliente)
Las claves se guardan como **secretos del repositorio en GitHub**.
- **Enlace directo:** https://github.com/tomasquinteros059-svg/Seek-and-go/settings/secrets/actions
- **Pasos:**
  1. Abre el enlace y toca **New repository secret**.
  2. En **Name**, escribe el nombre exacto, por ejemplo `SUPABASE_ACCESS_TOKEN`.
  3. En **Secret**, pega el valor.
  4. Toca **Add secret**.
  5. Repite con cada clave.
- **Cómo se usan:**
  - yo escribo el código y lo subo a GitHub;
  - **GitHub Actions** (los servidores de GitHub) ejecuta las tareas que necesitan claves: aplicar cambios a la base de datos, publicar la web y compilar la app con EAS;
  - yo reviso el resultado y los registros desde aquí.
- **Nadie puede volver a leer un secreto de GitHub**, ni siquiera tú: solo se puede reemplazar. Tampoco aparece en los registros, porque GitHub lo oculta con `***`.

En el código, las claves para desarrollo local se leen de un archivo `.env` que está en `.gitignore`, así que nunca se sube.

## 5. Acceso a internet
Con GitHub Actions **no hace falta cambiar el acceso a internet de este entorno**. Los servidores de GitHub llegan a Supabase, Expo, Sentry y Cloudflare sin restricciones.

## 6. Qué datos puedes pegar en el chat y cuáles nunca
| ✅ Sí puedes pegar | ❌ Nunca pegues |
|---|---|
| Nombres de proyectos y organizaciones | Tokens, claves de API, contraseñas, *service_role key* |
| Mensajes de error completos (revisa que no incluyan claves) | Datos reales de conductores o receptores: nombres, teléfonos, correos, direcciones, licencias |
| Capturas de pantalla de la app de prueba con datos ficticios | Capturas que muestren claves o datos reales |
| Tu llave SSH **pública** (`.pub`), si alguna vez se necesita | La llave SSH privada |

Para probar usaremos los datos ficticios del caso de Matías.

---

## 7. Lista para confirmar
Cuando todo esté hecho, respóndeme "listo" (no hace falta abrir una sesión nueva):
- [ ] Proyecto `reparto-dev` creado en Supabase, región São Paulo
- [ ] Correos de prueba invitados como miembros de la organización de Supabase
- [ ] Cuentas de Expo, Sentry y Cloudflare creadas
- [ ] Claves guardadas como secretos de GitHub con estos nombres: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- [ ] Teléfono Android a mano

Con eso verifico todo con los comandos de la sección 3 y empiezo la **Fase 0**.
