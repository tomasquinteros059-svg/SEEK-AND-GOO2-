// Aviso de errores con Sentry (SPEC 13): sin datos personales.
//
// Si no hay DSN configurado (por ejemplo, en las pruebas), no hace nada.
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const avisoDeErroresActivo = Boolean(dsn);

export function iniciarAvisoDeErrores(entorno: string): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: entorno,
    // Nunca mandar IP, nombres ni correos: solo el error, la versión y el modelo del teléfono.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

export function probarAvisoDeErrores(): void {
  Sentry.captureMessage("Prueba de aviso de errores desde la app (Fase 0)");
}

export const envolver = Sentry.wrap;
