// Decide a qué pantalla ir según la sesión, el perfil elegido y si ya completó sus datos.
import { Redirect } from "expo-router";
import { useSesion } from "../src/sesion";
import { supabaseConfigurado } from "../src/supabase";
import { Aviso, Cargando, Pantalla, Texto, Titulo } from "../src/ui";

export default function Inicio() {
  const { cargando, sesion, usuario, perfil } = useSesion();
  if (!supabaseConfigurado) {
    return (
      <Pantalla>
        <Titulo>Falta configurar</Titulo>
        <Aviso>Esta versión no tiene la dirección de la base de datos.</Aviso>
        <Texto apagado>Se configura con EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (ver docs/fase-1.md).</Texto>
      </Pantalla>
    );
  }
  if (cargando) return <Cargando />;
  if (!sesion) return <Redirect href="/entrar" />;
  if (!usuario || !perfil) return <Redirect href="/registro" />;
  return <Redirect href="/principal" />;
}
