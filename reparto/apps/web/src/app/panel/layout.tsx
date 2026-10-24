import Link from "next/link";
import { redirect } from "next/navigation";
import { nombreApp } from "@/lib/configuracion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { salir } from "./acciones";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");

  return (
    <>
      <nav className="barra">
        <Link href="/panel" className="marca-barra">{nombreApp}</Link>
        <span className="apagado-claro">{data.user.email}</span>
        <form action={salir}>
          <button className="boton-barra">Salir</button>
        </form>
      </nav>
      {children}
    </>
  );
}
