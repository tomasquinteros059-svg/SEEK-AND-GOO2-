"use client";

import { useActionState } from "react";
import Link from "next/link";
import { completarRegistro, type Estado } from "../acciones";

type Modo = "completo" | "perfil" | "empresa";

export function FormularioEmpezar({ modo, correo }: { modo: Modo; correo: string }) {
  const [estado, accion, enviando] = useActionState<Estado, FormData>(completarRegistro, {});
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};
  const titulo = modo === "empresa" ? "Crear otra empresa" : modo === "perfil" ? "Tus datos" : "Registra tu empresa";

  return (
    <form action={accion} className="tarjeta" noValidate>
      <h1>{titulo}</h1>
      {modo === "perfil" && <p className="apagado">Completa tus datos para aceptar la invitación que te enviaron.</p>}
      <input type="hidden" name="modo" value={modo} />

      {modo !== "empresa" && (
        <>
          <p className="apagado">Entraste como <strong>{correo}</strong>.</p>
          <Campo nombre="nombre" etiqueta="Tu nombre y apellido" error={e.nombre} valor={v.nombre} autoComplete="name" />
          <Campo nombre="telefono" etiqueta="Tu teléfono" error={e.telefono} valor={v.telefono} tipo="tel" ayuda="Ejemplo: +56 9 1234 5678" autoComplete="tel" />
        </>
      )}
      {modo !== "perfil" && (
        <>
          <Campo nombre="empresa" etiqueta="Nombre de la empresa" error={e.empresa} valor={v.empresa} autoComplete="organization" />
          <Campo nombre="telefonoEmpresa" etiqueta="Teléfono de contacto de la empresa" error={e.telefonoEmpresa} valor={v.telefonoEmpresa} tipo="tel" />
        </>
      )}
      {modo !== "empresa" && (
        <label className="casilla">
          <input type="checkbox" name="terminos" value="si" defaultChecked={v.terminos === "si"} />
          <span>
            Acepto los <Link href="/legal/terminos" target="_blank">Términos y Condiciones</Link> y la{" "}
            <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link>.
          </span>
        </label>
      )}
      {e.aceptaTerminos && <p className="error">{e.aceptaTerminos}</p>}
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <button className="boton" disabled={enviando}>
        {enviando ? "Guardando…" : modo === "perfil" ? "Guardar mis datos" : "Crear la empresa"}
      </button>
    </form>
  );
}

function Campo(p: { nombre: string; etiqueta: string; error?: string | undefined; valor?: string | undefined; tipo?: string; ayuda?: string; autoComplete?: string }) {
  return (
    <label className="campo">
      {p.etiqueta}
      <input name={p.nombre} type={p.tipo ?? "text"} autoComplete={p.autoComplete} defaultValue={p.valor} aria-invalid={Boolean(p.error)} />
      {p.ayuda && !p.error && <small className="apagado">{p.ayuda}</small>}
      {p.error && <small className="error">{p.error}</small>}
    </label>
  );
}
