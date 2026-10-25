"use client";

// Tiempo real (SPEC 3.4): cuando cambia una entrega, llega un evento o el agente clasifica,
// la página se actualiza sola. Las reglas de acceso (RLS) deciden qué cambios recibe cada uno.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";

export function EnVivo({ empresa }: { empresa: string }) {
  const router = useRouter();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const supabase = clienteNavegador();
    const refrescar = () => {
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => router.refresh(), 600);
    };
    const canal = supabase.channel(`empresa-${empresa}`);
    for (const tabla of ["entregas", "eventos_entrega", "clasificaciones_entrega"]) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabla, filter: `empresa_id=eq.${empresa}` }, refrescar);
    }
    canal.subscribe((estado) => setConectado(estado === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(canal); if (espera.current) clearTimeout(espera.current); };
  }, [empresa, router]);

  return <span className={`en-vivo ${conectado ? "si" : ""}`} data-conectado={conectado}>{conectado ? "En vivo" : "Conectando…"}</span>;
}
