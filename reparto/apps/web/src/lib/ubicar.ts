import "server-only";
// Ubicar direcciones (SPEC 3.8): primero la memoria de la empresa, después el proveedor.
//   GEOCODER=simulado   pruebas y demostración sin internet
//   GEOCODER=google     Google Geocoding (necesita GOOGLE_GEOCODING_KEY; ~10.000 gratis al mes)
//   GEOCODER=nominatim  Nominatim (NOMINATIM_URL: el propio en el VPS; el público solo para poco volumen, 1 por segundo)
// Por omisión: Google si hay clave; si no, Nominatim.
// En entregas a empresas los locales se repiten: cada dirección se busca UNA vez y queda en la memoria.
import type { SupabaseClient } from "@supabase/supabase-js";
import { claveDireccion, consultaDe, leerGoogle, leerNominatim, ubicarSimulado, type DatosFila, type Ubicacion } from "@reparto/dominio";

export type UbicacionFila = { lat: number; lng: number; fuente: NonNullable<DatosFila["fuente"]>; segura: boolean };

export type Proveedor = "simulado" | "google" | "nominatim";

export function proveedor(): Proveedor {
  const p = process.env.GEOCODER;
  if (p === "simulado" || p === "google" || p === "nominatim") return p;
  return process.env.GOOGLE_GEOCODING_KEY ? "google" : "nominatim";
}

/** Cuántas direcciones se pueden buscar en un llamado sin pasar los límites del proveedor. */
export const porTanda = (p: Proveedor) => (p === "nominatim" ? 8 : 40);

let ultimoNominatim = 0;

async function preguntar(p: Proveedor, direccion: string, comuna: string): Promise<Ubicacion | null> {
  if (p === "simulado") return ubicarSimulado(direccion, comuna);
  const q = consultaDe(direccion, comuna);
  try {
    if (p === "google") {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=cl&language=es&key=${process.env.GOOGLE_GEOCODING_KEY}`;
      return leerGoogle(await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json());
    }
    // Nominatim público: máximo 1 consulta por segundo y con identificación (su política de uso).
    const espera = ultimoNominatim + 1100 - Date.now();
    if (espera > 0) await new Promise((listo) => setTimeout(listo, espera));
    ultimoNominatim = Date.now();
    const base = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
    const url = `${base}/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=1&countrycodes=cl`;
    const r = await fetch(url, {
      headers: { "User-Agent": `Reparto/0.1 (${process.env.CORREO_CONTACTO ?? "contacto@reparto.cl"})`, "Accept-Language": "es" },
      signal: AbortSignal.timeout(8000),
    });
    return leerNominatim(await r.json(), comuna);
  } catch {
    return null; // sin respuesta: queda por revisar, no se cae la carga
  }
}

/** Ubica una dirección usando primero la memoria de la empresa. Guarda en la memoria solo lo seguro. */
export async function ubicar(
  supabase: SupabaseClient,
  empresa: string,
  direccion: string,
  comuna: string,
): Promise<UbicacionFila | null> {
  const clave = claveDireccion(direccion, comuna);
  const { data: memoria } = await supabase.rpc("ubicacion_guardada", { empresa, clave_direccion: clave });
  const m = (memoria as { lat: number; lng: number }[] | null)?.[0];
  if (m) return { lat: m.lat, lng: m.lng, fuente: "cache", segura: true };

  const u = await preguntar(proveedor(), direccion, comuna);
  if (u?.segura) {
    await supabase.rpc("guardar_ubicacion", { empresa, clave_direccion: clave, direccion: `${direccion}, ${comuna}`, lat: u.lat, lng: u.lng, fuente: u.fuente });
  }
  return u;
}
