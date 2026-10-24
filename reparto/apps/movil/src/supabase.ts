// Cliente de Supabase para la app. La sesión se guarda en el teléfono y se renueva sola mientras la app está abierta.
import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigurado = Boolean(url && clave);

export const supabase = createClient(url || "http://sin-configurar.invalid", clave || "sin-configurar", {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

AppState.addEventListener("change", (estado) => {
  if (estado === "active") void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});

/** Dirección del panel web (para abrir los textos legales). */
export const urlPanel = process.env.EXPO_PUBLIC_URL_PANEL ?? "";
