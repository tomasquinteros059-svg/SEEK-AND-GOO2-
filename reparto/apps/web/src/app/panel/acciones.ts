"use server";

// Acciones del panel. Todas corren con la sesión de quien está conectado: las
// reglas de acceso (RLS) de la base deciden si puede hacerlas, no este archivo.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  normalizarCorreo, normalizarNombreCompleto, normalizarNombreEmpresa, normalizarTelefono, revisarRegistro, VERSION_LEGAL,
} from "@reparto/dominio";
import { clienteServidor } from "@/lib/supabase/servidor";
import { enviarInvitacion } from "@/lib/correo";

export type Estado = {
  error?: string;
  errores?: Record<string, string>;
  ok?: string;
  /** Lo que la persona escribió, para no borrárselo si algo falta (React vacía el formulario al enviarlo). */
  valores?: Record<string, string>;
};

function valoresDe(f: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [clave, valor] of f.entries()) if (typeof valor === "string") v[clave] = valor;
  return v;
}

async function sesion() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");
  return { supabase, usuario: data.user };
}

function texto(f: FormData, campo: string): string {
  const v = f.get(campo);
  return typeof v === "string" ? v : "";
}

/** Primer ingreso: mis datos, los consentimientos y (si corresponde) la empresa. */
export async function completarRegistro(previo: Estado, f: FormData): Promise<Estado> {
  const r = await registrar(f);
  return r ? { ...r, valores: valoresDe(f) } : previo;
}

async function registrar(f: FormData): Promise<Estado | null> {
  const { supabase, usuario } = await sesion();
  const modo = texto(f, "modo"); // completo | perfil | empresa
  let empresaCreada: string | null = null;

  if (modo === "completo" || modo === "perfil") {
    const r = revisarRegistro({
      perfil: modo === "completo" ? "admin" : "receptor",
      nombre: texto(f, "nombre"),
      telefono: texto(f, "telefono"),
      empresa: texto(f, "empresa"),
      telefonoEmpresa: texto(f, "telefonoEmpresa"),
      aceptaTerminos: f.get("terminos") === "si",
    });
    if (!r.ok) return { errores: r.errores as Record<string, string> };

    const { error } = await supabase.from("usuarios").insert({
      id: usuario.id, nombre: r.datos.nombre, telefono: r.datos.telefono, correo: (usuario.email ?? "").toLowerCase(),
    });
    if (error && error.code !== "23505") return { error: "No pudimos guardar tus datos. Inténtalo otra vez." };

    await supabase.from("consentimientos").insert([
      { usuario_id: usuario.id, tipo: "terminos", version: VERSION_LEGAL },
      { usuario_id: usuario.id, tipo: "privacidad", version: VERSION_LEGAL },
    ]);

    if (modo === "completo") {
      const { data, error: e } = await supabase.rpc("crear_empresa", {
        nombre: r.datos.empresa, telefono_contacto: r.datos.telefonoEmpresa,
      });
      if (e) return { error: "Guardamos tus datos, pero no pudimos crear la empresa. Inténtalo otra vez." };
      empresaCreada = data as string;
    }
  } else if (modo === "empresa") {
    const empresa = normalizarNombreEmpresa(texto(f, "empresa"));
    const telefonoEmpresa = normalizarTelefono(texto(f, "telefonoEmpresa"));
    const errores: Record<string, string> = {};
    if (!empresa) errores.empresa = "Escribe el nombre de la empresa.";
    if (!telefonoEmpresa) errores.telefonoEmpresa = "Escribe el teléfono de contacto de la empresa.";
    if (!empresa || !telefonoEmpresa) return { errores };
    const { data, error } = await supabase.rpc("crear_empresa", { nombre: empresa, telefono_contacto: telefonoEmpresa });
    if (error) return { error: "No pudimos crear la empresa. Inténtalo otra vez." };
    empresaCreada = data as string;
  }

  redirect(empresaCreada ? `/panel/${empresaCreada}/equipo` : "/panel");
}

export async function invitar(_: Estado, f: FormData): Promise<Estado> {
  const r = await crearInvitacion(f);
  return r.error ? { ...r, valores: valoresDe(f) } : r;
}

