"use client";

import { useActionState } from "react";
import { subirCarga, type Estado } from "../acciones";

export function SubirArchivo({ empresa }: { empresa: string }) {
  const [estado, accion, enviando] = useActionState<Estado, FormData>(subirCarga, {});
  return (
    <form action={accion} className="formulario-linea">
      <input type="hidden" name="empresa" value={empresa} />
      <label className="campo">Archivo<input type="file" name="archivo" accept=".xlsx,.csv" required /></label>
      <button className="boton" disabled={enviando}>{enviando ? "Leyendo…" : "Ver vista previa"}</button>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
    </form>
  );
}
