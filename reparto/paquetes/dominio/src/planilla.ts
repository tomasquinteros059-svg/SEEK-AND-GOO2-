// Carga de entregas desde Excel o CSV (SPEC 2, paso 1; decisiones del 24-oct-2026).
//
// Tres pasos, todos sin red:
//   1. `leerCsv`         si viene en CSV (Excel en español usa ";").
//   2. `mapearColumnas`  reconoce los encabezados aunque se llamen distinto ("N° guía", "Guía de despacho"…).
//   3. `revisarFilas`    deja cada fila como LISTA, POR REVISAR o CON ERROR, con los motivos.
// La ubicación en el mapa se agrega después (puede quedar "por revisar" si no se encuentra).
import { comunaRM } from "./comunas";
import { normalizarFecha, normalizarTelefono } from "./perfil";
import { clave } from "./texto";

export const CAMPOS = [
  "cliente", "direccion", "comuna", "contacto", "telefono", "fecha", "hora", "desde", "hasta",
  "guia", "oc", "bultos", "cobro", "monto", "forma", "conductor", "notas",
] as const;
export type Campo = (typeof CAMPOS)[number];

/** Encabezados de la plantilla oficial (en este orden). */
export const ENCABEZADOS_PLANTILLA: Record<Campo, string> = {
  cliente: "Cliente (local)", direccion: "Dirección", comuna: "Comuna", contacto: "Contacto recepción",
  telefono: "Teléfono contacto", fecha: "Fecha", hora: "Hora comprometida", desde: "Recepción desde",
  hasta: "Recepción hasta", guia: "N° guía", oc: "Orden de compra", bultos: "Bultos", cobro: "Cobrar al entregar",
  monto: "Monto", forma: "Forma de pago", conductor: "Conductor", notas: "Notas",
};

const SINONIMOS: Record<Campo, string[]> = {
  cliente: ["cliente", "cliente local", "local", "destino", "destinatario", "receptor", "tienda", "sucursal"],
  direccion: ["direccion", "direccion de entrega", "domicilio", "calle"],
  comuna: ["comuna"],
  contacto: ["contacto", "contacto recepcion", "recibe", "nombre contacto", "encargado"],
  telefono: ["telefono", "telefono contacto", "fono", "celular", "whatsapp", "movil"],
  fecha: ["fecha", "fecha entrega", "fecha de entrega", "dia"],
  hora: ["hora", "hora comprometida", "hora de entrega", "hora entrega"],
  desde: ["recepcion desde", "horario desde", "desde", "recibe desde", "hora desde"],
  hasta: ["recepcion hasta", "horario hasta", "hasta", "recibe hasta", "hora hasta"],
  guia: ["guia", "n guia", "no guia", "nro guia", "numero guia", "n° guia", "guia de despacho", "guia despacho", "folio guia"],
  oc: ["oc", "orden de compra", "orden compra", "n oc", "nro oc"],
  bultos: ["bultos", "cantidad bultos", "n bultos", "cajas", "cantidad"],
  cobro: ["cobro", "cobrar", "cobrar al entregar", "pago", "se cobra"],
  monto: ["monto", "monto a cobrar", "valor", "total"],
  forma: ["forma de pago", "forma pago", "medio de pago"],
  conductor: ["conductor", "chofer", "repartidor"],
  notas: ["notas", "nota", "observaciones", "observacion", "comentarios"],
};

