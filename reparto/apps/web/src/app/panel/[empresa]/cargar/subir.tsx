"use client";

// El archivo se lee aquí, en el navegador (Excel o CSV), y al servidor viaja solo la tabla de textos.
// Así el panel en Cloudflare queda liviano y la subida es más rápida.
import { useState } from "react";
import { celdaATexto, leerCsv } from "@reparto/dominio";
import { TOPE_ARCHIVO } from "@/lib/excel";
import { subirCarga } from "../acciones";

async function leer(archivo: File): Promise<string[][]> {
  if (/\.csv$/i.test(archivo.name)) return leerCsv((await archivo.text()).replace(/^﻿/, ""));
  if (!/\.xlsx$/i.test(archivo.name)) throw new Error("Sube un archivo Excel (.xlsx) o CSV.");
  const { readSheet } = await import("read-excel-file/browser");
  const datos = await readSheet(archivo);
  return datos.map((fila) => fila.map(celdaATexto)).filter((f) => f.some((c) => c !== ""));
}

export function SubirArchivo({ empresa }: { empresa: string }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    const archivo = new FormData(ev.currentTarget).get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) return setError("Elige un archivo Excel (.xlsx) o CSV.");
    if (archivo.size > TOPE_ARCHIVO) return setError("El archivo pesa más de 5 MB.");
    setEnviando(true);
    try {
      const filas = await leer(archivo);
      const r = await subirCarga(empresa, archivo.name, filas);  // si sale bien, el servidor redirige a la vista previa
      if (r?.error) setError(r.error);
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("Sube") ? e.message : "No pude leer el archivo. ¿Es un Excel válido?");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={(ev) => void enviar(ev)} className="formulario-linea">
      <label className="campo">Archivo<input type="file" name="archivo" accept=".xlsx,.csv" required /></label>
      <button className="boton" disabled={enviando}>{enviando ? "Leyendo…" : "Ver vista previa"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
