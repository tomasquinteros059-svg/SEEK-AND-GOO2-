import { notFound } from "next/navigation";
import type { FilaRevisada } from "@reparto/dominio";
import { clienteServidor } from "@/lib/supabase/servidor";
import { VistaPrevia } from "./vista-previa";

type Props = { params: Promise<{ empresa: string; carga: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Carga({ params, searchParams }: Props) {
  const { empresa, carga } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(carga)) notFound();
  const supabase = await clienteServidor();
  const { data } = await supabase.from("cargas").select("archivo, estado, filas, creada_en").eq("id", carga).eq("empresa_id", empresa).maybeSingle();
  if (!data) notFound();
  return (
    <main className="contenedor ancho">
      <h1>Vista previa · {data.archivo}</h1>
      {typeof aviso === "string" && <p className="aviso" role="alert">{aviso}</p>}
      {data.estado !== "vista_previa" ? (
        <p className="aviso">Esta carga ya está {data.estado === "creada" ? "creada" : "descartada"}.</p>
      ) : (
        <VistaPrevia empresa={empresa} carga={carga} filasIniciales={data.filas as (FilaRevisada & { intentada?: boolean })[]} />
      )}
    </main>
  );
}
