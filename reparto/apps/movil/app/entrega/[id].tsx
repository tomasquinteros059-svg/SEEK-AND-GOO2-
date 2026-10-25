// Una entrega: ir (Waze o Maps), «Llegué», entregar o no entregado (SPEC 7, conductor: pantalla 6).
import { useCallback, useState } from "react";
import { Linking, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { entregasDeHoy, enlacesDeNavegacion, hhmm, jornadaDeHoy, type EntregaDelDia } from "../../src/dia";
import { encolar, enviarPendientes, nuevoId } from "../../src/cola";
import { dondeEstoy } from "../../src/ubicacion";
import { Aviso, Boton, Cargando, Pantalla, Tarjeta, Texto, Titulo } from "../../src/ui";

export default function Entrega() {
  const { id, empresa } = useLocalSearchParams<{ id: string; empresa: string }>();
  const [e, setE] = useState<EntregaDelDia | null>(null);
  const [enRuta, setEnRuta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [lista, j] = await Promise.all([entregasDeHoy(empresa), jornadaDeHoy(empresa)]);
    setE(lista.find((x) => x.id === id) ?? null);
    setEnRuta(j?.estado === "abierta");
  }, [id, empresa]);
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  if (!e) return <Cargando />;
  const nav = enlacesDeNavegacion(e);
  const cerrada = e.estado === "entregada" || e.estado === "fallida";

  async function evento(tipo: "en_camino" | "llegue") {
    const punto = tipo === "llegue" ? await dondeEstoy() : null;
    await encolar({ id: nuevoId(), clase: "evento", entrega: e!.id, tipo, ocurrido_en: new Date().toISOString(), ...(punto ?? {}) });
    const r = await enviarPendientes();
    if (r.quedan > 0) setAviso("Sin señal: quedó guardado y se enviará solo.");
    await cargar();
  }

  async function ir(url: string) {
    if (e!.estado === "publicada") void evento("en_camino");
    await Linking.openURL(url);
  }

  return (
    <Pantalla
      abajo={!cerrada && enRuta ? (
        <>
          {e.estado !== "en_destino" ? <Boton secundario texto="Llegué" onPress={() => void evento("llegue")} /> : null}
          <Boton texto="Entregar" onPress={() => router.push({ pathname: "/cierre", params: { id: e.id, empresa, modo: "entregar" } })} />
          <Boton secundario texto="No entregado" onPress={() => router.push({ pathname: "/cierre", params: { id: e.id, empresa, modo: "no" } })} />
        </>
      ) : undefined}
    >
      <Titulo>{e.receptor.nombre}</Titulo>
      <Texto>{e.direccion}, {e.comuna}</Texto>
      <Tarjeta>
        <Texto negrita>Guía {e.guia} · {e.bultos} bultos</Texto>
        {e.hora_comprometida ? <Texto>Hora comprometida: {hhmm(e.hora_comprometida)}</Texto> : null}
        {e.ventana_desde ? <Texto>Recibe de {hhmm(e.ventana_desde)} a {hhmm(e.ventana_hasta)}</Texto> : null}
        {e.pago?.tipo === "cobrar" ? <Texto negrita>Cobrar ${Number(e.pago.monto).toLocaleString("es-CL")}{e.pago.forma && e.pago.forma !== "cualquiera" ? ` (${e.pago.forma})` : ""}</Texto> : null}
        {e.notas ? <Texto apagado>Nota: {e.notas}</Texto> : null}
        {e.receptor.notas ? <Texto apagado>Del local: {e.receptor.notas}</Texto> : null}
      </Tarjeta>
      {!enRuta && !cerrada ? <Aviso>Toca «Iniciar ruta» en la pantalla anterior para empezar.</Aviso> : null}
      {cerrada ? <Aviso tipo="ok">{e.estado === "entregada" ? "Entregada." : "Marcada como no entregada."}</Aviso> : null}
      {aviso ? <Aviso>{aviso}</Aviso> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Boton secundario texto="Waze" onPress={() => void ir(nav.waze)} /></View>
        <View style={{ flex: 1 }}><Boton secundario texto="Google Maps" onPress={() => void ir(nav.maps)} /></View>
      </View>
    </Pantalla>
  );
}
