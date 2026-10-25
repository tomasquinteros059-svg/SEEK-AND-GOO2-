// Cerrar una entrega: «Entregar» (foto de la guía firmada y mensaje, obligatorios) o «No entregado»
// (motivo, foto y mensaje). El mensaje va al administrador y, de ahí, el agente lo prepara para el cliente.
// Si hay señal, el Agente de Entregas revisa la foto en el momento y pide otra si no sirve.
import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { MOTIVOS_NO_ENTREGA } from "@reparto/dominio";
import { medidas } from "@reparto/ui-tokens";
import { entregasDeHoy, type EntregaDelDia } from "../src/dia";
import { encolar, enviarPendientes, nuevoId, revisarFoto, type Accion } from "../src/cola";
import { type Foto, tomarFoto } from "../src/fotos";
import { dondeEstoy } from "../src/ubicacion";
import { fuentes, usePaleta } from "../src/tema";
import { Aviso, Boton, Campo, Cargando, Pantalla, Tarjeta, Texto, Titulo } from "../src/ui";

type Fase = "llenando" | "revisando" | "rechazada" | "listo" | "sin_senal";

export default function Cierre() {
  const { id, empresa, modo } = useLocalSearchParams<{ id: string; empresa: string; modo: "entregar" | "no" }>();
  const entregar = modo !== "no";
  const p = usePaleta();
  const [e, setE] = useState<EntregaDelDia | null>(null);
  const [guia, setGuia] = useState<Foto | null>(null);
  const [extra, setExtra] = useState<Foto | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [motivo, setMotivo] = useState<string | null>(null);
  const [pagoRecibido, setPagoRecibido] = useState(false);
  const [forma, setForma] = useState<"transferencia" | "efectivo">("transferencia");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fase, setFase] = useState<Fase>("llenando");
  const [motivoFoto, setMotivoFoto] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    void entregasDeHoy(empresa).then((l) => setE(l.find((x) => x.id === id) ?? null));
  }, [id, empresa]));

  if (!e) return <Cargando />;
  const cobrar = entregar && e.pago?.tipo === "cobrar";

  async function elegir(cual: "guia" | "extra", desde: "camara" | "galeria") {
    const r = await tomarFoto(desde);
    if (!r) return;
    if ("error" in r) return setError(r.error);
    setError(null);
    if (cual === "guia") { setGuia(r); setErrores(({ foto: _, ...resto }) => resto); }
    else setExtra(r);
  }

  async function confirmar() {
    const malos: Record<string, string> = {};
    if (!guia) malos.foto = entregar ? "Falta la foto de la guía firmada." : "Falta la foto del local o de la situación.";
    if (!mensaje.trim()) malos.mensaje = "Falta el mensaje (puedes dictarlo con el micrófono del teclado).";
    if (!entregar && !motivo) malos.motivo = "Elige el motivo.";
    if (cobrar && !pagoRecibido) malos.pago = "Confirma que recibiste el pago.";
    setErrores(malos);
    if (Object.keys(malos).length > 0) return;

    setFase("revisando");
    const punto = await dondeEstoy();
    const ahora = new Date().toISOString();
    const fotos: Accion[] = [
      { id: nuevoId(), clase: "foto", entrega: e!.id, empresa: e!.empresa_id, tipo: entregar ? "guia" : "entrega", uri: guia!.uri },
      ...(extra ? [{ id: nuevoId(), clase: "foto" as const, entrega: e!.id, empresa: e!.empresa_id, tipo: "entrega" as const, uri: extra.uri }] : []),
    ];
    const evento = nuevoId();
    await encolar(...fotos, {
      id: evento, clase: "evento", entrega: e!.id, tipo: entregar ? "entregada" : "no_entregada", ocurrido_en: ahora,
      mensaje: mensaje.trim(), ...(motivo ? { motivo } : {}), ...(punto ?? {}), fotos: fotos.map((f) => f.id),
      cobro: cobrar ? { forma } : null,
    });
    const r = await enviarPendientes();
    if (r.quedan > 0) return setFase("sin_senal");
    await revisar(evento);
  }

  async function revisar(evento: string) {
    setFase("revisando");
    const r = await revisarFoto(evento);
    if (r && !r.foto_ok) {
      setMotivoFoto(r.motivo_foto ?? "La foto no sirve como comprobante.");
      return setFase("rechazada");
    }
    setFase("listo");  // si la revisión tarda, sigue en segundo plano y el administrador la ve igual
  }

  async function otraFoto() {
    const r = await tomarFoto("camara");
    if (!r || "error" in r) return;
    setGuia(r);
    const foto = nuevoId();
    const evento = nuevoId();
    await encolar(
      { id: foto, clase: "foto", entrega: e!.id, empresa: e!.empresa_id, tipo: entregar ? "guia" : "entrega", uri: r.uri },
      { id: evento, clase: "evento", entrega: e!.id, tipo: "foto_agregada", ocurrido_en: new Date().toISOString(), mensaje: mensaje.trim(), fotos: [foto] },
    );
    const envio = await enviarPendientes();
    if (envio.quedan > 0) return setFase("sin_senal");
    await revisar(evento);
  }

  if (fase === "revisando") {
    return <Pantalla><Titulo>Revisando la foto…</Titulo><Texto apagado>Un momento: comprobamos que la foto sirva como comprobante.</Texto></Pantalla>;
  }
  if (fase === "rechazada") {
    return (
      <Pantalla abajo={<><Boton texto="Tomar otra foto" onPress={() => void otraFoto()} /><Boton secundario texto="Seguir sin cambiarla" onPress={() => setFase("listo")} /></>}>
        <Titulo>La foto no sirve</Titulo>
        <Aviso tipo="error">{motivoFoto}</Aviso>
        {guia ? <Image source={{ uri: guia.uri }} style={e2.foto} accessibilityLabel="Foto rechazada" /> : null}
        <Texto apagado>La entrega ya quedó registrada. Si no puedes tomar otra, el administrador la revisará.</Texto>
      </Pantalla>
    );
  }
  if (fase === "listo" || fase === "sin_senal") {
    return (
      <Pantalla abajo={<Boton texto="Volver a la ruta" onPress={() => router.dismissTo({ pathname: "/ruta", params: { empresa } })} />}>
        <Titulo>{entregar ? "Entrega registrada" : "Registrado como no entregado"}</Titulo>
        {fase === "sin_senal"
          ? <Aviso>Sin señal: quedó guardado en el teléfono con la hora real y se enviará solo cuando vuelva la conexión.</Aviso>
          : <Aviso tipo="ok">Tu mensaje le llegó al administrador.</Aviso>}
      </Pantalla>
    );
  }

  return (
    <Pantalla abajo={<Boton texto={entregar ? "Confirmar entrega" : "Confirmar no entregado"} onPress={() => void confirmar()} />}>
      <Titulo>{entregar ? "Entregar" : "No entregado"}</Titulo>
      <Texto>{e.receptor.nombre} · guía {e.guia} · {e.bultos} bultos</Texto>

      {!entregar ? (
        <Tarjeta>
          <Texto negrita>Motivo</Texto>
          <View style={e2.chips}>
            {MOTIVOS_NO_ENTREGA.map((m) => (
              <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: motivo === m }} onPress={() => { setMotivo(m); setErrores(({ motivo: _, ...r }) => r); }}
                style={[e2.chip, { borderColor: motivo === m ? p.marca : p.linea, backgroundColor: motivo === m ? p.marca : p.superficie }]}>
                <Text style={{ color: motivo === m ? p.marcaTinta : p.tinta, fontFamily: fuentes.textoNegrita, fontSize: medidas.texto.normal }}>{m}</Text>
              </Pressable>
            ))}
          </View>
          {errores.motivo ? <Aviso tipo="error">{errores.motivo}</Aviso> : null}
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Texto negrita>{entregar ? "Foto de la guía firmada o timbrada" : "Foto del local o de la situación"}</Texto>
        {guia ? <Image source={{ uri: guia.uri }} style={e2.foto} accessibilityLabel="Foto principal" /> : null}
        <View style={e2.fila}>
          <View style={e2.mitad}><Boton secundario texto={guia ? "Otra foto" : "Tomar foto"} onPress={() => void elegir("guia", "camara")} /></View>
          <View style={e2.mitad}><Boton secundario texto="Elegir" onPress={() => void elegir("guia", "galeria")} /></View>
        </View>
        {errores.foto ? <Aviso tipo="error">{errores.foto}</Aviso> : null}
        {entregar ? (
          <>
            {extra ? <Image source={{ uri: extra.uri }} style={e2.foto} accessibilityLabel="Foto adicional" /> : null}
            <Boton secundario texto={extra ? "Cambiar foto adicional" : "Agregar foto de los bultos (opcional)"} onPress={() => void elegir("extra", "camara")} />
          </>
        ) : null}
      </Tarjeta>

      <Campo etiqueta="Mensaje" value={mensaje} onChangeText={(t) => { setMensaje(t); if (t.trim()) setErrores(({ mensaje: _, ...r }) => r); }}
        multiline numberOfLines={3} maxLength={1000} placeholder={entregar ? "Ej.: Recibió Pedro en andén 3, 12 bultos" : "Ej.: Cortina abajo, nadie contesta"}
        ayuda="Puedes dictarlo con el micrófono del teclado." error={errores.mensaje} style={{ minHeight: 96, textAlignVertical: "top", paddingTop: 12 }} />

      {cobrar ? (
        <Tarjeta>
          <Texto negrita>Cobro: ${Number(e.pago!.monto).toLocaleString("es-CL")}</Texto>
          <View style={e2.fila}>
            {(["transferencia", "efectivo"] as const).map((f) => (
              <View key={f} style={e2.mitad}><Boton secundario={forma !== f} texto={f === "transferencia" ? "Transferencia" : "Efectivo"} onPress={() => setForma(f)} /></View>
            ))}
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: pagoRecibido }} onPress={() => { setPagoRecibido(!pagoRecibido); setErrores(({ pago: _, ...r }) => r); }} style={e2.casilla}>
            <View style={[e2.cuadro, { borderColor: p.tinta, backgroundColor: pagoRecibido ? p.marca : "transparent" }]}>
              {pagoRecibido ? <Text style={{ color: p.marcaTinta, fontSize: 18, fontWeight: "700" }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}><Texto>Recibí el pago</Texto></View>
          </Pressable>
          {errores.pago ? <Aviso tipo="error">{errores.pago}</Aviso> : null}
        </Tarjeta>
      ) : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </Pantalla>
  );
}

const e2 = StyleSheet.create({
  fila: { flexDirection: "row", gap: medidas.espacio.s },
  mitad: { flex: 1 },
  foto: { width: "100%", aspectRatio: 4 / 3, borderRadius: medidas.radio },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: medidas.toque, borderRadius: 999, borderWidth: 2, paddingHorizontal: 14, justifyContent: "center" },
  casilla: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: medidas.toque },
  cuadro: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
