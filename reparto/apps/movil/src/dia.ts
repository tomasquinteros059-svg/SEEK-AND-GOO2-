// Datos del día del conductor.
import { supabase } from "./supabase";

export type EntregaDelDia = {
  id: string; empresa_id: string; estado: string; guia: string; bultos: number; orden: number | null;
  hora_comprometida: string | null; ventana_desde: string | null; ventana_hasta: string | null; notas: string | null;
  direccion: string; comuna: string; receptor: { nombre: string; notas: string | null; lat: number | null; lng: number | null };
  pago: { tipo: string; monto: number | null; forma: string | null; estado: string } | null;
};

export function hoyEnChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

export async function entregasDeHoy(empresa: string, fecha = hoyEnChile()): Promise<EntregaDelDia[]> {
  const { data } = await supabase.rpc("mis_entregas_del_dia", { empresa, dia: fecha });
  return (data ?? []) as EntregaDelDia[];
}

export async function jornadaDeHoy(empresa: string, fecha = hoyEnChile()) {
  const { data } = await supabase.from("jornadas").select("id, estado, inicio, fin, resumen").eq("empresa_id", empresa).eq("fecha", fecha).maybeSingle();
  return data as { id: string; estado: "abierta" | "cerrada"; inicio: string; fin: string | null; resumen: Record<string, number> | null } | null;
}

export function enlacesDeNavegacion(e: EntregaDelDia): { waze: string; maps: string } {
  const destino = e.receptor.lat !== null && e.receptor.lng !== null ? `${e.receptor.lat},${e.receptor.lng}` : null;
  const texto = encodeURIComponent(`${e.direccion}, ${e.comuna}, Chile`);
  return {
    waze: destino ? `https://waze.com/ul?ll=${destino}&navigate=yes` : `https://waze.com/ul?q=${texto}&navigate=yes`,
    maps: `https://www.google.com/maps/dir/?api=1&destination=${destino ?? texto}`,
  };
}
