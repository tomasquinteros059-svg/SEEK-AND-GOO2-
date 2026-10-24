// Prueba de punta a punta de la Fase 1 contra Supabase LOCAL (supabase start).
// Lee la URL y la clave pública de las variables E2E_SUPABASE_URL y E2E_SUPABASE_ANON_KEY
// (en la CI salen de `supabase status -o env`).
import { defineConfig, devices } from "@playwright/test";

const url = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const clave = process.env.E2E_SUPABASE_ANON_KEY ?? "";
const puerto = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${puerto}`,
    locale: "es-CL",
    ...devices["Desktop Chrome"],
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  webServer: {
    command: `npx next start -p ${puerto}`,
    port: puerto,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: clave, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
