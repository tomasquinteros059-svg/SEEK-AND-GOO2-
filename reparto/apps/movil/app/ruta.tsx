// Ruta del día (SPEC 7, conductor: pantallas 5, 12 y 15): iniciar, ver entregas, pendientes sin señal y terminar.
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { medidas } from "@reparto/ui-tokens";
import { entregasDeHoy, hhmm, hoyEnChile, jornadaDeHoy, type EntregaDelDia } from "../src/dia";
import { enviarPendientes, nuevoId, pendientes } from "../src/cola";
import { supabase } from "../src/supabase";
import { usePaleta } from "../src/tema";
import { Aviso, Boton, Tarjeta, Texto, Titulo } from "../src/ui";

const ESTADO: Record<string, string> = {
  publicada: "Por entregar", en_camino: "En camino", cerca: "Cerca", en_destino: "En el local",
  entregada: "Entregada", fallida: "No entregada",
};
const CERRADA = (e: string) => e === "entregada" || e === "fallida";

export default function Ruta() {
  const { empresa, nombre } = useLocalSearchParams<{ empresa: string; nombre?: string }>();
  const p = usePaleta();
  const [entregas, setEntregas] = useState<EntregaDelDia[]>([]);
  const [jornada, setJornada] = useState<Awaited<ReturnType<typeof jornadaDeHoy>>>(null);
  const [cola, setCola] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresa) return;
    setCargando(true);
    await enviarPendientes().catch(() => null);
    const [e, j, c] = await Promise.all([entregasDeHoy(empresa), jornadaDeHoy(empresa), pendientes()]);
    setEntregas(e); setJornada(j); setCola(c); setCargando(false);
  }, [empresa]);
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  async function iniciar() {
    setOcupado(true);
    const { error } = await supabase.rpc("iniciar_jornada", { jornada: nuevoId(), empresa, dia: hoyEnChile(), ocurrido_en: new Date().toISOString() });
    setOcupado(false);
    if (error) return setAviso("No pudimos iniciar la ruta. Revisa tu conexión.");
    await cargar();
  }

  async function terminar() {
    if (!jornada) return;
    if (cola > 0) return setAviso(`Aún hay ${cola} envíos pendientes. Busca señal y espera a que se envíen antes de terminar.`);
    const abiertas = entregas.filter((e) => !CERRADA(e.estado)).length;
    if (abiertas > 0 && aviso !== "confirmar") {
      setAviso("confirmar");
      return;
    }
    setOcupado(true);
    const { error } = await supabase.rpc("terminar_jornada", { jornada: jornada.id, ocurrido_en: new Date().toISOString() });
    setOcupado(false);
    if (error) return setAviso("No pudimos terminar la ruta. Revisa tu conexión.");
    setAviso(null);
    await cargar();
  }

  const abierta = jornada?.estado === "abierta";
  const hechas = entregas.filter((e) => CERRADA(e.estado)).length;
  const abiertas = entregas.length - hechas;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.fondo }}>
      <ScrollView contentContainerStyle={{ padding: medidas.espacio.m, gap: medidas.espacio.m }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void cargar()} />}>
        <Titulo>Ruta de hoy</Titulo>
        {nombre ? <Texto apagado>{nombre}</Texto> : null}
        <Texto>{entregas.length} entregas · {hechas} cerradas · {entregas.reduce((s, e) => s + e.bultos, 0)} bultos</Texto>
        {cola > 0 ? <Aviso>{cola} {cola === 1 ? "envío pendiente" : "envíos pendientes"} sin señal. Se envían solos cuando vuelva la conexión.</Aviso> : null}
        {aviso === "confirmar" ? (
          <Tarjeta>
            <Aviso>Te quedan {abiertas} entregas sin cerrar. ¿Terminar la ruta igual?</Aviso>
            <Boton texto="Sí, terminar la ruta" onPress={() => void terminar()} ocupado={ocupado} />
            <Boton secundario texto="Seguir en ruta" onPress={() => setAviso(null)} />
          </Tarjeta>
        ) : aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}

        {jornada?.estado === "cerrada" && jornada.resumen ? (
          <Tarjeta>
            <Texto negrita>Ruta terminada</Texto>
            <Texto>{jornada.resumen.entregadas ?? 0} entregadas · {jornada.resumen.no_entregadas ?? 0} no entregadas · {jornada.resumen.bultos_entregados ?? 0} bultos</Texto>
            {jornada.resumen.cobrado ? <Texto>Cobrado: ${Number(jornada.resumen.cobrado).toLocaleString("es-CL")}</Texto> : null}
          </Tarjeta>
        ) : null}

        {entregas.length === 0 && !cargando ? <Texto apagado>No tienes entregas publicadas para hoy.</Texto> : null}
        {entregas.map((e, i) => (
          <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${e.receptor.nombre}, guía ${e.guia}`}
            onPress={() => router.push({ pathname: "/entrega/[id]", params: { id: e.id, empresa } })}>
            <Tarjeta>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Texto negrita>{i + 1}. {e.receptor.nombre}</Texto>
                  <Texto apagado chico>{e.direccion}, {e.comuna}</Texto>
                  <Texto chico>Guía {e.guia} · {e.bultos} bultos{e.hora_comprometida ? ` · ${hhmm(e.hora_comprometida)}` : ""}{e.ventana_desde ? ` · recibe ${hhmm(e.ventana_desde)}–${hhmm(e.ventana_hasta)}` : ""}</Texto>
                </View>
                <Texto negrita chico>{ESTADO[e.estado] ?? e.estado}</Texto>
              </View>
            </Tarjeta>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ padding: medidas.espacio.m }}>
        {!jornada || jornada.estado === "cerrada" ? (
          entregas.length > 0 && jornada?.estado !== "cerrada" ? <Boton texto="Iniciar ruta" onPress={() => void iniciar()} ocupado={ocupado} /> : null
        ) : abierta && aviso !== "confirmar" ? (
          <Boton secundario={abiertas > 0} texto="Terminar ruta" onPress={() => void terminar()} ocupado={ocupado} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