async function crearInvitacion(f: FormData): Promise<Estado> {
  const { supabase, usuario } = await sesion();
  const empresa = texto(f, "empresa");
  const correo = normalizarCorreo(texto(f, "correo"));
  const rol = texto(f, "rol") === "admin" ? "admin" : "conductor";
  if (!correo) return { error: "Escribe un correo válido." };

  const { error } = await supabase.from("invitaciones").insert({ empresa_id: empresa, correo, rol, invitada_por: usuario.id });
  if (error) {
    if (error.code === "23505") return { error: `Ya hay una invitación pendiente para ${correo}.` };
    return { error: "No pudimos crear la invitación. ¿Sigues siendo administrador de esta empresa?" };
  }

  const [{ data: emp }, { data: yo }] = await Promise.all([
    supabase.from("empresas").select("nombre").eq("id", empresa).single(),
    supabase.from("usuarios").select("nombre").eq("id", usuario.id).single(),
  ]);
  const enviado = await enviarInvitacion({ para: correo, empresa: emp?.nombre ?? "tu empresa", rol, invitadoPor: yo?.nombre ?? "Alguien" });
  revalidatePath(`/panel/${empresa}/equipo`);
  return {
    ok: enviado
      ? `Invitación enviada a ${correo}.`
      : `Invitación creada. Avísale a ${correo} que entre ${rol === "admin" ? "al panel" : "a la app"} con ese correo (el envío de correos aún no está configurado).`,
  };
}

function volver(empresa: string, aviso?: string): never {
  revalidatePath(`/panel/${empresa}/equipo`);
  redirect(`/panel/${empresa}/equipo${aviso ? `?aviso=${encodeURIComponent(aviso)}` : ""}`);
}

export async function anularInvitacion(f: FormData) {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  await supabase.from("invitaciones").update({ estado: "anulada", respondida_en: new Date().toISOString() })
    .eq("id", texto(f, "id")).eq("empresa_id", empresa);
  volver(empresa, "Invitación anulada.");
}

export async function cambiarEstadoMiembro(f: FormData) {
  const { supabase } = await sesion();
  const empresa = texto(f, "empresa");
  const estado = texto(f, "estado") === "suspendido" ? "suspendido" : "activo";
  const { error } = await supabase.from("membresias").update({ estado })
    .eq("empresa_id", empresa).eq("usuario_id", texto(f, "usuario"));
  volver(empresa, error ? (error.code === "P0001" ? error.message : "No pudimos hacer el cambio.") : estado === "suspendido" ? "Acceso suspendido." : "Acceso reactivado.");
}

export async function revisarDocumento(f: FormData) {
  const { supabase, usuario } = await sesion();
  const empresa = texto(f, "empresa");
  const estado = texto(f, "estado") === "aprobado" ? "aprobado" : "rechazado";
  const nota = texto(f, "nota").trim().slice(0, 500) || null;
  const { error } = await supabase.from("revisiones_documento").upsert({
    documento_id: texto(f, "documento"), empresa_id: empresa, estado, nota,
    revisado_por: usuario.id, revisado_en: new Date().toISOString(),
  });
  volver(empresa, error ? "No pudimos guardar la revisión." : estado === "aprobado" ? "Documento aprobado." : "Documento rechazado.");
}

export async function responderInvitacion(f: FormData) {
  const { supabase } = await sesion();
  const id = texto(f, "id");
  if (texto(f, "respuesta") === "aceptar") {
    const { data, error } = await supabase.rpc("aceptar_invitacion", { invitacion: id });
    if (error) redirect(`/panel?aviso=${encodeURIComponent(error.message)}`);
    redirect(`/panel/${data as string}/equipo`);
  }
  await supabase.rpc("rechazar_invitacion", { invitacion: id });
  redirect("/panel?aviso=Invitaci%C3%B3n%20rechazada.");
}

export async function salir() {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}

/** Para el formulario de mis datos (también lo usa la página de inicio). */
export async function actualizarMisDatos(_: Estado, f: FormData): Promise<Estado> {
  const { supabase, usuario } = await sesion();
  const nombre = normalizarNombreCompleto(texto(f, "nombre"));
  const telefono = normalizarTelefono(texto(f, "telefono"));
  const errores: Record<string, string> = {};
  if (!nombre) errores.nombre = "Escribe tu nombre y apellido.";
  if (!telefono) errores.telefono = "Escribe un teléfono chileno.";
  if (!nombre || !telefono) return { errores };
  const { error } = await supabase.from("usuarios").update({ nombre, telefono }).eq("id", usuario.id);
  return error ? { error: "No pudimos guardar." } : { ok: "Datos guardados." };
}
