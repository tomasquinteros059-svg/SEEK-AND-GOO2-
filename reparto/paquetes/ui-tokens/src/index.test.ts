import { describe, expect, it } from "vitest";
import { contraste, paletas, paresDeTexto, variablesCss } from "./index";

describe("identidad visual", () => {
  for (const [tema, p] of Object.entries(paletas)) {
    it(`en modo ${tema} todo texto tiene contraste de al menos 4,5 a 1 (SPEC 8)`, () => {
      for (const [texto, fondo] of paresDeTexto) {
        expect(contraste(p[texto], p[fondo]), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("calcula el contraste conocido de blanco sobre negro", () => {
    expect(contraste("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("genera variables CSS con nombres en guiones", () => {
    expect(variablesCss(paletas.claro)).toContain("--marca-tinta:#ffffff;");
  });
});
