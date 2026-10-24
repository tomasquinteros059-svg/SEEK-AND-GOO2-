import { describe, expect, it } from "vitest";
import { ESTADOS_ENTREGA, esEstado, esFinal, puedePasar, siguientes } from "./estados";

describe("estados de una entrega", () => {
  it("recorre el camino feliz de la SPEC", () => {
    const camino = ["borrador", "asignada", "publicada", "en_camino", "cerca", "en_destino", "entregada"] as const;
    for (let i = 0; i < camino.length - 1; i++) {
      expect(puedePasar(camino[i]!, camino[i + 1]!), `${camino[i]} → ${camino[i + 1]}`).toBe(true);
    }
  });

  it("de un estado final no se sale", () => {
    for (const final of ["entregada", "fallida", "cancelada"] as const) {
      expect(esFinal(final)).toBe(true);
      expect(siguientes(final)).toEqual([]);
    }
  });

  it("no se entrega algo que nunca se publicó", () => {
    expect(puedePasar("asignada", "entregada")).toBe(false);
    expect(puedePasar("borrador", "en_camino")).toBe(false);
  });

  it("todo estado tiene su regla", () => {
    for (const e of ESTADOS_ENTREGA) expect(Array.isArray(siguientes(e))).toBe(true);
  });

  it("reconoce estados válidos", () => {
    expect(esEstado("cerca")).toBe(true);
    expect(esEstado("incidencia")).toBe(false);
    expect(esEstado(3)).toBe(false);
  });
});
