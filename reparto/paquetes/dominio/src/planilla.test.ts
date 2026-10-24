import { describe, expect, it } from "vitest";
import { comunaRM } from "./comunas";
import {
  buscarEncabezados, conUbicacion, leerCsv, mapearColumnas, normalizarHora, normalizarMonto, resumen, revisarFilas,
  type Campo,
} from "./planilla";
import { claveDireccion, leerGoogle, leerNominatim, ubicarSimulado } from "./ubicacion";

const ctx = {
  conductores: [
    { id: "c1", nombre: "Matías Rojas", correo: "matias@correo.cl" },
    { id: "c2", nombre: "Juan Pérez", correo: "juan.perez@correo.cl" },
    { id: "c3", nombre: "Juan Soto", correo: "juan.soto@correo.cl" },
  ],
  guiasExistentes: new Set(["g-999"]),
  hoy: "2026-10-26",
};

const base: Partial<Record<Campo, string>> = {
  cliente: "Jumbo La Florida", direccion: "Av. Vicuña Mackenna 7110", comuna: "la florida", telefono: "9 5555 5555",
  fecha: "27-10-2026", hora: "9:30", desde: "07:00", hasta: "11:00", guia: "G-1001", bultos: "12", cobro: "No",
};
const una = (v: Partial<Record<Campo, string>>, extra: Partial<typeof ctx> = {}) =>
  revisarFilas([{ n: 2, valores: { ...base, ...v } }], { ...ctx, ...extra })[0]!;

describe("columnas", () => {
  it("reconoce encabezados escritos de otra forma", () => {
    const { columnas, faltan } = mapearColumnas(["Local", "Dirección de entrega", "COMUNA", "N° Guía", "Cajas", "Fecha entrega", "Chofer", "Algo raro"]);
    expect(columnas).toMatchObject({ cliente: 0, direccion: 1, comuna: 2, guia: 3, bultos: 4, fecha: 5, conductor: 6 });
    expect(faltan).toEqual([]);
  });

  it("dice qué columnas obligatorias faltan", () => {
    expect(mapearColumnas(["Cliente", "Dirección"]).faltan).toEqual(["fecha", "guia", "bultos"]);
  });

  it("encuentra los encabezados aunque haya un título arriba", () => {
    expect(buscarEncabezados([["Despachos del martes"], [], ["Cliente", "Dirección", "Guía", "Bultos"]])).toBe(2);
  });
});

