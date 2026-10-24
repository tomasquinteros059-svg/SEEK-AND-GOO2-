// Registro: elegir perfil y completar los datos acordados (docs/00-decisiones-etapa-A.md).
//   Conductor: nombre completo, teléfono, foto de la licencia (obligatoria) y del camión (opcional).
//   Receptor (quien recibe los pedidos, un cliente): nombre y teléfono. El correo ya viene del inicio de sesión.
import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { normalizarFecha, revisarRegistro, VERSION_LEGAL } from "@reparto/dominio";
import { medidas } from "@reparto/ui-tokens";
import { type PerfilApp, useSesion } from "../src/sesion";
import { supabase, urlPanel } from "../src/supabase";
import { type Foto, subirDocumento, tomarFoto } from "../src/fotos";
import { usePaleta } from "../src/tema";
import { Aviso, Boton, Campo, Pantalla, Tarjeta, Texto, Titulo } from "../src/ui";

export default function Registro() {
  const { sesion, usuario, perfil, elegirPerfil, recargar } = useSesion();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [vence, setVence] = useState("");
  const [licencia, setLicencia] = useState<Foto | null>(null);
  const [camion, setCamion] = useState<Foto | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const p = usePaleta();

  // Ya tenía cuenta y solo cambia o elige el perfil en este teléfono.
  if (!perfil) return <ElegirPerfil onElegir={(x) => void elegirPerfil(x)} />;
  if (usuario && perfil === "receptor") return <Redirect href="/principal" />;
  const yaRegistrado = Boolean(usuario);

  async function elegir(cual: "licencia" | "camion", desde: "camara" | "galeria") {
    const r = await tomarFoto(desde);
    if (!r) return;
    if ("error" in r) return setError(r.error);
    setError(null);
    if (cual === "licencia") {
      setLicencia(r);
      setErrores(({ tieneLicencia: _, ...resto }) => resto);
    } else setCamion(r);
  }

  async function guardar() {
    if (!sesion) return router.replace("/entrar");
    setError(null);
    const r = revisarRegistro({
      perfil: perfil!,
      nombre: yaRegistrado ? usuario!.nombre : nombre,
      telefono: yaRegistrado ? usuario!.telefono : telefono,
      tieneLicencia: Boolean(licencia),
      aceptaTerminos: yaRegistrado || acepta,
    });
    const venceIso = vence.trim() ? normalizarFecha(vence) : null;
    const malos: Record<string, string> = r.ok ? {} : { ...(r.errores as Record<string, string>) };
    if (vence.trim() && !venceIso) malos.vence = "Escribe la fecha así: 01-05-2028.";
    setErrores(malos);
    if (!r.ok || Object.keys(malos).length > 0) return;

    setOcupado(true);
    try {
      const id = sesion.user.id;
      if (!yaRegistrado) {
        const { error: e } = await supabase.from("usuarios").insert({
          id, nombre: r.datos.nombre, telefono: r.datos.telefono, correo: (sesion.user.email ?? "").toLowerCase(),
        });
        if (e && e.code !== "23505") throw new Error(e.message);
        await supabase.from("consentimientos").insert([
          { usuario_id: id, tipo: "terminos", version: VERSION_LEGAL },
          { usuario_id: id, tipo: "privacidad", version: VERSION_LEGAL },
        ]);
      }
      if (perfil === "conductor" && licencia) {
        const ruta = await subirDocumento(id, licencia, "licencia");
        const { error: e } = await supabase.from("documentos_conductor").insert({ usuario_id: id, tipo: "licencia", ruta, vence: venceIso });
        if (e) throw new Error(e.message);
        if (camion) {
          const rutaCamion = await subirDocumento(id, camion, "camion");
          await supabase.from("documentos_conductor").insert({ usuario_id: id, tipo: "camion", ruta: rutaCamion });
        }
      }
      await recargar();
      router.replace("/principal");
    } catch {
      setError("No pudimos guardar. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla abajo={<Boton texto={yaRegistrado ? "Guardar licencia" : "Crear mi cuenta"} onPress={() => void guardar()} ocupado={ocupado} />}>
      <Titulo>{perfil === "conductor" ? "Tus datos de conductor" : "Tus datos"}</Titulo>
      {!yaRegistrado && (
        <>
          <Campo etiqueta="Nombre y apellido" value={nombre} onChangeText={setNombre} autoComplete="name" textContentType="name" error={errores.nombre} />
          <Campo etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" autoComplete="tel" ayuda="Ejemplo: +56 9 1234 5678" error={errores.telefono} />
        </>
      )}
      {perfil === "conductor" && (
        <Tarjeta>
          <Texto negrita>Foto de tu licencia de conducir</Texto>
          <Texto apagado chico>Se guarda privada. Solo la ven los administradores de las empresas donde trabajas.</Texto>
          {licencia ? <Image source={{ uri: licencia.uri }} style={e.foto} accessibilityLabel="Foto de tu licencia" /> : null}
          <View style={e.fila}>
            <View style={e.mitad}><Boton secundario texto="Tomar foto" onPress={() => void elegir("licencia", "camara")} /></View>
            <View style={e.mitad}><Boton secundario texto="Elegir" onPress={() => void elegir("licencia", "galeria")} /></View>
          </View>
          {errores.tieneLicencia ? <Aviso tipo="error">{errores.tieneLicencia}</Aviso> : null}
          <Campo etiqueta="Vence (opcional)" value={vence} onChangeText={setVence} placeholder="01-05-2028" keyboardType="numbers-and-punctuation" error={errores.vence} />
          <Texto negrita>Documentos del camión (opcional)</Texto>
          {camion ? <Image source={{ uri: camion.uri }} style={e.foto} accessibilityLabel="Foto del documento del camión" /> : null}
          <Boton secundario texto={camion ? "Cambiar foto" : "Agregar foto"} onPress={() => void elegir("camion", "galeria")} />
        </Tarjeta>
      )}
      {!yaRegistrado && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acepta }}
          onPress={() => {
            setAcepta(!acepta);
            setErrores(({ aceptaTerminos: _, ...resto }) => resto);
          }}
          style={e.casilla}
        >
          <View style={[e.cuadro, { borderColor: p.tinta, backgroundColor: acepta ? p.marca : "transparent" }]}>
            {acepta ? <Text style={{ color: p.marcaTinta, fontSize: 18, fontWeight: "700" }}>✓</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Texto>Acepto los Términos y Condiciones y la Política de privacidad.</Texto>
          </View>
        </Pressable>
      )}
      {!yaRegistrado && urlPanel ? (
        <View style={e.fila}>
          <View style={e.mitad}><Boton secundario texto="Ver Términos" onPress={() => void Linking.openURL(`${urlPanel}/legal/terminos`)} /></View>
          <View style={e.mitad}><Boton secundario texto="Ver Privacidad" onPress={() => void Linking.openURL(`${urlPanel}/legal/privacidad`)} /></View>
        </View>
      ) : null}
      {errores.aceptaTerminos ? <Aviso tipo="error">{errores.aceptaTerminos}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton secundario texto="Cambiar de perfil" onPress={() => void elegirPerfil(null)} />
    </Pantalla>
  );
}

function ElegirPerfil({ onElegir }: { onElegir: (p: PerfilApp) => void }) {
  return (
    <Pantalla>
      <Titulo>¿Cómo vas a usar la app?</Titulo>
      <Tarjeta>
        <Texto negrita>Soy conductor</Texto>
        <Texto apagado>Reparto pedidos para una o más empresas.</Texto>
        <Boton texto="Soy conductor" onPress={() => onElegir("conductor")} />
      </Tarjeta>
      <Tarjeta>
        <Texto negrita>Recibo pedidos</Texto>
        <Texto apagado>Soy cliente de una empresa y quiero seguir mis entregas.</Texto>
        <Boton secundario texto="Recibo pedidos" onPress={() => onElegir("receptor")} />
      </Tarjeta>
    </Pantalla>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: "row", gap: medidas.espacio.s },
  mitad: { flex: 1 },
  foto: { width: "100%", aspectRatio: 1.6, borderRadius: medidas.radio },
  casilla: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: medidas.toque },
  cuadro: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
