// Configuración de la app móvil (conductor y receptor), para Android e iPhone.
//
// LA APP AÚN NO TIENE NOMBRE. Por eso el nombre y el identificador vienen de
// variables, con un valor provisorio. Cambiar el NOMBRE visible es gratis;
// cambiar el IDENTIFICADOR (APP_ID) después de publicar en las tiendas no se
// puede: se elige una vez, antes de la primera subida a Google Play / App Store.
import type { ConfigContext, ExpoConfig } from "expo/config";

const nombre = process.env.APP_NOMBRE ?? "Reparto";
const id = process.env.APP_ID ?? "cl.reparto.app";
const proyectoEas = process.env.EAS_PROJECT_ID;
const dueno = process.env.EXPO_OWNER;
const marca = "#143b5c";

const sentry: [string, Record<string, string>] | string =
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? ["@sentry/react-native", { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]
    : "@sentry/react-native";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: nombre,
  slug: "reparto",
  ...(dueno ? { owner: dueno } : {}),
  scheme: "reparto",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  // Modo oscuro desde el inicio (SPEC 8).
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: id,
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: id,
    adaptiveIcon: {
      backgroundColor: marca,
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-font",
    [
      "expo-image-picker",
      {
        cameraPermission: "La cámara se usa para fotografiar tu licencia y, más adelante, las entregas.",
        photosPermission: "Tus fotos se usan para elegir la imagen de tu licencia o documentos.",
        microphonePermission: false,
      },
    ],
    sentry,
    [
      "expo-splash-screen",
      { image: "./assets/splash-icon.png", imageWidth: 160, backgroundColor: marca },
    ],
  ],
  experiments: { typedRoutes: false },
  runtimeVersion: { policy: "appVersion" },
  ...(proyectoEas
    ? { updates: { url: `https://u.expo.dev/${proyectoEas}` }, extra: { eas: { projectId: proyectoEas } } }
    : {}),
});
