import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { FormularioEmpezar } from "./formulario";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Empezar({ searchParams }: Props) {
  const { modo: pedido } = await searchParams;
  const supabase = await clienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: perfil } = await supabase.from("usuarios").select("id").eq("id", user.id).maybeSingle();

  // Con datos ya guardados solo se puede crear otra empresa.
  const modo = perfil ? "empresa" : pedido === "perfil" ? "perfil" : "completo";
  return (
    <main className="contenedor angosto">
      <FormularioEmpezar modo={modo} correo={user.email ?? ""} />
    </main>
  );
}
