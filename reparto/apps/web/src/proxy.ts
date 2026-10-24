// Renueva la sesión en cada visita y protege /panel: sin sesión, se va a /entrar.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseClave, supabaseConfigurado, supabaseUrl } from "./lib/configuracion";

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  if (!supabaseConfigurado) return respuesta;

  const supabase = createServerClient(supabaseUrl, supabaseClave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (porGuardar, cabeceras) => {
        for (const { name, value } of porGuardar) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of porGuardar) respuesta.cookies.set(name, value, options);
        for (const [clave, valor] of Object.entries(cabeceras)) respuesta.headers.set(clave, valor);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && request.nextUrl.pathname.startsWith("/panel")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|legal).*)"],
};
