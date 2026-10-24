import "server-only";
import { readSheet } from "read-excel-file/node";
import { leerCsv } from "@reparto/dominio";

export const TOPE_ARCHIVO = 5 * 1024 * 1024;
export const TOPE_FILAS = 2000;

/** Convierte una celda de Excel a texto como la escribiría una persona (fechas dd-mm-aaaa, horas hh:mm). */
export function celdaATexto(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) {
    // Una hora sola en Excel llega como fecha del 30-12-1899.
    if (c.getUTCFullYear() < 1901) return `${String(c.getUTCHours()).padStart(2, "0")}:${String(c.getUTCMinutes()).padStart(2, "0")}`;
    return `${String(c.getUTCDate()).padStart(2, "0")}-${String(c.getUTCMonth() + 1).padStart(2, "0")}-${c.getUTCFullYear()}`;
  }
  if (typeof c === "number") return Number.isInteger(c) ? String(c) : String(c);
  if (typeof c === "boolean") return c ? "Sí" : "No";
  return String(c).trim();
}

/** Las filas del archivo como texto. Excel (.xlsx) o CSV. */
export async function leerArchivo(nombre: string, bytes: Buffer): Promise<string[][]> {
  if (/\.csv$/i.test(nombre)) return leerCsv(bytes.toString("utf8").replace(/^﻿/, ""));
  if (!/\.xlsx$/i.test(nombre)) throw new Error("Sube un archivo Excel (.xlsx) o CSV.");
  const datos = await readSheet(bytes);
  return datos.map((fila) => fila.map(celdaATexto)).filter((f) => f.some((c) => c !== ""));
}
