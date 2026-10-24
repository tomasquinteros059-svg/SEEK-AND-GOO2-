// Inicio del panel: mis empresas, mis invitaciones pendientes, o empezar.
import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { responderInvitacion } from "./acciones";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function InicioPanel({ searchParams }: Props) {
  const { aviso } = await searchParams;
  const supabase = await clienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [{ data: perfil }, { data: invitaciones }, { data: membresias }] = await Promise.all([
    supabase.from("usuarios").select("nombre").eq("id", user.id).maybeSingle(),
    supabase.rpc("mis_invitaciones"),
    supabase.from("membresias").select("rol, estado, empresa_id, empresas(nombre)").eq("usuario_id", user.id),
  ]);

  const pendientes = (invitaciones ?? []) as { id: string; empresa: string; rol: string }[];
  if (!perfil) redirect(pendientes.length > 0 ? "/panel/empezar?modo=perfil" : "/panel/empezar?modo=completo");

  const administradas = (membresias ?? []).filter((m) => m.rol === "admin" && m.estado === "activo");

  return (
    <main className="contenedor">
      <h1>Hola, {perfil.nombre.split(" ")[0]}</h1>
      {typeof aviso === "string" && <p className="aviso" role="status">{aviso}</p>}

      {pendientes.length > 0 && (
        <section className="tarjeta">
          <h2>Te invitaron</h2>
          {pendientes.map((i) => (
            <form key={i.id} action={responderInvitacion} className="fila-lista">
              <input type="hidden" name="id" value={i.id} />
              <span><strong>{i.empresa}</strong> · como {i.rol === "admin" ? "administrador" : "conductor"}</span>
              <span className="acciones">
                <button className="boton" name="respuesta" value="aceptar">Aceptar</button>
                <button className="boton-secundario" name="respuesta" value="rechazar">Rechazar</button>
              </span>
            </form>
          ))}
        </section>
      )}

      <section className="tarjeta">
        <h2>Mis empresas</h2>
        {administradas.length === 0 ? (
          <p className="apagado">Todavía no administras ninguna empresa.</p>
        ) : (
          <ul className="lista">
            {administradas.map((m) => (
              <li key={m.empresa_id}>
                <Link href={`/panel/${m.empresa_id}/equipo`}>
                  {(m.empresas as unknown as { nombre: string } | null)?.nombre ?? "Empresa"}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link className="boton-secundario" href="/panel/empezar?modo=empresa">Crear otra empresa</Link>
      </section>
    </main>
  );
}
