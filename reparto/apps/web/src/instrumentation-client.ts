// Aviso de errores del navegador (Sentry). Sin DSN no hace nada.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENTORNO ?? "desarrollo",
    // Sin datos personales: ni usuario, ni cookies, ni cabeceras, ni cuerpos, ni parámetros de URL.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
