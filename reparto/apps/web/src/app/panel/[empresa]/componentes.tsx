// Piezas pequeñas compartidas por las páginas de la empresa.
import Link from "next/link";
import { fechaLarga, sumarDias } from "@/lib/fechas";

export const ESTADOS: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Sin asignar", clase: "pendiente" },
  asignada: { texto: "Asignada", clase: "neutra" },
  publicada: { texto: "Publicada", clase: "neutra" },
  en_camino: { texto: "En camino", clase: "neutra" },
  cerca: { texto: "Cerca", clase: "neutra" },
  en_destino: { texto: "En destino", clase: "neutra" },
  entregada: { texto: "Entregada", clase: "ok" },
  fallida: { texto: "No entregada", clase: "atraso" },
  cancelada: { texto: "Cancelada", clase: "atraso" },
};

export function Estado({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { texto: estado, clase: "neutra" };
  return <span className={`chip ${e.clase}`}>{e.texto}</span>;
}

export function SelectorDia({ base, fecha }: { base: string; fecha: string }) {
  return (
    <div className="selector-dia">
      <Link className="boton-secundario" href={`${base}?fecha=${sumarDias(fecha, -1)}`} aria-label="Día anterior">←</Link>
      <form method="get" className="formulario-linea">
        <label className="campo">Día<input type="date" name="fecha" defaultValue={fecha} /></label>
        <button className="boton-secundario">Ver</button>
      </form>
      <Link className="boton-secundario" href={`${base}?fecha=${sumarDias(fecha, 1)}`} aria-label="Día siguiente">→</Link>
      <span className="apagado">{fechaLarga(fecha)}</span>
    </div>
  );
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export type EntregaDia = {
  id: string; estado: string; guia: string; bultos: number; cliente: string; direccion: string; comuna: string;
  sector_id: string | null; sector: string | null; color: string | null; conductor_id: string | null; conductor: string | null;
  hora_comprometida: string | null; ventana_desde: string | null; ventana_hasta: string | null;
  lat: number | null; lng: number | null; receptor_id: string;
};
