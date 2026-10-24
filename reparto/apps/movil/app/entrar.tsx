// Entrar sin contraseña: correo → código de 6 dígitos (SPEC 9).
import { useRef, useState } from "react";
import { router } from "expo-router";
import { normalizarCodigo, normalizarCorreo } from "@reparto/dominio";
import Constants from "expo-constants";
import { supabase } from "../src/supabase";
import { Aviso, Boton, Campo, Pantalla, Texto, Titulo } from "../src/ui";

const ESPERA_S = 60;

export default function Entrar() {
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pedidoEn = useRef(0);

  async function pedir() {
    setError(null);
    const limpio = normalizarCorreo(correo);
    if (!limpio) return setError("Escribe un correo válido.");
    const faltan = Math.ceil((pedidoEn.current + ESPERA_S * 1000 - Date.now()) / 1000);
    if (faltan > 0) return setError(`Puedes pedir otro código en ${faltan} s.`);
    setOcupado(true);
    const { error: e } = await supabase.auth.signInWithOtp({ email: limpio, options: { shouldCreateUser: true } });
    setOcupado(false);
    if (e) return setError(traducir(e.message));
    pedidoEn.current = Date.now();
    setCorreo(limpio);
    setPaso("codigo");
  }

  async function verificar() {
    setError(null);
    const limpio = normalizarCodigo(codigo);
    if (!limpio) return setError("El código tiene 6 números.");
    setOcupado(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: correo, token: limpio, type: "email" });
    setOcupado(false);
    if (e) return setError(traducir(e.message));
    router.replace("/");
  }

  if (paso === "correo") {
    return (
      <Pantalla abajo={<Boton texto="Enviarme el código" onPress={() => void pedir()} ocupado={ocupado} />}>
        <Titulo>{Constants.expoConfig?.name ?? "Reparto"}</Titulo>
        <Texto>Entra con tu correo. Te enviaremos un código de 6 números; no necesitas contraseña.</Texto>
        <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </Pantalla>
    );
  }
  return (
    <Pantalla
      abajo={
        <>
          <Boton texto="Entrar" onPress={() => void verificar()} ocupado={ocupado} />
          <Boton texto="Enviarme otro código" secundario onPress={() => void pedir()} deshabilitado={ocupado} />
        </>
      }
    >
      <Titulo>Escribe el código</Titulo>
      <Texto>Lo enviamos a {correo}. Dura 10 minutos.</Texto>
      <Campo etiqueta="Código" value={codigo} onChangeText={setCodigo} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={7} />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton texto="Usar otro correo" secundario onPress={() => { setPaso("correo"); setCodigo(""); setError(null); }} />
    </Pantalla>
  );
}

function traducir(mensaje: string): string {
  if (/expired|invalid/i.test(mensaje)) return "El código no es correcto o ya venció. Pide otro.";
  if (/rate|seconds|too many/i.test(mensaje)) return "Pediste muchos códigos seguidos. Espera un minuto.";
  return "No pudimos completar el paso. Revisa tu conexión e inténtalo otra vez.";
}
