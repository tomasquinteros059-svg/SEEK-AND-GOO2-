// La ubicación en el momento de un evento (SPEC 2: hora y GPS automáticos).
// Solo "mientras se usa": el GPS en segundo plano es la Fase 4.
import * as Location from "expo-location";

export type Punto = { lat: number; lng: number; precision_m?: number };

export async function dondeEstoy(): Promise<Punto | null> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) return null;
    const p = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((listo) => setTimeout(() => listo(null), 5000)),
    ]);
    if (!p) return null;
    return { lat: p.coords.latitude, lng: p.coords.longitude, ...(p.coords.accuracy ? { precision_m: p.coords.accuracy } : {}) };
  } catch {
    return null;
  }
}
