import type { Metadata } from "next";
import { nombreApp, supabaseConfigurado } from "@/lib/configuracion";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: `Entrar · ${nombreApp}` };

export default function Entrar() {
  return (
    <main className="contenedor angosto">
      <header className="cabecera">
        <h1>{nombreApp}</h1>
        <p style={{ margin: 0 }}>Panel del administrador</p>
      </header>
      {supabaseConfigurado ? (
        <FormularioEntrar />
      ) : (
        <p className="aviso">Falta configurar la base de datos (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>
      )}
    </main>
  );
}
