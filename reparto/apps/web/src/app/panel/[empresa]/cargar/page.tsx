import { SubirArchivo } from "./subir";

type Props = { params: Promise<{ empresa: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Cargar({ params, searchParams }: Props) {
  const { empresa } = await params;
  const { aviso } = await searchParams;
  return (
    <main className="contenedor">
      <h1>Cargar entregas desde un archivo</h1>
      {typeof aviso === "string" && <p className="aviso" role="status">{aviso}</p>}
      <section className="tarjeta">
        <p>Sube un Excel (.xlsx) o CSV con las entregas. Antes de crear nada verás una <strong>vista previa</strong>: las filas listas, las que hay que revisar y las que tienen errores.</p>
        <p><a className="boton-secundario" href="/plantilla-entregas.xlsx" download>Descargar la plantilla</a></p>
        <p className="apagado">Obligatorio: Cliente (local), Dirección, Fecha, N° guía y Bultos. Si tus columnas se llaman distinto («Local», «Guía de despacho», «Cajas»), igual se reconocen.</p>
        <SubirArchivo empresa={empresa} />
      </section>
    </main>
  );
}
