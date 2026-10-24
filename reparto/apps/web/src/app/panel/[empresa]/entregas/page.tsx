// Entregas del día: asignar conductor, ver estado, sector y si falta la ubicación (SPEC 7, pantalla 3).
import Link from "next/link";
import { COMUNAS_RM } from "@reparto/dominio";
import { clienteServidor } from "@/lib/supabase/servidor";
import { esFechaIso, hoyEnChile } from "@/lib/fechas";
import { asignarConductor, cancelarEntrega } from "../acciones";
import { Estado, hhmm, SelectorDia, type EntregaDia } from "../componentes";
import { NuevaEntrega } from "./nueva";

type Props = { params: Promise<{ empresa: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Entregas({ params, searchParams }: Props) {
  const { empresa } = await params;
  const { fecha: f, aviso } = await searchParams;
  const fecha = esFechaIso(f) ? f : hoyEnChile();
  const supabase = await clienteServidor();
  const [{ data }, { data: miembros }, { data: clientes }] = await Promise.all([
    supabase.rpc("entregas_del_dia", { empresa, dia: fecha }),
    supabase.from("membresias").select("usuario_id, usuarios(nombre, correo)").eq("empresa_id", empresa).eq("rol", "conductor").eq("estado", "activo"),
    supabase.from("receptores").select("nombre, direccion, comuna").eq("empresa_id", empresa).order("nombre").limit(500),
  ]);
  const entregas = (data ?? []) as EntregaDia[];
  const conductores = (miembros ?? []).map((m) => ({ id: m.usuario_id as string, ...(m.usuarios as unknown as { nombre: string; correo: string }) }));
  const sinUbicar = entregas.filter((e) => e.lat === null && e.estado !== "cancelada").length;
  const sinAsignar = entregas.filter((e) => e.estado === "borrador").length;
  const bultos = entregas.filter((e) => e.estado !== "cancelada").reduce((s, e) => s + e.bultos, 0);

  return (
    <main className="contenedor ancho">
      <div className="titulo-con-acciones">
        <h1>Entregas</h1>
        <Link className="boton-secundario" href={`/panel/${empresa}/cargar`}>Cargar archivo</Link>
      </div>
      {typeof aviso === "string" && <p className="aviso" role="status">{aviso}</p>}
      <SelectorDia base={`/panel/${empresa}/entregas`} fecha={fecha} />

      <section className="cifras" aria-label="Resumen del día">
        <div><strong className="cifra">{entregas.length}</strong><span>entregas</span></div>
        <div><strong className="cifra">{bultos}</strong><span>bultos</span></div>
        <div><strong className="cifra">{sinAsignar}</strong><span>sin asignar</span></div>
        <div><strong className="cifra">{sinUbicar}</strong><span>sin ubicación</span></div>
      </section>
      {sinUbicar > 0 && (
        <p className="aviso">Hay {sinUbicar} entregas sin ubicación en el mapa. <Link href={`/panel/${empresa}/mapa?fecha=${fecha}`}>Márcalas en el mapa</Link>.</p>
      )}

      <section className="tarjeta">
        {entregas.length === 0 ? (
          <p className="apagado">No hay entregas este día.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla" aria-label="Entregas del día">
              <thead>
                <tr><th>Guía</th><th>Cliente</th><th>Comuna · sector</th><th>Bultos</th><th>Hora</th><th>Conductor</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {entregas.map((e) => (
                  <tr key={e.id}>
                    <td className="cifra">{e.guia}</td>
                    <td>{e.cliente}<br /><small className="apagado">{e.direccion}{e.lat === null ? " · sin ubicación" : ""}</small></td>
                    <td>{e.comuna}<br /><small className="apagado">{e.sector ?? "Sin sector"}</small></td>
                    <td className="cifra">{e.bultos}</td>
                    <td className="cifra">
                      {hhmm(e.hora_comprometida) || "—"}
                      {e.ventana_desde && <><br /><small className="apagado">recibe {hhmm(e.ventana_desde)}–{hhmm(e.ventana_hasta)}</small></>}
                    </td>
                    <td>
                      {e.estado === "borrador" || e.estado === "asignada" ? (
                        <form action={asignarConductor} className="asignar">
                          <input type="hidden" name="empresa" value={empresa} />
                          <input type="hidden" name="entrega" value={e.id} />
                          <input type="hidden" name="fecha" value={fecha} />
                          <select name="conductor" defaultValue={e.conductor_id ?? ""} aria-label={`Conductor de la guía ${e.guia}`}>
                            <option value="">Sin asignar</option>
                            {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                          <button className="boton-secundario">Asignar</button>
                        </form>
                      ) : (e.conductor ?? "—")}
                    </td>
                    <td><Estado estado={e.estado} /></td>
                    <td>
                      {["borrador", "asignada", "publicada"].includes(e.estado) && (
                        <form action={cancelarEntrega}>
                          <input type="hidden" name="empresa" value={empresa} />
                          <input type="hidden" name="entrega" value={e.id} />
                          <input type="hidden" name="fecha" value={fecha} />
                          <button className="enlace" aria-label={`Cancelar la guía ${e.guia}`}>Cancelar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="tarjeta">
        <summary><strong>Nueva entrega</strong></summary>
        <NuevaEntrega empresa={empresa} fecha={fecha} conductores={conductores} comunas={[...COMUNAS_RM]}
          clientes={(clientes ?? []) as { nombre: string; direccion: string; comuna: string }[]} />
      </details>
    </main>
  );
}
