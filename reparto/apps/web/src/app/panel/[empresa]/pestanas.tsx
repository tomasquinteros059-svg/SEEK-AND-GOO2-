"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  ["entregas", "Entregas"],
  ["cargar", "Cargar archivo"],
  ["mapa", "Mapa"],
  ["sectores", "Sectores"],
  ["equipo", "Equipo"],
] as const;

export function Pestanas({ empresa }: { empresa: string }) {
  const ruta = usePathname();
  return (
    <nav className="pestanas" aria-label="Secciones">
      {SECCIONES.map(([s, nombre]) => {
        const activa = ruta.startsWith(`/panel/${empresa}/${s}`);
        return (
          <Link key={s} href={`/panel/${empresa}/${s}`} aria-current={activa ? "page" : undefined} className={activa ? "activa" : undefined}>
            {nombre}
          </Link>
        );
      })}
    </nav>
  );
}
