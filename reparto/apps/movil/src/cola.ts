// Cola de envíos del conductor (SPEC 3.5 y 6): cada acción se guarda primero en el teléfono
// con un UUID creado aquí, y después se envía. Si no hay señal, queda pendiente y se reintenta.
// El servidor acepta cada UUID una sola vez: reintentar nunca duplica.
//
// Fase 3: la cola vive en AsyncStorage. En la Fase 10 (sin señal completo) pasa a SQLite y
// las fotos a una carpeta permanente.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { supabase } from "./supabase";

const CLAVE = "reparto.cola";

export type Accion =
  | { id: string; clase: "foto"; entrega: string; empresa: string; tipo: "guia" | "entrega" | "efectivo"; uri: string }
  | {
      id: string; clase: "evento"; entrega: string; tipo: "en_camino" | "llegue" | "entregada" | "no_entregada" | "foto_agregada";
      ocurrido_en: string; mensaje?: string; motivo?: string; lat?: number; lng?: number; precision_m?: number;
      fotos?: string[]; cobro?: { forma: "transferencia" | "efectivo" } | null; sin_senal?: boolean;
    };

export const nuevoId = () => randomUUID();

async function leer(): Promise<Accion[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CLAVE)) ?? "[]") as Accion[];
  } catch {
    return [];
  }
}
const guardar = (lista: Accion[]) => AsyncStorage.setItem(CLAVE, JSON.stringify(lista));

export async function pendientes(): Promise<number> {
  return (await leer()).length;
}

export async function encolar(...acciones: Accion[]): Promise<void> {
  await guardar([...(await leer()), ...acciones]);
}

let enviando: Promise<{ enviados: number; quedan: number }> | null = null;

/** Envía lo pendiente, en orden: primero las fotos, después los eventos (SPEC 6). Se detiene al primer corte de red. */
export function enviarPendientes(): Promise<{ enviados: number; quedan: number }> {
  enviando ??= (async () => {
    let lista = await leer();
    let enviados = 0;
    const orden = [...lista].sort((a, b) => (a.clase === b.clase ? 0 : a.clase === "foto" ? -1 : 1));
    for (const a of orden) {
      try {
        await enviarUna(a);
      } catch (e) {
        if (esPermanente(e)) {
          // Un rechazo del servidor (no de la red) no se arregla reintentando: se descarta y se avisa en el registro.
          console.warn("cola: acción rechazada", a.id, e);
        } else break;
      }
      lista = lista.filter((x) => x.id !== a.id);
      await guardar(lista);
      enviados++;
    }
    return { enviados, quedan: lista.length };
  })().finally(() => { enviando = null; });
  return enviando;
}

class Rechazo extends Error {}
const esPermanente = (e: unknown) => e instanceof Rechazo;

async function enviarUna(a: Accion): Promise<void> {
  if (a.clase === "foto") {
    const ruta = `${a.empresa}/${a.entrega}/${a.id}.jpg`;
    const bytes = await (await fetch(a.uri)).arrayBuffer();
    const { error: e1 } = await supabase.storage.from("entregas").upload(ruta, bytes, { contentType: "image/jpeg" });
    // Si ya estaba subida (reintento), sigue adelante.
    if (e1 && !/exists|duplicate/i.test(e1.message)) throw /fetch|network/i.test(e1.message) ? e1 : new Rechazo(e1.message);
    const { error: e2 } = await supabase.rpc("registrar_adjunto", { adjunto: a.id, entrega: a.entrega, tipo: a.tipo, ruta });
    if (e2) throw e2.code ? new Rechazo(e2.message) : e2;
    return;
  }
  const { error } = await supabase.rpc("registrar_evento", {
    evento: a.id, entrega: a.entrega, tipo: a.tipo, ocurrido_en: a.ocurrido_en,
    mensaje: a.mensaje ?? null, motivo: a.motivo ?? null, lat: a.lat ?? null, lng: a.lng ?? null,
    precision_m: a.precision_m ?? null, fotos: a.fotos ?? [], cobro: a.cobro ?? null,
    // Si se envía más de 2 minutos después de ocurrir, se registró sin señal (los avisos lo dirán: «registrado 11:58 sin señal»).
    sin_senal: a.sin_senal ?? Date.now() - Date.parse(a.ocurrido_en) > 120_000,
  });
  if (error) throw error.code ? new Rechazo(error.message) : error;
}

/** Pide al Agente de Entregas revisar la foto en el momento. Espera hasta `ms`; si no alcanza, sigue en segundo plano. */
export async function revisarFoto(evento: string, ms = 8000): Promise<{ foto_ok: boolean; motivo_foto?: string; clase?: string } | null> {
  const tiempo = new Promise<null>((listo) => setTimeout(() => listo(null), ms));
  const pedido = supabase.functions.invoke("agente-entregas", { body: { accion: "revisar", evento_id: evento } })
    .then(({ data }) => (data && typeof data.foto_ok === "boolean" ? data : null))
    .catch(() => null);
  return Promise.race([pedido, tiempo]);
}
