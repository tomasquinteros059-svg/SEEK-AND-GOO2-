"use client";

import { useActionState } from "react";
import { guardarMensajeCliente, type Estado } from "../../acciones";

/** El mensaje que el agente propone para el cliente. El administrador lo revisa y lo corrige. */
export function MensajeCliente(p: { empresa: string; entrega: string; mensaje: string; urgente: boolean }) {
  const [estado, accion, enviando] = useActionState<Estado, FormData>(guardarMensajeCliente, {});
  return (
    <form action={accion} className="formulario-sector">
      <input type="hidden" name="empresa" value={p.empresa} />
      <input type="hidden" name="entrega" value={p.entrega} />
      <label className="campo">Mensaje para el cliente (propuesto por el agente)
        <textarea name="mensaje" rows={4} maxLength={1000} defaultValue={p.mensaje} />
      </label>
      <label className="casilla"><input type="checkbox" name="urgente" value="si" defaultChecked={p.urgente} /><span>Marcar como urgente</span></label>
      <p className="apagado"><small>El envío por WhatsApp al contacto del local llega con la fase de WhatsApp. Por ahora puedes corregirlo y copiarlo.</small></p>
      <div className="acciones">
        <button className="boton" disabled={enviando}>Guardar cambios</button>
      </div>
      {estado.ok && <p className="aviso" role="status">{estado.ok}</p>}
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
    </form>
  );
}
