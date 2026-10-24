"use client";

// Muestra las filas por estado y va ubicando las direcciones en el mapa en tandas
// (el proveedor de mapas limita cuántas se pueden buscar por segundo).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FilaRevisada } from "@reparto/dominio";
import { crearDesdeCarga, descartarCarga, ubicarTanda } from "../../acciones";

type Fila = FilaRevisada & { intentada?: boolean };
const NOMBRE = { lista: "Listas", revisar: "Por revisar", error: "Con error" } as const;
const ETIQUETA = { lista: "Lista", revisar: "Por revisar", error: "Con error" } as const;

export function VistaPrevia({ empresa, carga, filasIniciales }: { empresa: string; carga: string; filasIniciales: Fila[] }) {
  const router = useRouter();
  const total = filasIniciales.filter((f) => f.estado !== "error").length;
  const [pendientes, setPendientes] = useState(filasIniciales.filter((f) => f.estado !== "error" && !f.intentada).length);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todas" | Fila["estado"]>("todas");

  useEffect(() => {
    if (pendientes === 0) return;
    let vivo = true;
    void ubicarTanda(empresa, carga).then((r) => {
      if (!vivo) return;
      if ("error" in r) return setError(r.error);
      setPendientes(r.pendientes);
      router.refresh();
    });
    return () => { vivo = false; };
  }, [pendientes, empresa, carga, router]);

  const cuenta = useMemo(() => ({
    lista: filasIniciales.filter((f) => f.estado === "lista").length,
    revisar: filasIniciales.filter((f) => f.estado === "revisar").length,
    error: filasIniciales.filter((f) => f.estado === "error").length,
  }), [filasIniciales]);
  const visibles = filasIniciales.filter((f) => filtro === "todas" || f.estado === filtro);
  const ubicando = pendientes > 0;

  return (
    <>
      <section className="cifras" aria-label="Resultado de la revisión">
        <button className={`cifra-boton ok ${filtro === "lista" ? "activa" : ""}`} onClick={() => setFiltro(filtro === "lista" ? "todas" : "lista")}>
          <strong className="cifra">{cuenta.lista}</strong><span>{NOMBRE.lista}</span>
        </button>
        <button className={`cifra-boton pendiente ${filtro === "revisar" ? "activa" : ""}`} onClick={() => setFiltro(filtro === "revisar" ? "todas" : "revisar")}>
          <strong className="cifra">{cuenta.revisar}</strong><span>{NOMBRE.revisar}</span>
        </button>
        <button className={`cifra-boton atraso ${filtro === "error" ? "activa" : ""}`} onClick={() => setFiltro(filtro === "error" ? "todas" : "error")}>
          <strong className="cifra">{cuenta.error}</strong><span>{NOMBRE.error}</span>
        </button>
      </section>

      {ubicando && (
        <div className="aviso" role="status">
          Ubicando direcciones en el mapa: {total - pendientes} de {total}…
          <progress max={total} value={total - pendientes} style={{ width: "100%" }} />
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="tarjeta">
        <div className="tabla-envoltura">
          <table className="tabla" aria-label="Filas del archivo">
            <thead><tr><th>Fila</th><th>Estado</th><th>Cliente</th><th>Guía</th><th>Bultos</th><th>Fecha</th><th>Qué pasa</th></tr></thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.n} data-estado={f.estado}>
                  <td className="cifra">{f.n}</td>
                  <td><span className={`chip ${f.estado === "lista" ? "ok" : f.estado === "revisar" ? "pendiente" : "atraso"}`}>{ETIQUETA[f.estado]}</span></td>
                  <td>{f.datos.cliente || "—"}<br /><small className="apagado">{f.datos.direccion} · {f.datos.comuna}</small></td>
                  <td className="cifra">{f.datos.guia || "—"}</td>
                  <td className="cifra">{f.datos.bultos || "—"}</td>
                  <td className="cifra">{f.datos.fecha ? f.datos.fecha.split("-").reverse().join("-") : "—"}</td>
                  <td>{f.motivos.length ? <ul className="motivos">{f.motivos.map((m) => <li key={m}>{m}</li>)}</ul> : <span className="apagado">Todo en orden</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="barra-acciones">
        <form action={crearDesdeCarga}>
          <input type="hidden" name="empresa" value={empresa} />
          <input type="hidden" name="carga" value={carga} />
          <button className="boton" disabled={ubicando || cuenta.lista + cuenta.revisar === 0}>
            Crear {cuenta.lista + cuenta.revisar} entregas
          </button>
        </form>
        <form action={descartarCarga}>
          <input type="hidden" name="empresa" value={empresa} />
          <input type="hidden" name="carga" value={carga} />
          <button className="boton-secundario">Descartar</button>
        </form>
        <p className="apagado">Se crean las listas y las por revisar (las sin ubicación las marcas después en el mapa). Las filas con error no se crean: corrígelas en el archivo y súbelo otra vez.</p>
      </div>
    </>
  );
}
