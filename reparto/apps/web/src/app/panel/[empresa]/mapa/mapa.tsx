"use client";

// Mapa con MapLibre (SPEC 3.6). En desarrollo usa las teselas gratuitas de OpenFreeMap;
// en producción, el archivo PMTiles de Chile. Con NEXT_PUBLIC_MAPA_ESTILO=vacio no pide
// nada a internet (pruebas).
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapaLibre, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fijarUbicacion } from "../acciones";
import { hhmm, type EntregaDia } from "../componentes";

const SANTIAGO: [number, number] = [-70.6483, -33.4569];
const SIN_SECTOR = "#566676";
const VACIO: StyleSpecification = { version: 8, sources: {}, layers: [{ id: "fondo", type: "background", paint: { "background-color": "#e2e8ee" } }] };

export function Mapa({ empresa, entregas, sectores, estilo }: {
  empresa: string; entregas: EntregaDia[]; sectores: { id: string; nombre: string; color: string }[]; estilo: string;
}) {
  const router = useRouter();
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLibre | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const [listo, setListo] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<EntregaDia | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ubicadas = useMemo(() => entregas.filter((e) => e.lat !== null && e.lng !== null), [entregas]);
  const sinUbicar = entregas.filter((e) => e.lat === null);

  useEffect(() => {
    let vivo = true;
    void import("maplibre-gl").then((ml) => {
      if (!vivo || !caja.current) return;
      try {
        mapa.current = new ml.Map({ container: caja.current, style: estilo === "vacio" ? VACIO : estilo, center: SANTIAGO, zoom: 10, attributionControl: { compact: true } });
        mapa.current.addControl(new ml.NavigationControl({ showCompass: false }));
        setListo(true);
      } catch {
        setFalla("Este navegador no puede mostrar el mapa (necesita WebGL). La lista de abajo sigue sirviendo.");
      }
    });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, [estilo]);

  // Marcadores: un punto por entrega, del color de su sector.
  useEffect(() => {
    if (!listo || !mapa.current) return;
    void import("maplibre-gl").then((ml) => {
      marcadores.current.forEach((m) => m.remove());
      marcadores.current = ubicadas.map((e) => {
        const el = document.createElement("div");
        el.className = "marcador";
        el.style.background = e.color ?? SIN_SECTOR;
        el.title = `${e.cliente} · guía ${e.guia}`;
        el.setAttribute("aria-label", el.title);
        const popup = new ml.Popup({ offset: 12 }).setText(`${e.cliente} · guía ${e.guia} · ${e.bultos} bultos${e.hora_comprometida ? ` · ${hhmm(e.hora_comprometida)}` : ""}${e.conductor ? ` · ${e.conductor}` : ""}`);
        return new ml.Marker({ element: el }).setLngLat([e.lng!, e.lat!]).setPopup(popup).addTo(mapa.current!);
      });
      if (ubicadas.length > 0) {
        const lngs = ubicadas.map((e) => e.lng!), lats = ubicadas.map((e) => e.lat!);
        mapa.current!.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 15, duration: 0 });
      }
    });
  }, [listo, ubicadas]);

  // Marcar a mano: el próximo clic en el mapa fija el punto del local.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !marcando) return;
    m.getCanvas().style.cursor = "crosshair";
    const alHacerClic = (ev: { lngLat: { lat: number; lng: number } }) => {
      void fijarUbicacion(empresa, marcando.receptor_id, ev.lngLat.lat, ev.lngLat.lng).then((r) => {
        setAviso(r.error ?? `Ubicación de ${marcando.cliente} guardada. Se usará también en sus próximas entregas.`);
        setMarcando(null);
        router.refresh();
      });
    };
    m.once("click", alHacerClic);
    return () => { m.off("click", alHacerClic); m.getCanvas().style.cursor = ""; };
  }, [marcando, empresa, router]);

  const porSector = new Map<string, EntregaDia[]>();
  for (const e of entregas) porSector.set(e.sector ?? "Sin sector", [...(porSector.get(e.sector ?? "Sin sector") ?? []), e]);

  return (
    <div className="mapa-y-lista">
      <div>
        {marcando && <p className="aviso" role="status">Haz clic en el mapa donde está <strong>{marcando.cliente}</strong>. <button className="enlace" onClick={() => setMarcando(null)}>Cancelar</button></p>}
        {aviso && <p className="aviso" role="status">{aviso}</p>}
        {falla && <p className="error">{falla}</p>}
        <div ref={caja} className="mapa" data-marcadores={ubicadas.length} aria-label="Mapa de entregas" />
        <ul className="leyenda" aria-label="Sectores">
          {sectores.map((s) => <li key={s.id}><span className="punto" style={{ background: s.color }} />{s.nombre}</li>)}
          <li><span className="punto" style={{ background: SIN_SECTOR }} />Sin sector</li>
        </ul>
      </div>
      <aside className="tarjeta lista-mapa">
        {sinUbicar.length > 0 && (
          <section>
            <h2>Sin ubicación ({sinUbicar.length})</h2>
            <ul className="lista-simple">
              {sinUbicar.map((e) => (
                <li key={e.id}>
                  <span>{e.cliente}<br /><small className="apagado">{e.direccion}, {e.comuna}</small></span>
                  <button className="boton-secundario" disabled={!listo} onClick={() => setMarcando(e)}>Marcar en el mapa</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {[...porSector.entries()].map(([sector, lista]) => (
          <section key={sector}>
            <h2>{sector} ({lista.length})</h2>
            <ul className="lista-simple" aria-label={`Entregas del sector ${sector}`}>
              {lista.map((e) => <li key={e.id}><span>{e.cliente} · <span className="cifra">{e.guia}</span></span><small className="apagado">{e.bultos} bultos</small></li>)}
            </ul>
          </section>
        ))}
        {entregas.length === 0 && <p className="apagado">No hay entregas este día.</p>}
      </aside>
    </div>
  );
}
