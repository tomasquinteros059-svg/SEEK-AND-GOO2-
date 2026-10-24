// Las 52 comunas de la Región Metropolitana, para armar sectores y revisar direcciones.
import { clave } from "./texto";

export const COMUNAS_RM = [
  "Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví", "El Bosque",
  "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida",
  "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul",
  "Maipú", "María Pinto", "Melipilla", "Ñuñoa", "Padre Hurtado", "Paine", "Pedro Aguirre Cerda", "Peñaflor",
  "Peñalolén", "Pirque", "Providencia", "Pudahuel", "Puente Alto", "Quilicura", "Quinta Normal", "Recoleta",
  "Renca", "San Bernardo", "San Joaquín", "San José de Maipo", "San Miguel", "San Pedro", "San Ramón", "Santiago",
  "Talagante", "Tiltil", "Vitacura",
] as const;

const PORCLAVE = new Map(COMUNAS_RM.map((c) => [clave(c), c]));
// Formas comunes de escribirlas.
const APODOS: Record<string, string> = {
  "stgo": "Santiago", "santiago centro": "Santiago", "est central": "Estación Central", "pac": "Pedro Aguirre Cerda",
  "til til": "Tiltil", "san jose de maipo": "San José de Maipo",
};

/** El nombre oficial de una comuna de la RM, o `null` si no se reconoce. */
export function comunaRM(texto: string): string | null {
  const k = clave(texto);
  if (!k) return null;
  return PORCLAVE.get(k) ?? APODOS[k] ?? null;
}