const limpiarEncabezado = (t: string) => clave(t).replace(/[°º#.:()]/g, " ").replace(/\s+/g, " ").trim();
const INDICE = new Map<string, Campo>();
for (const campo of CAMPOS) {
  INDICE.set(limpiarEncabezado(ENCABEZADOS_PLANTILLA[campo]), campo);
  for (const s of SINONIMOS[campo]) INDICE.set(limpiarEncabezado(s), campo);
}

/** Qué columna es cada campo. Devuelve también las columnas obligatorias que faltan. */
export function mapearColumnas(encabezados: readonly string[]): { columnas: Partial<Record<Campo, number>>; faltan: Campo[]; ignoradas: string[] } {
  const columnas: Partial<Record<Campo, number>> = {};
  const ignoradas: string[] = [];
  encabezados.forEach((e, i) => {
    const campo = INDICE.get(limpiarEncabezado(e));
    if (campo && columnas[campo] === undefined) columnas[campo] = i;
    else if (e.trim()) ignoradas.push(e.trim());
  });
  const faltan = (["cliente", "direccion", "fecha", "guia", "bultos"] as Campo[]).filter((c) => columnas[c] === undefined);
  return { columnas, faltan, ignoradas };
}

/** Busca la fila de encabezados entre las primeras 10 (muchos Excel traen un título arriba). */
export function buscarEncabezados(filas: readonly (readonly string[])[]): number {
  let mejor = -1;
  let puntos = 0;
  filas.slice(0, 10).forEach((f, i) => {
    const p = f.filter((c) => INDICE.has(limpiarEncabezado(c))).length;
    if (p > puntos) { mejor = i; puntos = p; }
  });
  return puntos >= 3 ? mejor : -1;
}

/** CSV con separador detectado (";" de Excel en español o ","), comillas incluidas. */
export function leerCsv(texto: string): string[][] {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g) ?? []).length >= (primera.match(/,/g) ?? []).length ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]!;
    if (entreComillas) {
      if (ch === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (ch === '"') entreComillas = false;
      else celda += ch;
    } else if (ch === '"') entreComillas = true;
    else if (ch === sep) { fila.push(celda); celda = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += ch;
  }
  if (celda !== "" || fila.length > 0) { fila.push(celda); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}

/** Convierte una celda de Excel a texto como la escribiría una persona (fechas dd-mm-aaaa, horas hh:mm). */
export function celdaATexto(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) {
    // Una hora sola en Excel llega como fecha del 30-12-1899.
    if (c.getUTCFullYear() < 1901) return `${String(c.getUTCHours()).padStart(2, "0")}:${String(c.getUTCMinutes()).padStart(2, "0")}`;
    return `${String(c.getUTCDate()).padStart(2, "0")}-${String(c.getUTCMonth() + 1).padStart(2, "0")}-${c.getUTCFullYear()}`;
  }
  if (typeof c === "boolean") return c ? "Sí" : "No";
  return String(c).trim();
}

/** Revisa que lo que llegó del navegador sea una tabla de textos razonable (nunca se confía en el navegador). */
export function tablaValida(filas: unknown, maxFilas: number, maxColumnas = 60): filas is string[][] {
  return Array.isArray(filas) && filas.length <= maxFilas + 10
    && filas.every((f) => Array.isArray(f) && f.length <= maxColumnas && f.every((c) => typeof c === "string" && c.length <= 500));
}

// --- Valores ----------------------------------------------------------------

