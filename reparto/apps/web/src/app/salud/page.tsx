// Fase 0 · página de prueba del panel del administrador.
import { siguientes } from "@reparto/dominio";
import { PruebaDeErrores } from "./prueba-de-errores";

const nombre = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Reparto";
const sentryActivo = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function Salud() {
  const pasos = siguientes("en_camino").join(", ").replaceAll("_", " ");
  return (
    <main className="contenedor">
      <header className="cabecera">
        <h1>{nombre} · Panel</h1>
        <p style={{ margin: 0 }}>Estado de los servicios</p>
      </header>

      <section className="tarjetas">
        <article className="tarjeta">
          <h2>El panel abre en tu computador</h2>
          <p className="apagado">Si cambias el sistema a modo oscuro, esta página cambia sola.</p>
          <p>
            <span className="chip ok">A tiempo</span>
            <span className="chip atraso">Atrasado 28 min</span>
          </p>
          <p className="cifra" style={{ margin: 0, fontSize: "1.25rem" }}>09:12 · $45.990</p>
        </article>

        <article className="tarjeta">
          <h2>Código compartido</h2>
          <p className="apagado">Una entrega en camino puede pasar a: {pasos}.</p>
        </article>

        <article className="tarjeta">
          <h2>Servicios</h2>
          <p className="apagado">Aviso de errores: {sentryActivo ? "conectado" : "sin configurar (NEXT_PUBLIC_SENTRY_DSN)"}.</p>
          <p className="apagado">Base de datos: {supabaseUrl ? "configurada" : "sin configurar (NEXT_PUBLIC_SUPABASE_URL)"}.</p>
          <PruebaDeErrores activo={sentryActivo} />
        </article>
      </section>
    </main>
  );
}
