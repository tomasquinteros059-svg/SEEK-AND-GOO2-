import { useColorScheme } from "react-native";
import { paletas, type Paleta } from "@reparto/ui-tokens";

/** La paleta según el modo del teléfono (claro u oscuro). */
export function usePaleta(): Paleta {
  return useColorScheme() === "dark" ? paletas.oscuro : paletas.claro;
}

/** Nombres de las fuentes ya cargadas (ver `App.tsx`). */
export const fuentes = {
  texto: "AtkinsonHyperlegible_400Regular",
  textoNegrita: "AtkinsonHyperlegible_700Bold",
  titulo: "Archivo_700Bold",
  cifras: "IBMPlexMono_500Medium",
} as const;
