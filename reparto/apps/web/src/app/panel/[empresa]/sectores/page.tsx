// Sectores: la división del territorio por comunas (SPEC 4.1). Se usan para repartir y en el mapa.
import { COMUNAS_RM } from "@reparto/dominio";
import { clienteServidor } from "@/lib/supabase/servidor";
import { borrarSector } from "../acciones";
import { FormularioSector } from "./formulario";

type Props = { params: Promise<{ empresa: string }> };
type Sector = { id: string; nombre: string; color: string; comunas: string[] };

// Colores bien distintos entre sí y visibles con el borde blanco del marcador.
const COLORES = ["#143b5c", "#c2410c", "#15803d", "#7c3aed", "#be123c", "#0e7490", "#a16207", "#4d7c0f"];

export default async function Sectores({ params }: Props) {
  const { empresa } = await params;
  const supabase = await clienteServidor();
  const { data } = await supabase.from("sectores").select("id, nombre, color, comunas").eq("empresa_id", empresa).order("nombre");
  const sectores = (data ?? []) as Sector[];
  // La base guarda las comunas normalizadas; se muestran con su nombre oficial.
  const oficial = new Map(COMUNAS_RM.map((c) => [c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), c]));
  const nombreDe = (c: string) => oficial.get(c) ?? c;
  const ocupadas = (excepto?: string) => sectores.filter((s) => s.id !== excepto).flatMap((s) => s.comunas.map(nombreDe));

  return (
    <main className="contenedor">
      <h1>Sectores</h1>
      <p className="apagado">Cada comuna pertenece a un solo sector. Las entregas y los clientes toman su sector según la comuna.</p>
      {sectores.map((s) => (
        <details key={s.id} className="tarjeta">
          <summary><span className="punto" style={{ background: s.color }} /> <strong>{s.nombre}</strong> · {s.comunas.map(nombreDe).join(", ")}</summary>
          <FormularioSector empresa={empresa} comunas={[...COMUNAS_RM]} ocupadas={ocupadas(s.id)}
            sector={{ ...s, comunas: s.comunas.map(nombreDe) }} />
          <form action={borrarSector}>
            <input type="hidden" name="empresa" value={empresa} />
            <input type="hidden" name="id" value={s.id} />
            <button className="enlace">Borrar sector</button>
          </form>
        </details>
      ))}
      <section className="tarjeta">
        <h2>Nuevo sector</h2>
        <FormularioSector empresa={empresa} comunas={[...COMUNAS_RM]} ocupadas={ocupadas()}
          colorSugerido={COLORES.find((c) => !sectores.some((s) => s.color.toLowerCase() === c)) ?? COLORES[sectores.length % COLORES.length]!} />
      </section>
    </main>
  );
}
