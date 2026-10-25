// Publicar el panel en Cloudflare Workers con OpenNext (SPEC 3.3: Cloudflare).
// Sin caché incremental en R2: las páginas del panel son dinámicas (dependen de la sesión);
// las únicas fijas (textos legales) salen ya armadas como archivos estáticos.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
