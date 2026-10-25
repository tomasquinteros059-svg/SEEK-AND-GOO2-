// Aviso de errores del SERVIDOR a Sentry, sin la librería completa.
//
// La librería de Sentry para el servidor pesa ~2 MB comprimida y el plan gratis de
// Cloudflare admite 3 MB para todo el panel. Esto manda lo mismo que importa (tipo de
// error, mensaje, dónde pasó) con un solo `fetch`, usando el formato público de Sentry.
// Sin datos personales (SPEC 13). El aviso de errores del NAVEGADOR sigue con la
// librería oficial (instrumentation-client.ts).

export async function register() {}

type Peticion = { path: string; method: string };
type Contexto = { routePath?: string; routeType?: string };

export async function onRequestError(error: unknown, peticion: Peticion, contexto: Contexto) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn);
  if (!m) return;
  const [, clave, host, proyecto] = m;
  const e = error instanceof Error ? error : new Error(String(error));
  const id = crypto.randomUUID().replace(/-/g, "");
  const evento = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: process.env.NEXT_PUBLIC_ENTORNO ?? "desarrollo",
    // Solo la ruta (sin parámetros de búsqueda, que podrían traer datos).
    transaction: contexto.routePath ?? peticion.path.split("?")[0],
    tags: { runtime: "cloudflare", metodo: peticion.method, tipo_ruta: contexto.routeType ?? "" },
    exception: { values: [{ type: e.name, value: e.message.slice(0, 500), stacktrace: { frames: [] } }] },
    extra: { pila: (e.stack ?? "").slice(0, 4000) },
  };
  const sobre = [
    JSON.stringify({ event_id: id, sent_at: new Date().toISOString(), dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(evento),
  ].join("\n");
  try {
    await fetch(`https://${host}/api/${proyecto}/envelope/?sentry_key=${clave}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: sobre,
    });
  } catch {
    // Si Sentry no responde, el error igual queda en los registros de Cloudflare.
  }
}
