// Quién está conectado y qué perfil eligió (conductor o receptor).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigurado } from "./supabase";

export type PerfilApp = "conductor" | "receptor";
export type Usuario = { id: string; nombre: string; telefono: string; correo: string };

type Contexto = {
  cargando: boolean;
  sesion: Session | null;
  usuario: Usuario | null;
  perfil: PerfilApp | null;
  elegirPerfil: (p: PerfilApp | null) => Promise<void>;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
};

const SesionContexto = createContext<Contexto | null>(null);
const CLAVE_PERFIL = "reparto.perfil";

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfil, setPerfil] = useState<PerfilApp | null>(null);

  const cargarUsuario = useCallback(async (s: Session | null) => {
    if (!s) return setUsuario(null);
    const { data } = await supabase.from("usuarios").select("id, nombre, telefono, correo").eq("id", s.user.id).maybeSingle();
    setUsuario((data as Usuario | null) ?? null);
  }, []);

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCargando(false);
      return;
    }
    let vivo = true;
    void (async () => {
      const guardado = await AsyncStorage.getItem(CLAVE_PERFIL).catch(() => null);
      if (guardado === "conductor" || guardado === "receptor") setPerfil(guardado);
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      setSesion(data.session);
      await cargarUsuario(data.session);
      setCargando(false);
    })();
    const { data: escucha } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s);
      void cargarUsuario(s);
    });
    return () => {
      vivo = false;
      escucha.subscription.unsubscribe();
    };
  }, [cargarUsuario]);

  const valor = useMemo<Contexto>(() => ({
    cargando,
    sesion,
    usuario,
    perfil,
    elegirPerfil: async (p) => {
      setPerfil(p);
      if (p) await AsyncStorage.setItem(CLAVE_PERFIL, p);
      else await AsyncStorage.removeItem(CLAVE_PERFIL);
    },
    recargar: () => cargarUsuario(sesion),
    salir: async () => {
      await supabase.auth.signOut();
      setUsuario(null);
    },
  }), [cargando, sesion, usuario, perfil, cargarUsuario]);

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export function useSesion(): Contexto {
  const c = useContext(SesionContexto);
  if (!c) throw new Error("useSesion fuera de ProveedorSesion");
  return c;
}
