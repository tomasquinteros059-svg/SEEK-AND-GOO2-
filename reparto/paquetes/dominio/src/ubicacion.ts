// Ubicar direcciones en el mapa (SPEC 3.8). Aquí solo lo que no sale a internet:
// armar la consulta y leer las respuestas de cada proveedor. Así se prueba sin red.
import { clave } from "./texto";

export type Ubicacion = { lat: number; lng: number; fuente: "nominatim" | "google" | "simulado"; segura: boolean };

/** Chile continental, para descartar resultados absurdos. */
export function enChile(lat: number, lng: number): boolean {
  return lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66;
}

export function consultaDe(direccion: string, comuna: string): string {
  return [direccion.trim(), comuna.trim(), "Región Metropolitana", "Chile"].filter(Boolean).join(", ");
}

/** Clave de la memoria de direcciones: igual que en `fijar_ubicacion()` de la base. */
export function claveDireccion(direccion: string, comuna: string): string {
  return clave(`${direccion}, ${comuna}`);
}

type ResultadoNominatim = {
  lat?: string;
  lon?: string;
  addresstype?: string;
  address?: Record<string, string | undefined>;
};

/**
 * Lee la respuesta de Nominatim (`format=jsonv2&addressdetails=1`).
 * Es "segura" solo si encontró el número de la calle y la comuna coincide; si no, queda por revisar.
 */
export function leerNominatim(respuesta: unknown, comuna: string): Ubicacion | null {
  const r = (Array.isArray(respuesta) ? respuesta[0] : null) as ResultadoNominatim | null;
  if (!r?.lat || !r.lon) return null;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !enChile(lat, lng)) return null;
  const a = r.address ?? {};
  const conNumero = Boolean(a.house_number) || r.addresstype === "building";
  const lugares = [a.city, a.town, a.suburb, a.city_district, a.municipality, a.village].filter(Boolean).map((x) => clave(x!));
  const mismaComuna = !comuna.trim() || lugares.includes(clave(comuna));
  return { lat, lng, fuente: "nominatim", segura: conNumero && mismaComuna };
}

type ResultadoGoogle = {
  status?: string;
  results?: { partial_match?: boolean; geometry?: { location?: { lat: number; lng: number }; location_type?: string } }[];
};

/** Lee la respuesta de Google Geocoding. Segura si es la dirección exacta (ROOFTOP o interpolada) y sin coincidencia parcial. */
export function leerGoogle(respuesta: unknown): Ubicacion | null {
  const r = respuesta as ResultadoGoogle | null;
  if (r?.status !== "OK") return null;
  const primero = r.results?.[0];
  const loc = primero?.geometry?.location;
  if (!loc || !enChile(loc.lat, loc.lng)) return null;
  const tipo = primero.geometry?.location_type ?? "";
  return { lat: loc.lat, lng: loc.lng, fuente: "google", segura: !primero.partial_match && (tipo === "ROOFTOP" || tipo === "RANGE_INTERPOLATED") };
}

/**
 * Proveedor simulado para pruebas y para la demostración sin internet: un punto fijo
 * por dirección (siempre el mismo), cerca del centro de Santiago. Las direcciones que
 * contienen "sin numero" no se encuentran, para probar el caso "por revisar".
 */
export function ubicarSimulado(direccion: string, comuna: string): Ubicacion | null {
  const k = claveDireccion(direccion, comuna);
  if (k.includes("sin numero")) return null;
  let h = 2166136261;
  for (const ch of k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = ((h >>> 0) % 10000) / 10000;
  const b = (((h >>> 0) / 10000) % 10000) / 10000;
  return { lat: -33.45 - 0.15 + a * 0.3, lng: -70.65 - 0.15 + b * 0.3, fuente: "simulado", segura: true };
}
