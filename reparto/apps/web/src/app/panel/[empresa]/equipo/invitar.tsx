"use client";

import { useActionState } from "react";
import { invitar, type Estado } from "../../acciones";

export function FormularioInvitar({ empresa }: { empresa: string }) {
  const [estado, accion, enviando] = useActionState<Estado, FormData>(invitar, {});
  return (
    <form action={accion} className="formulario-linea">
      <input type="hidden" name="empresa" value={empresa} />
      <label className="campo">
        Correo
        <input name="correo" type="email" inputMode="email" defaultValue={estado.valores?.correo} required />
      </label>
      <label className="campo">
        Como
        <select name="rol" defaultValue={estado.valores?.rol ?? "conductor"}>
          <option value="conductor">Conductor</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <button className="boton" disabled={enviando}>{enviando ? "Invitando…" : "Invitar"}</button>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso" role="status">{estado.ok}</p>}
    </form>
  );
}
