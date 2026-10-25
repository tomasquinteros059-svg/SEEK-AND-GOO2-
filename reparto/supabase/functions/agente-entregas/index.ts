// Reparto · función `agente-entregas` (agentes-y-whatsapp.md 7.1)
//
//   POST {accion:"revisar", evento_id}  la app, con la sesión del conductor, justo después de entregar:
//                                       revisa la foto en el momento (la app espera hasta ~8 s)
//   POST {accion:"barrer"}              el reloj de la base, con la clave de servicio: lo que quedó pendiente
//
// Toma el trabajo de `cola_agentes` (nunca dos veces el mismo), lee el evento, la entrega y la
// foto, pregunta a la IA (o usa el modo simulado si no hay clave), guarda la clasificación y deja
// la acción en la auditoría. NUNCA cambia el estado de la entrega.
//
// Sin ANTHROPIC_API_KEY corre en MODO SIMULADO: no gasta nada y sirve para pruebas y demostración.
import {
  clasificarSimulado, costo, fotoCasiVacia, hayQueRevisar, leerRespuesta, MODELO_POR_OMISION, peticion,
  type DatosRevision, type Resultado,
} from "../_compartido/agente-entregas.ts";

const URL_BASE = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLAVE_IA = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODELO = Deno.env.get("MODELO_ENTREGAS") ?? MODELO_POR_OMISION;

const cabeceras = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

function igualDeLento(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function rest<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...opciones, headers: { ...cabeceras, ...(opciones.headers ?? {}) } });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto}`);
  // Con «Prefer: return=minimal» la base responde sin cuerpo (201 o 204).
  return (texto ? JSON.parse(texto) : null) as T;
}

type Trabajo = { id: string; empresa_id: string; intentos: number; datos: { evento_id: string; entrega_id: string } };

async function tomar(clave: string | null, cuantos: number): Promise<Trabajo[]> {
  return await rest<Trabajo[]>("rpc/tomar_trabajo", { method: "POST", body: JSON.stringify({ agente_nombre: "entregas", cuantos, clave }) });
}

function horaChile(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

async function bajarFoto(ruta: string): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  const r = await fetch(`${URL_BASE}/storage/v1/object/entregas/${ruta}`, { headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` } });
  if (!r.ok) return null;
  return { bytes: new Uint8Array(await r.arrayBuffer()), tipo: r.headers.get("Content-Type") ?? "image/jpeg" };
}

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function preguntarIA(d: DatosRevision, foto: { bytes: Uint8Array; tipo: string } | null) {
  const { default: Anthropic } = await import("npm:@anthropic-ai/sdk@1.3.0");
  const cliente = new Anthropic({ apiKey: CLAVE_IA, timeout: 20_000, maxRetries: 1 });
  // deno-lint-ignore no-explicit-any
  const r: any = await cliente.messages.create(peticion(d, foto ? { base64: base64(foto.bytes), tipo: foto.tipo } : null, MODELO) as any);
  return { resultado: leerRespuesta(r), uso: r.usage as { input_tokens: number; output_tokens: number } };
}

