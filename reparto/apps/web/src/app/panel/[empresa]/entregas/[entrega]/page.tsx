// Detalle de una entrega: lo que pasó (con hora real y ubicación), las fotos, el mensaje del conductor,
// lo que concluyó el Agente de Entregas y el mensaje propuesto para el cliente.
import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { EnVivo } from "../../en-vivo";
import { Estado, hhmm } from "../../componentes";
import { MensajeCliente } from "./mensaje-cliente";

type Props = { params: Promise<{ empresa: string; entrega: string }> };

const TIPO: Record<string, string> = {
  en_camino: "Salió hacia el local", llegue: "Llegó", entregada: "Entregó", no_entregada: "No entregó", foto_agregada: "Agregó una foto",
};
const CLASE: Record<string, string> = { entregada: "Entregada", fallida: "No entregada", incidencia: "Entregada con incidencia" };
const hora = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", hour12: false }).format(new Date(iso));

export default async function DetalleEntrega({ params }: Props) {
  const { empresa, entrega: id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await clienteServidor();
  const { data: e } = await supabase.from("entregas")
    .select("id, estado, guia, orden_compra, bultos, fecha, hora_comprometida, ventana_desde, ventana_hasta, direccion, comuna, notas, receptores(nombre), usuarios!entregas_conductor_id_fkey(nombre), pagos(tipo, monto, forma, estado)")
    .eq("id", id).eq("empresa_id", empresa).maybeSingle();
  if (!e) notFound();
  const [{ data: eventos }, { data: adjuntos }, { data: clas }] = await Promise.all([
    supabase.from("eventos_entrega").select("id, tipo, ocurrido_en, recibido_en, sin_senal, mensaje, motivo, lat, lng, precision_m").eq("entrega_id", id).order("ocurrido_en"),
    supabase.from("adjuntos").select("id, tipo, ruta, creado_en").eq("entrega_id", id).order("creado_en"),
    supabase.from("clasificaciones_entrega").select("clase, foto_ok, motivo_foto, resumen, urgente, revisar, mensaje_cliente, modelo, actualizada_en").eq("entrega_id", id).maybeSingle(),
  ]);
  const { data: firmadas } = (adjuntos ?? []).length
    ? await supabase.storage.from("entregas").createSignedUrls((adjuntos ?? []).map((a) => a.ruta), 300)
    : { data: [] };
  const url = new Map((firmadas ?? []).filter((f) => f.signedUrl).map((f) => [f.path, f.signedUrl as string]));
  const cliente = (e.receptores as unknown as { nombre: string }).nombre;
  const conductor = (e.usuarios as unknown as { nombre: string } | null)?.nombre;
  const pago = (Array.isArray(e.pagos) ? e.pagos[0] : e.pagos) as { tipo: string; monto: number | null; forma: string | null; estado: string } | null;

  return (
    <main className="contenedor">
      <p><Link href={`/panel/${empresa}/entregas?fecha=${e.fecha}`}>← Entregas del día</Link></p>
      <div className="titulo-con-acciones">
        <h1>{cliente} · guía <span className="cifra">{e.guia}</span></h1>
        <EnVivo empresa={empresa} />
      </div>
      <section className="tarjeta">
        <p><Estado estado={e.estado} /> {clas?.urgente && <span className="chip atraso">Urgente</span>}</p>
        <p>{e.direccion}, {e.comuna} · {e.bultos} bultos{e.orden_compra ? ` · OC ${e.orden_compra}` : ""}</p>
        <p className="apagado">
          {conductor ? `Conductor: ${conductor}` : "Sin conductor"}
          {e.hora_comprometida ? ` · comprometida ${hhmm(e.hora_comprometida)}` : ""}
          {e.ventana_desde ? ` · recibe ${hhmm(e.ventana_desde)}–${hhmm(e.ventana_hasta)}` : ""}
          {pago?.tipo === "cobrar" ? ` · cobro $${Number(pago.monto).toLocaleString("es-CL")} (${pago.estado === "confirmado" ? `recibido, ${pago.forma}` : "pendiente"})` : ""}
        </p>
      </section>

      {clas && (
        <section className={`tarjeta ${clas.urgente ? "borde-urgente" : ""}`} aria-label="Agente de Entregas">
          <h2>Agente de Entregas</h2>
          <p><strong>{CLASE[clas.clase ?? ""] ?? "Sin clasificar"}</strong>{clas.revisar ? " · no calza con lo que marcó el conductor: revísala" : ""}</p>
          <p>{clas.resumen}</p>
          {clas.foto_ok === false && <p className="aviso">La foto no sirve como comprobante: {clas.motivo_foto}</p>}
          <p className="apagado"><small>{clas.modelo === "simulado" ? "Modo simulado (sin IA)" : `Revisado por ${clas.modelo}`} · {hora(clas.actualizada_en)}</small></p>
          <MensajeCliente empresa={empresa} entrega={id} mensaje={clas.mensaje_cliente ?? ""} urgente={clas.urgente} />
        </section>
      )}

      <section className="tarjeta">
        <h2>Lo que pasó</h2>
        {(eventos ?? []).length === 0 ? <p className="apagado">Todavía nada.</p> : (
          <ol className="linea-tiempo">
            {(eventos ?? []).map((ev) => (
              <li key={ev.id}>
                <strong className="cifra">{hora(ev.ocurrido_en)}</strong> · {TIPO[ev.tipo] ?? ev.tipo}
                {ev.sin_senal && <span className="chip pendiente">registrado sin señal</span>}
                {ev.motivo && <> · <strong>{ev.motivo}</strong></>}
                {ev.mensaje && <blockquote className="mensaje-conductor">{ev.mensaje}</blockquote>}
                {ev.lat !== null && ev.lng !== null && (
                  <small><a href={`https://www.google.com/maps?q=${ev.lat},${ev.lng}`} target="_blank" rel="noreferrer">Ver ubicación</a>{ev.precision_m ? ` (±${Math.round(ev.precision_m)} m)` : ""}</small>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="tarjeta">
        <h2>Fotos</h2>
        {(adjuntos ?? []).length === 0 ? <p className="apagado">Sin fotos.</p> : (
          <div className="galeria">
            {(adjuntos ?? []).map((a) => url.get(a.ruta) ? (
              <a key={a.id} href={url.get(a.ruta)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- enlace firmado que vence en 5 minutos */}
                <img src={url.get(a.ruta)} alt={`Foto ${a.tipo === "guia" ? "de la guía" : "de la entrega"} · ${hora(a.creado_en)}`} />
              </a>
            ) : null)}
          </div>
        )}
      </section>
    </main>
  );
}
