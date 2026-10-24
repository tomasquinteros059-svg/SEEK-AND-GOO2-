// Fase 0 · pantalla de prueba de la app.
//
// Sirve para comprobar en el teléfono (Android e iPhone) que la app abre, que
// las tipografías y los colores son los de la SPEC, que el modo oscuro
// funciona, que el código compartido (`@reparto/dominio`) llega a la app y
// que el aviso de errores (Sentry) está conectado.
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
// Solo los pesos que se usan: importar el paquete entero mete todas las variantes en la app.
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible/400Regular";
import { AtkinsonHyperlegible_700Bold } from "@expo-google-fonts/atkinson-hyperlegible/700Bold";
import { Archivo_700Bold } from "@expo-google-fonts/archivo/700Bold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { siguientes } from "@reparto/dominio";
import { medidas } from "@reparto/ui-tokens";
import { fuentes, usePaleta } from "./src/tema";
import { avisoDeErroresActivo, envolver, iniciarAvisoDeErrores, probarAvisoDeErrores } from "./src/errores";

const entorno = process.env.EXPO_PUBLIC_ENTORNO ?? "desarrollo";
iniciarAvisoDeErrores(entorno);

function Inicio() {
  const p = usePaleta();
  const [enviado, setEnviado] = useState(false);
  const [listas] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    Archivo_700Bold,
    IBMPlexMono_500Medium,
  });

  if (!listas) return <View style={[estilos.pantalla, { backgroundColor: p.marca }]} />;

  const texto = { color: p.tinta, fontFamily: fuentes.texto, fontSize: medidas.texto.normal };
  const pasos = siguientes("en_camino").join(", ").replaceAll("_", " ");

  return (
    <SafeAreaView style={[estilos.pantalla, { backgroundColor: p.fondo }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={[estilos.cabecera, { backgroundColor: p.marca }]}>
          <Text style={[estilos.titulo, { color: p.marcaTinta, fontFamily: fuentes.titulo }]}>
            {Constants.expoConfig?.name ?? "Reparto"}
          </Text>
          <Text style={{ color: p.marcaTinta, fontFamily: fuentes.texto, fontSize: medidas.texto.normal }}>
            Fase 0 · los cimientos
          </Text>
        </View>

        <View style={[estilos.tarjeta, { backgroundColor: p.superficie, borderColor: p.linea }]}>
          <Text style={[texto, { fontFamily: fuentes.textoNegrita }]}>La app abre en tu teléfono.</Text>
          <Text style={[texto, { color: p.apagado }]}>
            Si cambias el teléfono a modo oscuro, esta pantalla cambia sola.
          </Text>
          <View style={estilos.fila}>
            <Text style={[estilos.chip, { color: p.ok, backgroundColor: p.okFondo, fontFamily: fuentes.textoNegrita }]}>
              A tiempo
            </Text>
            <Text style={[estilos.chip, { color: p.atraso, backgroundColor: p.atrasoFondo, fontFamily: fuentes.textoNegrita }]}>
              Atrasado 28 min
            </Text>
          </View>
          <Text style={{ color: p.tinta, fontFamily: fuentes.cifras, fontSize: medidas.texto.grande }}>09:12 · $45.990</Text>
        </View>

        <View style={[estilos.tarjeta, { backgroundColor: p.superficie, borderColor: p.linea }]}>
          <Text style={[texto, { fontFamily: fuentes.textoNegrita }]}>Código compartido</Text>
          <Text style={[texto, { color: p.apagado }]}>Una entrega en camino puede pasar a: {pasos}.</Text>
        </View>

        <View style={[estilos.tarjeta, { backgroundColor: p.superficie, borderColor: p.linea }]}>
          <Text style={[texto, { fontFamily: fuentes.textoNegrita }]}>Aviso de errores</Text>
          <Text style={[texto, { color: p.apagado }]}>
            {avisoDeErroresActivo ? `Conectado (${entorno}).` : "Sin configurar: falta EXPO_PUBLIC_SENTRY_DSN."}
          </Text>
          <Text style={[texto, { color: p.apagado, fontFamily: fuentes.cifras, fontSize: medidas.texto.chico }]}>
            Versión {Constants.expoConfig?.version ?? "?"}
          </Text>
        </View>
      </ScrollView>

      {/* Un solo botón principal amarillo, abajo, al alcance del pulgar (SPEC 8). */}
      <Pressable
        accessibilityRole="button"
        disabled={!avisoDeErroresActivo || enviado}
        onPress={() => {
          probarAvisoDeErrores();
          setEnviado(true);
        }}
        style={({ pressed }) => [
          estilos.boton,
          { backgroundColor: p.acento, opacity: !avisoDeErroresActivo || enviado ? 0.5 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={{ color: p.acentoTinta, fontFamily: fuentes.textoNegrita, fontSize: medidas.texto.grande }}>
          {enviado ? "Prueba enviada a Sentry" : "Enviar prueba de error"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <Inicio />
    </SafeAreaProvider>
  );
}

export default envolver(App);

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: medidas.espacio.m, gap: medidas.espacio.m },
  cabecera: { borderRadius: medidas.radioGrande, padding: medidas.espacio.l, gap: medidas.espacio.xs },
  titulo: { fontSize: medidas.texto.titulo },
  tarjeta: { borderRadius: medidas.radio, borderWidth: 1, padding: medidas.espacio.m, gap: medidas.espacio.s },
  fila: { flexDirection: "row", gap: medidas.espacio.s, flexWrap: "wrap" },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, overflow: "hidden" },
  boton: {
    minHeight: medidas.toque + 8,
    margin: medidas.espacio.m,
    borderRadius: medidas.radio,
    alignItems: "center",
    justifyContent: "center",
  },
});
