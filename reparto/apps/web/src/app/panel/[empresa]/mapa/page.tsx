// Mapa de las entregas del día por sector, y marcar a mano las que no se encontraron.
import { clienteServidor } from "@/lib/supabase/servidor";
import { esFechaIso, hoyEnChile } from "@/lib/fechas";
import { SelectorDia, type EntregaDia } from "../componentes";
import { Mapa } from "./mapa";

type Props = { params: Promise<{ empresa: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaMapa({ params, searchParams }: Props) {
  const { empresa } = await params;
  const { fecha: f } = await searchParams;
  const fecha = esFechaIso(f) ? f : hoyEnChile();
  const supabase = await clienteServidor();
  const [{ data }, { data: sectores }] = await Promise.all([
    supabase.rpc("entregas_del_dia", { empresa, dia: fecha }),
    supabase.from("sectores").select("id, nombre, color").eq("empresa_id", empresa).order("nombre"),
  ]);
  const entregas = ((data ?? []) as EntregaDia[]).filter((e) => e.estado !== "cancelada");
  return (
    <main className="contenedor ancho">
      <h1>Mapa</h1>
      <SelectorDia base={`/panel/${empresa}/mapa`} fecha={fecha} />
      <Mapa empresa={empresa} entregas={entregas} sectores={(sectores ?? []) as { id: string; nombre: string; color: string }[]}
        estilo={process.env.NEXT_PUBLIC_MAPA_ESTILO ?? "https://tiles.openfreemap.org/styles/liberty"} />
    </main>
  );
}
