// Estados de una entrega y qué estado puede seguir a cuál (SPEC, sección 2).
//
// Es una función pura: la usan la app, el panel y el servidor, así que las
// tres partes dicen lo mismo sobre qué cambio es válido.

export const ESTADOS_ENTREGA = [
  "borrador",
  "asignada",
  "publicada",
  "en_camino",
  "cerca",
  "en_destino",
  "entregada",
  "fallida",
  "cancelada",
] as const;

export type EstadoEntrega = (typeof ESTADOS_ENTREGA)[number];

/** Estados de los que ya no se sale. */
export const ESTADOS_FINALES: readonly EstadoEntrega[] = ["entregada", "fallida", "cancelada"];

const SIGUIENTES: Record<EstadoEntrega, readonly EstadoEntrega[]> = {
  borrador: ["asignada", "cancelada"],
  asignada: ["publicada", "borrador", "cancelada"],
  publicada: ["en_camino", "en_destino", "entregada", "fallida", "cancelada"],
  // "cerca" y "en_destino" los pone el sistema por ETA y distancia, pero el
  // conductor puede tocar "Llegué" o entregar antes de que el GPS lo note.
  en_camino: ["cerca", "en_destino", "entregada", "fallida", "cancelada"],
  cerca: ["en_destino", "entregada", "fallida", "cancelada"],
  en_destino: ["entregada", "fallida", "cancelada"],
  entregada: [],
  fallida: [],
  cancelada: [],
};

export function esEstado(valor: unknown): valor is EstadoEntrega {
  return typeof valor === "string" && (ESTADOS_ENTREGA as readonly string[]).includes(valor);
}

export function esFinal(estado: EstadoEntrega): boolean {
  return ESTADOS_FINALES.includes(estado);
}

/** Si una entrega puede pasar de `de` a `a`. */
export function puedePasar(de: EstadoEntrega, a: EstadoEntrega): boolean {
  return SIGUIENTES[de].includes(a);
}

/** Los estados a los que se puede pasar desde `de`. */
export function siguientes(de: EstadoEntrega): readonly EstadoEntrega[] {
  return SIGUIENTES[de];
}
