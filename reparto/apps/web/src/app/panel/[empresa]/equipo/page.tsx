// Equipo de una empresa: administradores, conductores, invitaciones y revisión de licencias (SPEC 7, pantalla 2).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatearTelefono } from "@reparto/dominio";
import { clienteServidor } from "@/lib/supabase/servidor";
import { anularInvitacion, cambiarEstadoMiembro, revisarDocumento } from "../../acciones";
import { FormularioInvitar } from "./invitar";

type Props = {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Persona = { nombre: string; telefono: string; correo: string };
type Revision = { empresa_id: string; estado: string; nota: string | null };

const TIPO_DOC: Record<string, string> = { licencia: "Licencia de conducir", camion: "Documento del camión" };
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

export default async function Equipo({ params, searchParams }: Props) {
  const { empresa: id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await clienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: empresa } = await supabase.from("empresas").select("id, nombre, telefono_contacto").eq("id", id).maybeSingle();
  if (!empresa) notFound();
  const { data: soyAdmin } = await supabase.rpc("es_admin", { empresa: id });
  if (!soyAdmin) redirect("/panel?aviso=Solo%20los%20administradores%20ven%20el%20equipo.");

  const [{ data: miembros }, { data: invitaciones }, { data: documentos }] = await Promise.all([
    supabase.from("membresias").select("usuario_id, rol, estado, desde, usuarios(nombre, telefono, correo)").eq("empresa_id", id).order("rol"),
    supabase.from("invitaciones").select("id, correo, rol, creada_en, expira_en").eq("empresa_id", id).eq("estado", "pendiente").order("creada_en", { ascending: false }),
    supabase.from("documentos_conductor").select("id, usuario_id, tipo, ruta, vence, subido_en, revisiones_documento(empresa_id, estado, nota)").order("subido_en", { ascending: false }),
  ]);

  const lista = (miembros ?? []).map((m) => ({ ...m, persona: m.usuarios as unknown as Persona }));
  const conductores = new Map(lista.filter((m) => m.rol === "conductor").map((m) => [m.usuario_id, m.persona.nombre]));
  const docs = (documentos ?? []).filter((d) => conductores.has(d.usuario_id));
  const { data: firmados } = docs.length
    ? await supabase.storage.from("documentos").createSignedUrls(docs.map((d) => d.ruta), 300)
    : { data: [] };
  const enlace = new Map((firmados ?? []).map((f) => [f.path, f.signedUrl]));

  return (
    <main className="contenedor">
      <p><Link href="/panel">← Mis empresas</Link></p>
      <h1>{empresa.nombre} · Equipo</h1>
      {typeof aviso === "string" && <p className="aviso" role="status">{aviso}</p>}

      <section className="tarjeta">
        <h2>Invitar</h2>
        <p className="apagado">La persona entra con ese correo (app para conductores, panel para administradores) y acepta la invitación.</p>
        <FormularioInvitar empresa={id} />
        {(invitaciones ?? []).length > 0 && (
          <>
            <h3>Pendientes</h3>
            {(invitaciones ?? []).map((i) => (
              <form key={i.id} action={anularInvitacion} className="fila-lista">
                <input type="hidden" name="empresa" value={id} />
                <input type="hidden" name="id" value={i.id} />
                <span>{i.correo} · {i.rol === "admin" ? "administrador" : "conductor"} · vence {fecha(i.expira_en)}</span>
                <button className="boton-secundario">Anular</button>
              </form>
            ))}
          </>
        )}
      </section>

      <section className="tarjeta">
        <h2>Personas</h2>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Rol</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.usuario_id}>
                  <td>{m.persona.nombre}{m.usuario_id === user.id ? " (tú)" : ""}</td>
                  <td>{m.rol === "admin" ? "Administrador" : "Conductor"}</td>
                  <td className="cifra">{formatearTelefono(m.persona.telefono)}</td>
                  <td>{m.persona.correo}</td>
                  <td><span className={`chip ${m.estado === "activo" ? "ok" : "atraso"}`}>{m.estado === "activo" ? "Activo" : "Suspendido"}</span></td>
                  <td>
                    <form action={cambiarEstadoMiembro}>
                      <input type="hidden" name="empresa" value={id} />
                      <input type="hidden" name="usuario" value={m.usuario_id} />
                      <input type="hidden" name="estado" value={m.estado === "activo" ? "suspendido" : "activo"} />
                      <button className="boton-secundario">{m.estado === "activo" ? "Suspender" : "Reactivar"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Licencias y documentos</h2>
        {docs.length === 0 && <p className="apagado">Tus conductores todavía no suben documentos.</p>}
        {docs.map((d) => {
          const mia = (d.revisiones_documento as unknown as Revision[]).find((r) => r.empresa_id === id);
          const url = enlace.get(d.ruta);
          return (
            <article key={d.id} className="documento">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- enlace firmado que vence en 5 minutos
                <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${TIPO_DOC[d.tipo]} de ${conductores.get(d.usuario_id)}`} /></a>
              ) : <div className="sin-foto">Sin vista previa</div>}
              <div>
                <strong>{conductores.get(d.usuario_id)}</strong>
                <p className="apagado">{TIPO_DOC[d.tipo]} · subida {fecha(d.subido_en)}{d.vence ? ` · vence ${fecha(d.vence)}` : ""}</p>
                <p>
                  <span className={`chip ${mia?.estado === "aprobado" ? "ok" : mia?.estado === "rechazado" ? "atraso" : "pendiente"}`}>
                    {mia?.estado === "aprobado" ? "Aprobado" : mia?.estado === "rechazado" ? "Rechazado" : "Por revisar"}
                  </span>
                  {mia?.nota && <span className="apagado"> {mia.nota}</span>}
                </p>
                <form action={revisarDocumento} className="formulario-linea">
                  <input type="hidden" name="empresa" value={id} />
                  <input type="hidden" name="documento" value={d.id} />
                  <label className="campo">Nota (opcional)<input name="nota" maxLength={500} /></label>
                  <button className="boton" name="estado" value="aprobado">Aprobar</button>
                  <button className="boton-secundario" name="estado" value="rechazado">Rechazar</button>
                </form>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
