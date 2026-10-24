/** Hoy en Chile (aaaa-mm-dd), sin importar la zona horaria del servidor. */
export function hoyEnChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const esFechaIso = (t: unknown): t is string => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t);
