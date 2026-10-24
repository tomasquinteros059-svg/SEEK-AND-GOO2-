/** Datos públicos de conexión a Supabase. La clave "anon/publishable" es pública por diseño: la seguridad está en RLS. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseClave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigurado = Boolean(supabaseUrl && supabaseClave);
export const nombreApp = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Reparto";
