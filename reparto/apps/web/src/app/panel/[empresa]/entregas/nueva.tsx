"use client";

import { useActionState, useState } from "react";
import { crearEntrega, type Estado } from "../acciones";

type Cliente = { nombre: string; direccion: string; comuna: string };

export function NuevaEntrega(p: { empresa: string; fecha: string; conductores: { id: string; nombre: string; correo: string }[]; comunas: string[]; clientes: Cliente[] }) {
  const [estado, accion, enviando] = useActionState<Estado, FormData>(crearEntrega, {});
  const v = estado.valores ?? {};
  const [direccion, setDireccion] = useState(v.direccion ?? "");
  const [comuna, setComuna] = useState(v.comuna ?? "");
  const [cobrar, setCobrar] = useState(v.cobro === "si");

  return (
    <form action={accion} className="formulario-grilla">
      <input type="hidden" name="empresa" value={p.empresa} />
      <label className="campo">Cliente (local)
        <input name="cliente" list="clientes" required defaultValue={v.cliente} onChange={(e) => {
          const c = p.clientes.find((x) => x.nombre === e.target.value);
          if (c) { setDireccion(c.direccion); setComuna(c.comuna); }
        }} />
        <datalist id="clientes">{p.clientes.map((c) => <option key={c.nombre} value={c.nombre} />)}</datalist>
      </label>
      <label className="campo">Dirección<input name="direccion" required value={direccion} onChange={(e) => setDireccion(e.target.value)} /></label>
      <label className="campo">Comuna
        <select name="comuna" required value={comuna} onChange={(e) => setComuna(e.target.value)}>
          <option value="">Elige…</option>
          {p.comunas.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="campo">N° guía<input name="guia" required defaultValue={v.guia} /></label>
      <label className="campo">Bultos<input name="bultos" type="number" min={1} required defaultValue={v.bultos} /></label>
      <label className="campo">Orden de compra<input name="oc" defaultValue={v.oc} /></label>
      <label className="campo">Fecha<input name="fecha" type="date" required defaultValue={v.fecha ?? p.fecha} /></label>
      <label className="campo">Hora comprometida<input name="hora" type="time" defaultValue={v.hora} /></label>
      <label className="campo">Recepción desde<input name="desde" type="time" defaultValue={v.desde} /></label>
      <label className="campo">Recepción hasta<input name="hasta" type="time" defaultValue={v.hasta} /></label>
      <label className="campo">Contacto recepción<input name="contacto" defaultValue={v.contacto} /></label>
      <label className="campo">Teléfono contacto<input name="telefono" type="tel" defaultValue={v.telefono} /></label>
      <label className="campo">Conductor
        <select name="conductor" defaultValue={v.conductor ?? ""}>
          <option value="">Sin asignar</option>
          {p.conductores.map((c) => <option key={c.id} value={c.correo}>{c.nombre}</option>)}
        </select>
      </label>
      <label className="casilla"><input type="checkbox" name="cobro" value="si" checked={cobrar} onChange={(e) => setCobrar(e.target.checked)} /><span>Cobrar al entregar</span></label>
      {cobrar && (
        <>
          <label className="campo">Monto<input name="monto" inputMode="numeric" required defaultValue={v.monto} /></label>
          <label className="campo">Forma de pago
            <select name="forma" defaultValue={v.forma ?? "transferencia"}><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option></select>
          </label>
        </>
      )}
      <label className="campo ancho-completo">Notas<input name="notas" maxLength={500} defaultValue={v.notas} /></label>
      {estado.error && <p className="error ancho-completo" role="alert">{estado.error}</p>}
      <button className="boton" disabled={enviando}>{enviando ? "Guardando…" : "Crear entrega"}</button>
    </form>
  );
}
