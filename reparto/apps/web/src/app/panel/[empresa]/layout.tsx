// Secciones de una empresa. Solo para sus administradores.
import { notFound, redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Pestanas } from "./pestanas";

export default async function LayoutEmpresa({ children, params }: { children: React.ReactNode; params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await clienteServidor();
  const [{ data: empresa }, { data: soyAdmin }] = await Promise.all([
    supabase.from("empresas").select("nombre").eq("id", id).maybeSingle(),
    supabase.rpc("es_admin", { empresa: id }),
  ]);
  if (!empresa) notFound();
  if (!soyAdmin) redirect("/panel?aviso=Solo%20los%20administradores%20entran%20a%20esta%20empresa.");
  return (
    <>
      <div className="subbarra">
        <strong className="nombre-empresa">{empresa.nombre}</strong>
        <Pestanas empresa={id} />
      </div>
      {children}
    </>
  );
}
