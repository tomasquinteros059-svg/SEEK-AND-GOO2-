// Prueba de la app (versión web de Expo) contra Supabase LOCAL.
// Antes: `npm run exportar:web` con las variables EXPO_PUBLIC_SUPABASE_* apuntando a Supabase local.
import { defineConfig, devices } from "@playwright/test";

const puerto = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${puerto}`,
    ...devices["Pixel 7"],
    // La app guarda dónde se entregó (permiso «mientras se usa»).
    permissions: ["geolocation"],
    geolocation: { latitude: -33.5206, longitude: -70.5986 },
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  webServer: { command: `node e2e/servir.cjs dist-web ${puerto}`, port: puerto, reuseExistingServer: false },
});
