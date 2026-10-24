// Piezas de pantalla con la identidad de la SPEC 8: textos grandes, botones de 48 px como mínimo,
// un solo botón principal amarillo abajo, y estados que no dependen solo del color.
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { medidas, type Paleta } from "@reparto/ui-tokens";
import { fuentes, usePaleta } from "./tema";

export function Pantalla({ children, abajo }: { children: ReactNode; abajo?: ReactNode }) {
  const p = usePaleta();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.fondo }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {abajo ? <View style={e.abajo}>{abajo}</View> : null}
    </SafeAreaView>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  const p = usePaleta();
  return <Text accessibilityRole="header" style={{ color: p.tinta, fontFamily: fuentes.titulo, fontSize: medidas.texto.titulo }}>{children}</Text>;
}

export function Texto({ children, apagado, negrita, chico }: { children: ReactNode; apagado?: boolean; negrita?: boolean; chico?: boolean }) {
  const p = usePaleta();
  return (
    <Text style={{
      color: apagado ? p.apagado : p.tinta,
      fontFamily: negrita ? fuentes.textoNegrita : fuentes.texto,
      fontSize: chico ? medidas.texto.chico : medidas.texto.normal,
      lineHeight: (chico ? medidas.texto.chico : medidas.texto.normal) * 1.4,
    }}>{children}</Text>
  );
}

export function Tarjeta({ children }: { children: ReactNode }) {
  const p = usePaleta();
  return <View style={[e.tarjeta, { backgroundColor: p.superficie, borderColor: p.linea }]}>{children}</View>;
}

export function Boton({ texto, onPress, ocupado, secundario, deshabilitado }: {
  texto: string; onPress: () => void; ocupado?: boolean; secundario?: boolean; deshabilitado?: boolean;
}) {
  const p = usePaleta();
  const apagado = Boolean(ocupado || deshabilitado);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: apagado, busy: Boolean(ocupado) }}
      disabled={apagado}
      onPress={onPress}
      style={({ pressed }) => [
        e.boton,
        secundario ? { backgroundColor: p.superficie, borderColor: p.linea, borderWidth: 1 } : { backgroundColor: p.acento },
        { opacity: apagado ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      {ocupado ? <ActivityIndicator color={secundario ? p.tinta : p.acentoTinta} /> : (
        <Text style={{ color: secundario ? p.tinta : p.acentoTinta, fontFamily: fuentes.textoNegrita, fontSize: medidas.texto.grande }}>{texto}</Text>
      )}
    </Pressable>
  );
}

export function Campo({ etiqueta, error, ayuda, ...props }: TextInputProps & { etiqueta: string; error?: string | undefined; ayuda?: string }) {
  const p = usePaleta();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.tinta, fontFamily: fuentes.textoNegrita, fontSize: medidas.texto.normal }}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={p.apagado}
        style={[e.entrada, { color: p.tinta, backgroundColor: p.superficie, borderColor: error ? p.atraso : p.linea, fontFamily: fuentes.texto }]}
        {...props}
      />
      {error ? <Aviso tipo="error">{error}</Aviso> : ayuda ? <Texto apagado chico>{ayuda}</Texto> : null}
    </View>
  );
}

export function Aviso({ children, tipo = "info" }: { children: ReactNode; tipo?: "info" | "error" | "ok" }) {
  const p = usePaleta();
  const [color, fondo] = colores(p, tipo);
  return (
    <View accessibilityRole={tipo === "error" ? "alert" : "text"} style={{ backgroundColor: fondo, borderRadius: medidas.radio, padding: 12 }}>
      <Text style={{ color, fontFamily: fuentes.textoNegrita, fontSize: medidas.texto.normal }}>{children}</Text>
    </View>
  );
}

function colores(p: Paleta, tipo: "info" | "error" | "ok"): [string, string] {
  if (tipo === "error") return [p.atraso, p.atrasoFondo];
  if (tipo === "ok") return [p.ok, p.okFondo];
  return [p.aviso, p.avisoFondo];
}

export function Cargando() {
  const p = usePaleta();
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: p.fondo }}><ActivityIndicator size="large" color={p.marca} /></View>;
}

const e = StyleSheet.create({
  contenido: { padding: medidas.espacio.m, gap: medidas.espacio.m },
  abajo: { padding: medidas.espacio.m, gap: medidas.espacio.s },
  tarjeta: { borderRadius: medidas.radio, borderWidth: 1, padding: medidas.espacio.m, gap: medidas.espacio.s },
  boton: { minHeight: medidas.toque + 8, borderRadius: medidas.radio, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  entrada: { minHeight: medidas.toque + 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: medidas.texto.grande },
});
