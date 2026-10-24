"use client";

import { useActionState } from "react";
import { guardarSector, type Estado } from "../acciones";

export function FormularioSector(p: {
  empresa: string; comunas: string[]; ocupadas: string[]; colorSugerido?: string;
  sector?: { id: string; nombre: string; color: string; comunas: string[] };
}) {
  const [estado, accion, enviando] = useActionState<Estado, FormData>(guardarSector, {});
  return (
    <form action={accion} className="formulario-sector">
      <input type="hidden" name="empresa" value={p.empresa} />
      {p.sector && <input type="hidden" name="id" value={p.sector.id} />}
      <div className="formulario-linea">
        <label className="campo">Nombre<input name="nombre" required defaultValue={p.sector?.nombre} maxLength={60} /></label>
        <label className="campo">Color<input name="color" type="color" defaultValue={p.sector?.color ?? p.colorSugerido ?? "#143b5c"} /></label>
      </div>
      <fieldset className="comunas">
        <legend>Comunas</legend>
        {p.comunas.map((c) => {
          const ocupada = p.ocupadas.includes(c);
          return (
            <label key={c} className={ocupada ? "apagado" : undefined}>
              <input type="checkbox" name="comunas" value={c} defaultChecked={p.sector?.comunas.includes(c)} disabled={ocupada} />
              {c}{ocupada ? " (en otro sector)" : ""}
            </label>
          );
        })}
      </fieldset>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso" role="status">{estado.ok}</p>}
      <button className="boton" disabled={enviando}>{p.sector ? "Guardar cambios" : "Crear sector"}</button>
    </form>
  );
}
