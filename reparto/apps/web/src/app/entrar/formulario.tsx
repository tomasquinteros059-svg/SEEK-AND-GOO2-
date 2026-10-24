"use client";

// Entrar sin contraseña: correo → código de 6 dígitos (SPEC 9).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizarCodigo, normalizarCorreo } from "@reparto/dominio";
import { clienteNavegador } from "@/lib/supabase/navegador";

const ESPERA_S = 60;

export function FormularioEntrar() {
  const router = useRouter();
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pedidoEn, setPedidoEn] = useState(0);

  async function pedirCodigo() {
    setError(null);
    const limpio = normalizarCorreo(correo);
    if (!limpio) return setError("Escribe un correo válido.");
    const faltan = Math.ceil((pedidoEn + ESPERA_S * 1000 - Date.now()) / 1000);
    if (faltan > 0) return setError(`Puedes pedir otro código en ${faltan} s.`);
    setOcupado(true);
    const { error: e } = await clienteNavegador().auth.signInWithOtp({ email: limpio, options: { shouldCreateUser: true } });
    setOcupado(false);
    if (e) return setError(traducir(e.message));
    setCorreo(limpio);
    setPedidoEn(Date.now());
    setPaso("codigo");
  }

  async function verificar() {
    setError(null);
    const limpio = normalizarCodigo(codigo);
    if (!limpio) return setError("El código tiene 6 números.");
    setOcupado(true);
    const { error: e } = await clienteNavegador().auth.verifyOtp({ email: correo, token: limpio, type: "email" });
    setOcupado(false);
    if (e) return setError(traducir(e.message));
    router.replace("/panel");
    router.refresh();
  }

  return (
    <form
      className="tarjeta"
      onSubmit={(ev) => {
        ev.preventDefault();
        void (paso === "correo" ? pedirCodigo() : verificar());
      }}
    >
      {paso === "correo" ? (
        <>
          <h2>Entra con tu correo</h2>
          <p className="apagado">Te enviaremos un código de 6 números. No necesitas contraseña.</p>
          <label className="campo">
            Correo
            <input type="email" autoComplete="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
          </label>
          <button className="boton" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviarme el código"}</button>
        </>
      ) : (
        <>
          <h2>Escribe el código</h2>
          <p className="apagado">Lo enviamos a <strong>{correo}</strong>. Dura 10 minutos.</p>
          <label className="campo">
            Código
            <input
              className="cifra codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
            />
          </label>
          <button className="boton" disabled={ocupado}>{ocupado ? "Revisando…" : "Entrar"}</button>
          <button type="button" className="boton-secundario" disabled={ocupado} onClick={() => void pedirCodigo()}>
            Enviarme otro código
          </button>
          <button type="button" className="enlace" onClick={() => { setPaso("correo"); setCodigo(""); setError(null); }}>
            Usar otro correo
          </button>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function traducir(mensaje: string): string {
  if (/expired|invalid/i.test(mensaje)) return "El código no es correcto o ya venció. Pide otro.";
  if (/rate|seconds|too many/i.test(mensaje)) return "Pediste muchos códigos seguidos. Espera un minuto.";
  return "No pudimos completar el paso. Revisa tu conexión e inténtalo otra vez.";
}
