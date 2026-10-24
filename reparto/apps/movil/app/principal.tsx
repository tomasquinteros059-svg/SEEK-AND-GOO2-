// Pantalla principal: invitaciones, mis empresas y mis documentos.
// La ruta del día (conductor) llega en la Fase 3; los pedidos (receptor) en la Fase 5.
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { medidas } from "@reparto/ui-tokens";
import { useSesion } from "../src/sesion";
import { supabase } from "../src/supabase";
import { usePaleta } from "../src/tema";
import { Aviso, Boton, Tarjeta, Texto, Titulo } from "../src/ui";

type Invitacion = { id: string; empresa: string; rol: "admin" | "conductor" };
type Membresia = { empresa_id: string; rol: string; estado: string; empresas: { nombre: string } | null };
type Documento = { id: string; tipo: string; vence: string | null; revisiones_documento: { empresa_id: string; estado: string; nota: string | null }[] };

const ESTADO_DOC: Record<string, string> = { aprobado: "Aprobado", rechazado: "Rechazado", pendiente: "Por revisar" };

export default function Principal() {
  const { usuario, perfil, salir, elegirPerfil } = useSesion();
  const p = usePaleta();
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "ok" | "error" } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    const [inv, mem, docs] = await Promise.all([
      supabase.rpc("mis_invitaciones"),
      supabase.from("membresias").select("empresa_id, rol, estado, empresas(nombre)").eq("usuario_id", usuario.id),
      supabase.from("documentos_conductor").select("id, tipo, vence, revisiones_documento(empresa_id, estado, nota)").eq("usuario_id", usuario.id),
    ]);
    setInvitaciones((inv.data ?? []) as Invitacion[]);
    setMembresias((mem.data ?? []) as unknown as Membresia[]);
    setDocumentos((docs.data ?? []) as unknown as Documento[]);
    setCargando(false);
  }, [usuario]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  async function responder(inv: Invitacion, aceptar: boolean) {
    setOcupado(inv.id);
    const { error } = aceptar
      ? await supabase.rpc("aceptar_invitacion", { invitacion: inv.id })
      : await supabase.rpc("rechazar_invitacion", { invitacion: inv.id });
    setOcupado(null);
    setAviso(error ? { texto: error.message, tipo: "error" } : { texto: aceptar ? `Ahora trabajas con ${inv.empresa}.` : "Invitación rechazada.", tipo: "ok" });
    await cargar();
  }

  if (!usuario) return null;
  const nombreEmpresa = (id: string) => membresias.find((m) => m.empresa_id === id)?.empresas?.nombre ?? "otra empresa";
  const sinLicencia = perfil === "conductor" && !documentos.some((d) => d.tipo === "licencia");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: medidas.espacio.m, gap: medidas.espacio.m }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void cargar()} />}
      >
        <Titulo>Hola, {usuario.nombre.split(" ")[0]}</Titulo>
        {aviso ? <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso> : null}

        {invitaciones.map((inv) => (
          <Tarjeta key={inv.id}>
            <Texto negrita>{inv.empresa} te invitó</Texto>
            <Texto apagado>Como {inv.rol === "admin" ? "administrador (usa el panel web)" : "conductor"}.</Texto>
            <Boton texto="Aceptar" onPress={() => void responder(inv, true)} ocupado={ocupado === inv.id} />
            <Boton secundario texto="Rechazar" onPress={() => void responder(inv, false)} deshabilitado={ocupado === inv.id} />
          </Tarjeta>
        ))}

        {perfil === "conductor" ? (
          <>
            {sinLicencia ? (
              <Tarjeta>
                <Aviso>Falta la foto de tu licencia.</Aviso>
                <Boton texto="Subir mi licencia" onPress={() => router.push("/registro")} />
              </Tarjeta>
            ) : null}
            <Tarjeta>
              <Texto negrita>Mis empresas</Texto>
              {membresias.length === 0 ? (
                <Texto apagado>Todavía no trabajas con ninguna empresa. Pide que te inviten a {usuario.correo}.</Texto>
              ) : membresias.map((m) => (
                <Texto key={m.empresa_id}>
                  {m.empresas?.nombre ?? "Empresa"} · {m.rol === "admin" ? "Administrador" : "Conductor"}{m.estado === "suspendido" ? " · Acceso suspendido" : ""}
                </Texto>
              ))}
            </Tarjeta>
            <Tarjeta>
              <Texto negrita>Mis documentos</Texto>
              {documentos.length === 0 ? <Texto apagado>Sin documentos.</Texto> : documentos.map((d) => (
                <View key={d.id} style={{ gap: 2 }}>
                  <Texto>{d.tipo === "licencia" ? "Licencia de conducir" : "Documento del camión"}{d.vence ? ` · vence ${d.vence.split("-").reverse().join("-")}` : ""}</Texto>
                  {d.revisiones_documento.length === 0 ? <Texto apagado chico>Por revisar</Texto> : d.revisiones_documento.map((r) => (
                    <Texto key={r.empresa_id} apagado chico>{nombreEmpresa(r.empresa_id)}: {ESTADO_DOC[r.estado] ?? r.estado}{r.nota ? ` — ${r.nota}` : ""}</Texto>
                  ))}
                </View>
              ))}
            </Tarjeta>
            <Tarjeta>
              <Texto apagado>Tu ruta del día aparecerá aquí (próxima fase).</Texto>
            </Tarjeta>
          </>
        ) : (
          <Tarjeta>
            <Texto apagado>Tus pedidos aparecerán aquí cuando una empresa te los asigne (próxima fase).</Texto>
          </Tarjeta>
        )}

        <Boton secundario texto="Cambiar de perfil" onPress={() => { void elegirPerfil(null); router.replace("/registro"); }} />
        <Boton secundario texto="Salir" onPress={() => { void salir().then(() => router.replace("/entrar")); }} />
      </ScrollView>
    </SafeAreaView>
  );
}