/** Procesa un trabajo. Devuelve lo que concluyó (o null si falló y se reintentará). */
async function procesar(t: Trabajo): Promise<(Resultado & { revisar: boolean }) | null> {
  try {
    const [ev] = await rest<{ id: string; tipo: DatosRevision["tipo"]; mensaje: string | null; motivo: string | null; ocurrido_en: string; datos: { fotos?: string[] } }[]>(
      `eventos_entrega?id=eq.${t.datos.evento_id}&select=id,tipo,mensaje,motivo,ocurrido_en,datos`);
    const [en] = await rest<{ guia: string; bultos: number; receptores: { nombre: string }; empresas: { nombre: string } }[]>(
      `entregas?id=eq.${t.datos.entrega_id}&select=guia,bultos,receptores(nombre),empresas(nombre)`);
    if (!ev || !en) throw new Error("No encontré el evento o la entrega.");

    const fotos = ev.datos.fotos ?? [];
    const adj = fotos.length
      ? await rest<{ ruta: string; tipo: string; creado_en: string }[]>(`adjuntos?id=in.(${fotos.join(",")})&select=ruta,tipo,creado_en&order=creado_en.desc`)
      : [];
    // La guía firmada es la que importa; si no hay, la última foto.
    const principal = adj.find((a) => a.tipo === "guia") ?? adj[0];
    const foto = principal ? await bajarFoto(principal.ruta) : null;

    const d: DatosRevision = {
      tipo: ev.tipo, mensaje: ev.mensaje ?? "", motivo: ev.motivo, cliente: en.receptores.nombre, guia: en.guia,
      bultos: en.bultos, hora: horaChile(ev.ocurrido_en), empresa: en.empresas.nombre,
    };

    let r: Resultado | null;
    let uso: { input_tokens: number; output_tokens: number } | undefined;
    let modelo = "simulado";
    if (foto && fotoCasiVacia(foto.bytes.length)) {
      r = { ...clasificarSimulado(d, foto.bytes.length), foto_ok: false };  // sin gastar IA
    } else if (!CLAVE_IA) {
      r = clasificarSimulado(d, foto?.bytes.length ?? null);
    } else {
      modelo = MODELO;
      const x = await preguntarIA(d, foto);
      r = x.resultado;
      uso = x.uso;
      if (!r) throw new Error("La IA no devolvió una clasificación usable.");
    }

    // Una foto agregada después solo actualiza si la foto sirve; la clasificación de la entrega se mantiene.
    const revisar = hayQueRevisar(d, r);
    const fila = {
      entrega_id: t.datos.entrega_id, empresa_id: t.empresa_id, evento_id: ev.id, clase: r.clase, foto_ok: r.foto_ok,
      motivo_foto: r.motivo_foto || null, resumen: r.resumen, urgente: r.urgente, revisar, mensaje_cliente: r.mensaje_cliente,
      modelo, costo_usd: costo(modelo, uso), actualizada_en: new Date().toISOString(),
    };
    await rest("clasificaciones_entrega?on_conflict=entrega_id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila),
    });
    await rest("acciones_asistente", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        empresa_id: t.empresa_id, agente: "entregas", evento_id: ev.id, herramienta: "clasificar_entrega",
        datos: { entrega_id: t.datos.entrega_id, tipo: ev.tipo }, resultado: { ...r, revisar },
        modelo, tokens_entrada: uso?.input_tokens ?? null, tokens_salida: uso?.output_tokens ?? null, costo_usd: costo(modelo, uso),
        modo: CLAVE_IA ? "ia" : "simulado",
      }),
    });
    await rest(`cola_agentes?id=eq.${t.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ estado: "hecho", error: null }) });
    return { ...r, revisar };
  } catch (e) {
    const agotado = t.intentos >= 3;
    await rest(`cola_agentes?id=eq.${t.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        estado: agotado ? "fallido" : "pendiente", error: String(e).slice(0, 500),
        disponible_en: new Date(Date.now() + 60_000 * 2 ** t.intentos).toISOString(),
      }),
    }).catch(() => {});
    console.error("agente-entregas", t.id, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version", "Access-Control-Allow-Methods": "POST" } });
  }
  if (req.method !== "POST") return responder({ error: "Método no permitido." }, 405);
  const cuerpo = await req.json().catch(() => ({})) as { accion?: string; evento_id?: string };
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

  if (cuerpo.accion === "barrer") {
    if (!SERVICIO || !igualDeLento(token, SERVICIO)) return responder({ error: "Esta acción la hace el servidor." }, 403);
    const trabajos = await tomar(null, 10);
    let hechos = 0;
    for (const t of trabajos) if (await procesar(t)) hechos++;  // de a uno: no saturar la IA ni la base
    return responder({ tomados: trabajos.length, hechos });
  }

  if (cuerpo.accion === "revisar" && cuerpo.evento_id && /^[0-9a-f-]{36}$/i.test(cuerpo.evento_id)) {
    // Quien pide es el conductor: se comprueba su sesión y que el evento sea suyo.
    const u = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { apikey: SERVICIO, Authorization: `Bearer ${token}` } });
    if (!u.ok) return responder({ error: "Sesión inválida." }, 401);
    const { id } = await u.json() as { id: string };
    const [ev] = await rest<{ autor: string }[]>(`eventos_entrega?id=eq.${cuerpo.evento_id}&select=autor`);
    if (!ev || ev.autor !== id) return responder({ error: "Ese evento no es tuyo." }, 403);

    const [t] = await tomar(`entregas:${cuerpo.evento_id}`, 1);
    if (!t) {
      // Ya lo procesó el barrido (o está en curso): se devuelve lo guardado.
      const [ya] = await rest<Resultado[]>(`clasificaciones_entrega?evento_id=eq.${cuerpo.evento_id}&select=foto_ok,motivo_foto,clase,urgente`);
      return responder(ya ?? { pendiente: true });
    }
    const r = await procesar(t);
    return responder(r ? { foto_ok: r.foto_ok, motivo_foto: r.motivo_foto, clase: r.clase, urgente: r.urgente } : { pendiente: true });
  }

  return responder({ error: "No conozco esa acción." }, 400);
});