describe("CSV", () => {
  it("lee el punto y coma de Excel en español, con comillas", () => {
    expect(leerCsv('Cliente;Dirección\n"Jumbo; Florida";"Av. 1"\r\nLíder;Calle 2\n')).toEqual([
      ["Cliente", "Dirección"], ["Jumbo; Florida", "Av. 1"], ["Líder", "Calle 2"],
    ]);
  });
  it("y la coma", () => {
    expect(leerCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("valores", () => {
  it("horas", () => {
    expect(normalizarHora("9:30")).toBe("09:30");
    expect(normalizarHora("930")).toBe("09:30");
    expect(normalizarHora("14 hrs")).toBe("14:00");
    expect(normalizarHora("25:00")).toBeNull();
  });
  it("montos chilenos", () => {
    expect(normalizarMonto("$45.990")).toBe(45990);
    expect(normalizarMonto("45.990,00")).toBe(45990);
    expect(normalizarMonto("gratis")).toBeNull();
  });
  it("comunas", () => {
    expect(comunaRM("NUNOA")).toBe("Ñuñoa");
    expect(comunaRM("stgo")).toBe("Santiago");
    expect(comunaRM("Viña del Mar")).toBeNull();
  });
});

describe("revisión de filas", () => {
  it("una fila completa queda lista y normalizada", () => {
    const f = una({ conductor: "matias@correo.cl", oc: "OC-77" });
    expect(f.estado).toBe("lista");
    expect(f.datos).toMatchObject({
      comuna: "La Florida", telefono: "+56955555555", fecha: "2026-10-27", hora: "09:30", bultos: 12,
      cobro: "pagada", conductor_id: "c1", oc: "OC-77",
    });
  });

  it.each<[string, Partial<Record<Campo, string>>]>([
    ["sin guía", { guia: "" }],
    ["sin cliente", { cliente: "" }],
    ["bultos en cero", { bultos: "0" }],
    ["bultos con texto", { bultos: "doce" }],
    ["fecha imposible", { fecha: "31-02-2026" }],
    ["horario al revés", { desde: "12:00", hasta: "08:00" }],
    ["cobrar sin monto", { cobro: "Sí", monto: "" }],
    ["guía ya registrada", { guia: "G-999" }],
  ])("%s → error", (_, v) => {
    expect(una(v).estado).toBe("error");
  });

  it.each<[string, Partial<Record<Campo, string>>]>([
    ["comuna desconocida", { comuna: "Viña del Mar" }],
    ["teléfono inválido", { telefono: "123" }],
    ["sin teléfono", { telefono: "" }],
    ["conductor que no existe", { conductor: "Pedro" }],
    ["dos conductores con el mismo nombre", { conductor: "Juan" }],
    ["hora fuera del horario de recepción", { hora: "15:00" }],
    ["fecha pasada", { fecha: "01-10-2026" }],
  ])("%s → por revisar", (_, v) => {
    const f = una(v);
    expect(f.estado).toBe("revisar");
    expect(f.motivos.length).toBeGreaterThan(0);
  });

  it("cobro con monto y forma de pago", () => {
    expect(una({ cobro: "si", monto: "$22.500", forma: "Efectivo" }).datos).toMatchObject({ cobro: "cobrar", monto: 22500, forma: "efectivo" });
  });

  it("una guía repetida dentro del archivo marca las dos filas", () => {
    const filas = revisarFilas([{ n: 2, valores: base }, { n: 3, valores: base }], ctx);
    expect(filas.map((f) => f.estado)).toEqual(["error", "error"]);
  });

  it("cuenta listas, por revisar y con error", () => {
    const filas = revisarFilas([
      { n: 2, valores: base },
      { n: 3, valores: { ...base, guia: "G-2", telefono: "" } },
      { n: 4, valores: { ...base, guia: "" } },
    ], ctx);
    expect(resumen(filas)).toEqual({ listas: 1, revisar: 1, errores: 1 });
  });
});

describe("ubicación", () => {
  it("una dirección no encontrada o aproximada queda por revisar", () => {
    const f = una({});
    expect(conUbicacion(f, null).estado).toBe("revisar");
    expect(conUbicacion(f, { lat: -33.5, lng: -70.6, fuente: "google", segura: false }).estado).toBe("revisar");
    expect(conUbicacion(f, { lat: -33.5, lng: -70.6, fuente: "google", segura: true })).toMatchObject({ estado: "lista", datos: { lat: -33.5 } });
  });

  it("lee Nominatim y exige número y comuna", () => {
    const r = [{ lat: "-33.5206", lon: "-70.5986", addresstype: "building", address: { house_number: "7110", city: "La Florida" } }];
    expect(leerNominatim(r, "La Florida")).toEqual({ lat: -33.5206, lng: -70.5986, fuente: "nominatim", segura: true });
    expect(leerNominatim(r, "Ñuñoa")?.segura).toBe(false);
    expect(leerNominatim([], "La Florida")).toBeNull();
    expect(leerNominatim([{ lat: "40.4", lon: "-3.7" }], "")).toBeNull();
  });

  it("lee Google y desconfía de lo aproximado", () => {
    const ok = { status: "OK", results: [{ geometry: { location: { lat: -33.45, lng: -70.6 }, location_type: "ROOFTOP" } }] };
    expect(leerGoogle(ok)?.segura).toBe(true);
    const aprox = { status: "OK", results: [{ partial_match: true, geometry: { location: { lat: -33.45, lng: -70.6 }, location_type: "ROOFTOP" } }] };
    expect(leerGoogle(aprox)?.segura).toBe(false);
    expect(leerGoogle({ status: "ZERO_RESULTS" })).toBeNull();
  });

  it("el simulado es estable y cae en Santiago", () => {
    const a = ubicarSimulado("Irarrázaval 3410", "Ñuñoa");
    expect(a).toEqual(ubicarSimulado("irarrazaval  3410", "nunoa"));
    expect(a!.lat).toBeGreaterThan(-33.7);
    expect(a!.lat).toBeLessThan(-33.2);
    expect(ubicarSimulado("Calle sin numero", "Santiago")).toBeNull();
  });

  it("la clave de dirección coincide con la de la base", () => {
    expect(claveDireccion("Av. Vicuña  Mackenna 7110", "La Florida")).toBe("av. vicuna mackenna 7110, la florida");
  });
});
