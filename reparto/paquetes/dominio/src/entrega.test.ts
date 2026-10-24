import { describe, expect, it } from "vitest";
import { Entrega } from "./entrega";
import { ErrorDeDominio } from "./errores";

const enCamino = () => new Entrega({ id: "E1", estado: "en_camino" });

function codigoDe(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ErrorDeDominio ? e.codigo : "otro";
  }
}

describe("Entrega", () => {
  it("se entrega con foto y mensaje", () => {
    const e = enCamino();
    e.marcarEntregada({ fotos: ["f1"], mensaje: "  Recibió Pedro en el andén 3  " });
    expect(e.estado).toBe("entregada");
    expect(e.mensaje).toBe("Recibió Pedro en el andén 3");
    expect(e.fotos).toEqual(["f1"]);
  });

  it("no se entrega sin foto", () => {
    expect(codigoDe(() => enCamino().marcarEntregada({ fotos: [], mensaje: "ok" }))).toBe("sin_foto");
  });

  it("no se entrega sin mensaje", () => {
    expect(codigoDe(() => enCamino().marcarEntregada({ fotos: ["f1"], mensaje: "   " }))).toBe("sin_mensaje");
  });

  it("'No entregado' exige motivo, foto y mensaje y queda fallida", () => {
    const e = enCamino();
    expect(codigoDe(() => e.marcarNoEntregada({ motivo: "", fotos: ["f1"], mensaje: "x" }))).toBe("sin_motivo");
    e.marcarNoEntregada({ motivo: "Local cerrado", fotos: ["f1"], mensaje: "Cortina abajo a las 10:40" });
    expect(e.estado).toBe("fallida");
    expect(e.motivo).toBe("Local cerrado");
  });

  it("si estaba cancelada y se entregó, gana el hecho físico y pide revisión", () => {
    const e = new Entrega({ id: "E4", estado: "cancelada" });
    e.marcarEntregada({ fotos: ["f1"], mensaje: "Entregado sin señal" });
    expect(e.estado).toBe("entregada");
    expect(e.requiereRevision).toBe(true);
  });

  it("no se cancela algo ya entregado", () => {
    const e = enCamino();
    e.marcarEntregada({ fotos: ["f1"], mensaje: "ok" });
    expect(codigoDe(() => e.cancelar())).toBe("estado_final");
  });

  it("avanzarA no sirve para cerrar", () => {
    expect(codigoDe(() => enCamino().avanzarA("entregada"))).toBe("cierre_sin_datos");
  });

  it("no salta pasos", () => {
    const e = new Entrega({ id: "E2", estado: "asignada" });
    expect(codigoDe(() => e.avanzarA("cerca"))).toBe("paso_invalido");
    e.avanzarA("publicada");
    e.avanzarA("en_camino");
    expect(e.estado).toBe("en_camino");
  });
});
