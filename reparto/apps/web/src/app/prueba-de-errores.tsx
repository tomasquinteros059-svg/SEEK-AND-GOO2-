"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export function PruebaDeErrores({ activo }: { activo: boolean }) {
  const [enviado, setEnviado] = useState(false);
  return (
    <button
      type="button"
      className="boton"
      disabled={!activo || enviado}
      onClick={() => {
        Sentry.captureMessage("Prueba de aviso de errores desde el panel (Fase 0)");
        setEnviado(true);
      }}
    >
      {enviado ? "Prueba enviada a Sentry" : "Enviar prueba de error"}
    </button>
  );
}
