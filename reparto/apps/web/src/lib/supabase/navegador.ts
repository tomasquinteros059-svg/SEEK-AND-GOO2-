"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseClave, supabaseUrl } from "../configuracion";

export function clienteNavegador() {
  return createBrowserClient(supabaseUrl, supabaseClave);
}
