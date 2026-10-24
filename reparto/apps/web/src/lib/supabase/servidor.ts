import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseClave, supabaseUrl } from "../configuracion";

/** Cliente de Supabase con la sesión de quien navega. Uno nuevo por cada pedido. */
export async function clienteServidor() {
  const almacen = await cookies();
  return createServerClient(supabaseUrl, supabaseClave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (porGuardar) => {
        try {
          for (const { name, value, options } of porGuardar) almacen.set(name, value, options);
        } catch {
          // Desde una página (no una acción) no se pueden escribir cookies: lo hace proxy.ts.
        }
      },
    },
  });
}
