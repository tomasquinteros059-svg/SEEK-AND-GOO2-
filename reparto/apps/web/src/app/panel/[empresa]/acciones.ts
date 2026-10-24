"use server";

// Acciones de la Fase 2 (entregas, cargas, sectores y ubicación). Corren con la sesión
// del administrador: las reglas de la base (RLS) deciden si puede.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  buscarEncabezados, CAMPOS, clave, comunaRM, conUbicacion, mapearColumnas, resumen, revisarFilas,
  type Campo, type FilaRevisada,
} from "@reparto/dominio";
import { clienteServidor } from "@/lib/supabase/servidor";
import { leerArchivo, TOPE_ARCHIVO, TOPE_FILAS } from "@/lib/excel";
import { hoyEnChile } from "@/lib/fechas";
import { porTanda, proveedor, ubicar } from "@/lib/ubicar";

export type Estado = { error?: string; errores?: Record<string, string>; ok?: string; valores?: Record<string, string> };
type FilaCarga = FilaRevisada & { intentada?: boolean };

async function sesion() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");
  return { supabase, usuario: data.user };
}

const texto = (f: FormData, c: string) => { const v = f.get(c); return typeof v === "string" ? v : ""; };

async function contexto(supabase: Awaited<ReturnType<typeof clienteServidor>>, empresa: string) {
  const [{ data: miembros }, { data: guias }] = await Promise.all([
    supabase.from("membresias").select("usuario_id, usuarios(nombre, correo)").eq("empresa_id", empresa).eq("rol", "conductor").eq("estado", "activo"),
    supabase.from("entregas").select("guia").eq("empresa_id", empresa).not("estado", "in", "(fallida,cancelada)"),
  ]);
  return {
    conductores: (miembros ?? []).map((m) => {
      const u = m.usuarios as unknown as { nombre: string; correo: string };
      return { id: m.usuario_id as string, nombre: u.nombre, correo: u.correo };
    }),
    guiasExistentes: new Set((guias ?? []).map((g) => clave(g.guia as string))),
    hoy: hoyEnChile(),
  };
}

// --- Carga por archivo -------------------------------------------------------

export async function subirCarga(_: Estado, f: FormData): Promise<Estado> {
  const { supabase, usuario } = await sesion();
  const empresa = texto(f, "empresa");
  const archivo = f.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige un archivo Excel (.xlsx) o CSV." };
  if (archivo.size > TOPE_ARCHIVO) return { error: "El archivo pesa más de 5 MB." };

  let filas: string[][];
  try {
    filas = await leerArchivo(archivo.name, Buffer.from(await archivo.arrayBuffer()));
  } catch (e) {
    return { error: e instanceof Error && e.message.startsWith("Sube") ? e.message : "No pude leer el archivo. ¿Es un Excel válido?" };
  }
  const fila0 = buscarEncabezados(filas);
  if (fila0 < 0) return { error: "No encontré los encabezados. Usa la plantilla (Cliente, Dirección, Fecha, N° guía, Bultos…)." };
  const { columnas, faltan } = mapearColumnas(filas[fila0]!);
  if (faltan.length > 0) return { error: `Faltan columnas obligatorias: ${faltan.join(", ")}.` };
  const cuerpo = filas.slice(fila0 + 1);
  if (cuerpo.length === 0) return { error: "El archivo no tiene filas de entregas." };
  if (cuerpo.length > TOPE_FILAS) return { error: `El archivo tiene ${cuerpo.length} filas; el máximo por carga es ${TOPE_FILAS}.` };

  const entrada = cuerpo.map((celdas, i) => {
    const valores: Partial<Record<Campo, string>> = {};
    for (const campo of CAMPOS) {
      const col = columnas[campo];
      if (col !== undefined) valores[campo] = celdas[col] ?? "";
    }
    return { n: fila0 + i + 2, valores };
  });
  const revisadas = revisarFilas(entrada, await contexto(supabase, empresa));

  const { data, error } = await supabase.from("cargas")
    .insert({ empresa_id: empresa, creada_por: usuario.id, archivo: archivo.name.slice(0, 120), filas: revisadas })
    .select("id").single();
  if (error || !data) return { error: "No pude guardar la vista previa. ¿Sigues siendo administrador?" };
  redirect(`/panel/${empresa}/cargar/${data.id}`);
}

/** Ubica en el mapa una tanda de filas pendientes. El navegador la llama hasta que no quedan. */
export async function ubicarTanda(empresa: string, carga: string): Promise<{ pendientes: number; resumen: ReturnType<typeof resumen> } | { error: string }> {
  const { supabase } = await sesion();
  const { data } = await supabase.from("cargas").select("filas, estado").eq("id", carga).eq("empresa_id", empresa).single();
  if (!data || data.estado !== "vista_previa") return { error: "Esa carga ya no está en vista previa." };
  const filas = data.filas as FilaCarga[];
  const pendientes = filas.map((f, i) => [f, i] as const).filter(([f]) => f.estado !== "error" && !f.intentada);
  for (const [f, i] of pendientes.slice(0, porTanda(proveedor()))) {
    const u = await ubicar(supabase, empresa, f.datos.direccion, f.datos.comuna);
    filas[i] = { ...conUbicacion(f, u), intentada: true };
  }
  await supabase.from("cargas").update({ filas }).eq("id", carga);
  return { pendientes: filas.filter((f) => f.estado !== "error" && !f.intentada).length, resumen: resumen(filas) };
}

