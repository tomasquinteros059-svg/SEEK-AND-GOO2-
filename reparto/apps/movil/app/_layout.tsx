// Raíz de la app: tipografías, sesión y aviso de errores.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Solo los pesos que se usan: importar el paquete entero mete todas las variantes en la app.
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible/400Regular";
import { AtkinsonHyperlegible_700Bold } from "@expo-google-fonts/atkinson-hyperlegible/700Bold";
import { Archivo_700Bold } from "@expo-google-fonts/archivo/700Bold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { ProveedorSesion } from "../src/sesion";
import { envolver, iniciarAvisoDeErrores } from "../src/errores";
import { usePaleta } from "../src/tema";
import { Cargando } from "../src/ui";

iniciarAvisoDeErrores(process.env.EXPO_PUBLIC_ENTORNO ?? "desarrollo");

function Raiz() {
  const p = usePaleta();
  const [listas] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, Archivo_700Bold, IBMPlexMono_500Medium });
  if (!listas) return <Cargando />;
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.fondo } }} />
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}

export default envolver(Raiz);
