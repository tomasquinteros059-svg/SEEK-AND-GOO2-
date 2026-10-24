import { describe, expect, it } from "vitest";
import {
  formatearTelefono, normalizarCodigo, normalizarFecha, normalizarCorreo, normalizarNombreCompleto,
  normalizarTelefono, revisarRegistro,
} from "./perfil";

describe("teléfono chileno", () => {
  it.each([
    ["+56 9 1234 5678", "+56912345678"],
    ["912345678", "+56912345678"],
    ["09 1234 5678", "+56912345678"],
    ["(2) 2345 6789", "+56223456789"],
    ["56-9-8765-4321", "+56987654321"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it.each(["12345", "+54 9 11 2345 6789", "012345678", "", "abc"])("rechaza %s", (entrada) => {
    expect(normalizarTelefono(entrada)).toBeNull();
  });

  it("se muestra con espacios", () => {
    expect(formatearTelefono("+56912345678")).toBe("+56 9 1234 5678");
  });
});

describe("correo, código y nombre", () => {
  it("normaliza el correo", () => {
    expect(normalizarCorreo("  Carolina@Cordillera.CL ")).toBe("carolina@cordillera.cl");
    expect(normalizarCorreo("carolina@")).toBeNull();
  });

  it("el código son 6 dígitos, aunque se pegue con espacios", () => {
    expect(normalizarCodigo("123 456")).toBe("123456");
    expect(normalizarCodigo("12345")).toBeNull();
    expect(normalizarCodigo("12345a")).toBeNull();
  });

  it("el nombre completo lleva nombre y apellido", () => {
    expect(normalizarNombreCompleto("  Matías   Rojas ")).toBe("Matías Rojas");
    expect(normalizarNombreCompleto("Matías")).toBeNull();
    expect(normalizarNombreCompleto("matias@correo.cl x")).toBeNull();
  });
});

describe("registro por perfil (decisiones de la Etapa A)", () => {
  const base = { nombre: "Matías Rojas", telefono: "9 6666 6666", aceptaTerminos: true };

  it("el conductor necesita la foto de su licencia", () => {
    const r = revisarRegistro({ ...base, perfil: "conductor", tieneLicencia: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.tieneLicencia).toBeDefined();
    expect(revisarRegistro({ ...base, perfil: "conductor", tieneLicencia: true }).ok).toBe(true);
  });

  it("el administrador crea su empresa con nombre y teléfono de contacto", () => {
    const r = revisarRegistro({ ...base, perfil: "admin", empresa: "Despachos Cordillera SpA", telefonoEmpresa: "22 222 2222" });
    expect(r).toEqual({
      ok: true,
      datos: { nombre: "Matías Rojas", telefono: "+56966666666", empresa: "Despachos Cordillera SpA", telefonoEmpresa: "+56222222222" },
    });
    const sinEmpresa = revisarRegistro({ ...base, perfil: "admin" });
    expect(sinEmpresa.ok).toBe(false);
  });

  it("nadie se registra sin aceptar los Términos", () => {
    const r = revisarRegistro({ ...base, perfil: "receptor", aceptaTerminos: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.aceptaTerminos).toBeDefined();
  });

  it("devuelve todos los errores juntos, campo por campo", () => {
    const r = revisarRegistro({ perfil: "admin", nombre: "x", telefono: "1", aceptaTerminos: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["aceptaTerminos", "empresa", "nombre", "telefono", "telefonoEmpresa"]);
  });
});

describe("fecha chilena", () => {
  it("convierte dd-mm-aaaa a ISO", () => {
    expect(normalizarFecha("01-05-2028")).toBe("2028-05-01");
    expect(normalizarFecha("1/5/2028")).toBe("2028-05-01");
  });
  it("rechaza fechas que no existen", () => {
    expect(normalizarFecha("31-02-2028")).toBeNull();
    expect(normalizarFecha("2028-05-01")).toBeNull();
  });
});