export async function crearDesdeCarga(f: FormData) {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  const carga = texto(f, "carga");
  const { data: c } = await supabase.from("cargas").select("filas").eq("id", carga).single();
  const { data, error } = await supabase.rpc("crear_entregas_desde_carga", { carga });
  if (error) redirect(`/panel/${empresa}/cargar/${carga}?aviso=${encodeURIComponent(error.code === "23505" ? "Una de las guías ya existe. Vuelve a subir el archivo." : error.message)}`);
  const primera = ((c?.filas ?? []) as FilaCarga[]).find((x) => x.estado !== "error")?.datos.fecha;
  revalidatePath(`/panel/${empresa}/entregas`);
  redirect(`/panel/${empresa}/entregas?fecha=${primera ?? hoyEnChile()}&aviso=${encodeURIComponent(`Se crearon ${data as number} entregas.`)}`);
}

export async function descartarCarga(f: FormData) {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  await supabase.from("cargas").update({ estado: "descartada" }).eq("id", texto(f, "carga")).eq("empresa_id", empresa);
  redirect(`/panel/${empresa}/cargar?aviso=Carga%20descartada.`);
}

// --- Una entrega a mano -------------------------------------------------------

export async function crearEntrega(_: Estado, f: FormData): Promise<Estado> {
  const { supabase, usuario } = await sesion();
  const empresa = texto(f, "empresa");
  const valores: Partial<Record<Campo, string>> = {};
  for (const c of CAMPOS) valores[c] = texto(f, c);
  valores.cobro = f.get("cobro") === "si" ? "si" : "no";
  const todo = Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

  const [fila] = revisarFilas([{ n: 1, valores }], await contexto(supabase, empresa));
  if (!fila) return { error: "No pude revisar la entrega." };
  if (fila.estado === "error") return { error: fila.motivos.join(" "), valores: todo };
  const u = await ubicar(supabase, empresa, fila.datos.direccion, fila.datos.comuna);
  const final = conUbicacion(fila, u);

  const { data: c, error } = await supabase.from("cargas")
    .insert({ empresa_id: empresa, creada_por: usuario.id, archivo: "Ingreso manual", filas: [final] }).select("id").single();
  if (error || !c) return { error: "No pude guardar la entrega.", valores: todo };
  const r = await supabase.rpc("crear_entregas_desde_carga", { carga: c.id });
  if (r.error) return { error: r.error.code === "23505" ? "Esa guía ya está registrada." : "No pude crear la entrega.", valores: todo };
  revalidatePath(`/panel/${empresa}/entregas`);
  const aviso = final.estado === "revisar" ? `Entrega creada, pero revisa: ${final.motivos.join(" ")}` : "Entrega creada.";
  redirect(`/panel/${empresa}/entregas?fecha=${final.datos.fecha}&aviso=${encodeURIComponent(aviso)}`);
}

export async function asignarConductor(f: FormData) {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  const conductor = texto(f, "conductor") || null;
  const { error } = await supabase.from("entregas").update({ conductor_id: conductor }).eq("id", texto(f, "entrega")).eq("empresa_id", empresa);
  const fecha = texto(f, "fecha");
  revalidatePath(`/panel/${empresa}/entregas`);
  redirect(`/panel/${empresa}/entregas?fecha=${fecha}${error ? `&aviso=${encodeURIComponent(error.message)}` : ""}`);
}

export async function cancelarEntrega(f: FormData) {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  const { error } = await supabase.from("entregas").update({ estado: "cancelada" }).eq("id", texto(f, "entrega")).eq("empresa_id", empresa);
  redirect(`/panel/${empresa}/entregas?fecha=${texto(f, "fecha")}&aviso=${encodeURIComponent(error ? error.message : "Entrega cancelada.")}`);
}

export async function fijarUbicacion(empresa: string, receptor: string, lat: number, lng: number): Promise<{ error?: string }> {
  const { supabase } = await sesion();
  const { error } = await supabase.rpc("fijar_ubicacion", { receptor, lat, lng });
  revalidatePath(`/panel/${empresa}/mapa`);
  return error ? { error: error.message } : {};
}

// --- Sectores -------------------------------------------------------------------

export async function guardarSector(_: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  const id = texto(f, "id");
  const nombre = texto(f, "nombre").trim();
  const color = /^#[0-9a-f]{6}$/i.test(texto(f, "color")) ? texto(f, "color") : "#143b5c";
  const comunas = f.getAll("comunas").filter((c): c is string => typeof c === "string").map((c) => comunaRM(c) ?? c);
  if (!nombre) return { error: "Ponle un nombre al sector." };
  if (comunas.length === 0) return { error: "Elige al menos una comuna." };
  const fila = { empresa_id: empresa, nombre, color, comunas };
  const { error } = id
    ? await supabase.from("sectores").update(fila).eq("id", id).eq("empresa_id", empresa)
    : await supabase.from("sectores").insert(fila);
  if (error) return { error: error.code === "23505" ? "Ya hay un sector con ese nombre." : error.message };
  revalidatePath(`/panel/${empresa}/sectores`);
  return { ok: id ? "Sector actualizado." : "Sector creado." };
}

export async function borrarSector(f: FormData) {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  await supabase.from("sectores").delete().eq("id", texto(f, "id")).eq("empresa_id", empresa);
  revalidatePath(`/panel/${empresa}/sectores`);
  redirect(`/panel/${empresa}/sectores`);
}