/** "9:30", "09:30", "9.30", "930" → "09:30". */
export function normalizarHora(entrada: string): string | null {
  const t = entrada.trim().replace(/\s*(hrs?|h)\.?$/i, "");
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(t) ?? /^(\d{1,2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "$45.990", "45990", "45.990,00" → 45990 (pesos enteros). */
export function normalizarMonto(entrada: string): number | null {
  const t = entrada.replace(/[$\s]/g, "").replace(/,\d{1,2}$/, "").replace(/\./g, "").replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n < 100_000_000 ? n : null;
}

const SI = new Set(["si", "s", "x", "cobrar", "cobro", "1", "true", "por cobrar"]);
const NO = new Set(["", "no", "n", "pagada", "pagado", "0", "false", "factura", "credito"]);

// --- Revisión de filas ------------------------------------------------------

export type Conductor = { id: string; nombre: string; correo: string };

export type DatosFila = {
  cliente: string;
  direccion: string;
  comuna: string;
  contacto?: string;
  telefono?: string;
  fecha: string;
  hora?: string;
  desde?: string;
  hasta?: string;
  guia: string;
  oc?: string;
  bultos: number;
  cobro: "pagada" | "cobrar";
  monto?: number;
  forma?: "transferencia" | "efectivo" | "cualquiera";
  conductor_id?: string;
  notas?: string;
  lat?: number;
  lng?: number;
  fuente?: "nominatim" | "google" | "simulado" | "cache" | "manual";
};

export type FilaRevisada = {
  /** Número de fila en el archivo (como lo ve la persona en Excel). */
  n: number;
  estado: "lista" | "revisar" | "error";
  motivos: string[];
  datos: DatosFila;
};

export type Contexto = {
  conductores: readonly Conductor[];
  /** Guías vivas ya registradas en la empresa (comparadas con `clave`). */
  guiasExistentes: ReadonlySet<string>;
  /** Hoy, en formato ISO (aaaa-mm-dd), en hora de Chile. */
  hoy: string;
};

function buscarConductor(texto: string, conductores: readonly Conductor[]): Conductor | "varios" | null {
  const k = clave(texto);
  if (!k) return null;
  const porCorreo = conductores.find((c) => c.correo.toLowerCase() === k);
  if (porCorreo) return porCorreo;
  const coincidencias = conductores.filter((c) => clave(c.nombre) === k || clave(c.nombre).startsWith(`${k} `));
  if (coincidencias.length > 1) return "varios";
  return coincidencias[0] ?? null;
}

/** Revisa cada fila (ya separada por campo) y la deja lista, por revisar o con error. */
export function revisarFilas(
  filas: readonly { n: number; valores: Partial<Record<Campo, string>> }[],
  ctx: Contexto,
): FilaRevisada[] {
  const guiasDelArchivo = new Map<string, number>();
  for (const f of filas) {
    const g = clave(f.valores.guia ?? "");
    if (g) guiasDelArchivo.set(g, (guiasDelArchivo.get(g) ?? 0) + 1);
  }

  return filas.map(({ n, valores: v }) => {
    const errores: string[] = [];
    const revisar: string[] = [];
    const t = (c: Campo) => (v[c] ?? "").trim();

    const cliente = t("cliente").replace(/\s+/g, " ");
    if (!cliente) errores.push("Falta el cliente (local).");
    const direccion = t("direccion").replace(/\s+/g, " ");
    if (!direccion) errores.push("Falta la dirección.");

    const comunaEscrita = t("comuna");
    const comuna = comunaRM(comunaEscrita);
    if (!comunaEscrita) revisar.push("Falta la comuna: no se puede asignar sector.");
    else if (!comuna) revisar.push(`No reconozco la comuna «${comunaEscrita}».`);

    const guia = t("guia");
    if (!guia) errores.push("Falta el número de guía.");
    else if ((guiasDelArchivo.get(clave(guia)) ?? 0) > 1) errores.push(`La guía ${guia} está repetida en el archivo.`);
    else if (ctx.guiasExistentes.has(clave(guia))) errores.push(`La guía ${guia} ya está registrada.`);

    const bultosTexto = t("bultos");
    const bultos = /^\d+$/.test(bultosTexto) ? Number(bultosTexto) : NaN;
    if (!bultosTexto) errores.push("Faltan los bultos.");
    else if (!Number.isInteger(bultos) || bultos < 1 || bultos > 9999) errores.push(`«${bultosTexto}» no es una cantidad de bultos válida.`);

    const fecha = normalizarFecha(t("fecha")) ?? (/^\d{4}-\d{2}-\d{2}$/.test(t("fecha")) ? t("fecha") : null);
    if (!t("fecha")) errores.push("Falta la fecha.");
    else if (!fecha) errores.push(`«${t("fecha")}» no es una fecha válida (usa 27-10-2026).`);
    else if (fecha < ctx.hoy) revisar.push("La fecha ya pasó.");

    const hora = t("hora") ? normalizarHora(t("hora")) : null;
    if (t("hora") && !hora) errores.push(`«${t("hora")}» no es una hora válida.`);
    const desde = t("desde") ? normalizarHora(t("desde")) : null;
    const hasta = t("hasta") ? normalizarHora(t("hasta")) : null;
    if ((t("desde") && !desde) || (t("hasta") && !hasta)) errores.push("El horario de recepción no es válido.");
    else if (desde && hasta && desde >= hasta) errores.push("El horario de recepción termina antes de empezar.");
    else if (hora && desde && hasta && (hora < desde || hora > hasta)) revisar.push(`La hora ${hora} está fuera del horario de recepción (${desde}–${hasta}).`);

    const cobroTexto = clave(t("cobro"));
    let cobro: "pagada" | "cobrar" = "pagada";
    let monto: number | undefined;
    if (SI.has(cobroTexto)) {
      cobro = "cobrar";
      const m = normalizarMonto(t("monto"));
      if (!m) errores.push("Se marcó cobrar pero falta un monto válido.");
      else monto = m;
    } else if (!NO.has(cobroTexto)) {
      errores.push(`«${t("cobro")}» en «Cobrar al entregar»: escribe Sí o No.`);
    }
    const formaTexto = clave(t("forma"));
    const forma = formaTexto.startsWith("transf") ? "transferencia" : formaTexto.startsWith("efec") ? "efectivo" : cobro === "cobrar" ? "cualquiera" : undefined;

    let telefono: string | undefined;
    if (t("telefono")) {
      const tel = normalizarTelefono(t("telefono"));
      if (tel) telefono = tel;
      else revisar.push(`El teléfono «${t("telefono")}» no es válido: se guarda sin contacto.`);
    } else revisar.push("Sin teléfono de contacto: no se podrá avisar por WhatsApp.");

    let conductorId: string | undefined;
    if (t("conductor")) {
      const c = buscarConductor(t("conductor"), ctx.conductores);
      if (c === "varios") revisar.push(`Hay más de un conductor llamado «${t("conductor")}»: queda sin asignar.`);
      else if (!c) revisar.push(`No encuentro al conductor «${t("conductor")}»: queda sin asignar.`);
      else conductorId = c.id;
    }

    const datos: DatosFila = {
      cliente, direccion, comuna: comuna ?? comunaEscrita, fecha: fecha ?? "", guia, bultos: Number.isFinite(bultos) ? bultos : 0, cobro,
      ...(t("contacto") ? { contacto: t("contacto") } : {}),
      ...(telefono ? { telefono } : {}),
      ...(hora ? { hora } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
      ...(t("oc") ? { oc: t("oc") } : {}),
      ...(monto ? { monto } : {}),
      ...(forma ? { forma } : {}),
      ...(conductorId ? { conductor_id: conductorId } : {}),
      ...(t("notas") ? { notas: t("notas").slice(0, 500) } : {}),
    };
    const estado = errores.length > 0 ? "error" : revisar.length > 0 ? "revisar" : "lista";
    return { n, estado, motivos: [...errores, ...revisar], datos };
  });
}

/** Agrega la ubicación a una fila ya revisada. Si no se encontró o no es segura, la deja por revisar. */
export function conUbicacion(
  f: FilaRevisada,
  u: { lat: number; lng: number; fuente: NonNullable<DatosFila["fuente"]>; segura: boolean } | null,
): FilaRevisada {
  if (f.estado === "error") return f;
  if (!u) {
    return { ...f, estado: "revisar", motivos: [...f.motivos, "No encontré la dirección en el mapa: márcala a mano después de crear."] };
  }
  const datos = { ...f.datos, lat: u.lat, lng: u.lng, fuente: u.fuente };
  if (!u.segura) {
    return { ...f, datos, estado: "revisar", motivos: [...f.motivos, "La ubicación es aproximada: revisa el punto en el mapa."] };
  }
  return { ...f, datos };
}

export function resumen(filas: readonly FilaRevisada[]): { listas: number; revisar: number; errores: number } {
  return {
    listas: filas.filter((f) => f.estado === "lista").length,
    revisar: filas.filter((f) => f.estado === "revisar").length,
    errores: filas.filter((f) => f.estado === "error").length,
  };
}
