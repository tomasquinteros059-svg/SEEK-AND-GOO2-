// Datos que se piden al registrarse (docs/00-decisiones-etapa-A.md) y sus reglas.
// Las mismas validaciones corren en la app, en el panel y, como respaldo, en la
// base de datos (los `check` de la migración de cuentas).

/** Versión vigente de los Términos y la Política de privacidad (docs/legal). */
export const VERSION_LEGAL = "1.0";

export type Perfil = "admin" | "conductor" | "receptor";

/**
 * Teléfono chileno en formato internacional: `+56` y 9 dígitos.
 * Acepta como lo escribe una persona: `+56 9 1234 5678`, `9 1234 5678`, `09 1234 5678`, `(2) 2345 6789`.
 * Devuelve `null` si no es un número chileno válido.
 */
export function normalizarTelefono(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("56")) d = d.slice(2);
  else if (d.length === 10 && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 9 || !/^[2-9]/.test(d)) return null;
  return `+56${d}`;
}

/** Para mostrar: `+56 9 1234 5678`. */
export function formatearTelefono(normalizado: string): string {
  const m = /^\+56(\d)(\d{4})(\d{4})$/.exec(normalizado);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : normalizado;
}

export function normalizarCorreo(entrada: string): string | null {
  const c = entrada.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) && c.length <= 254 ? c : null;
}

/** Código del correo: exactamente 6 dígitos. Tolera espacios al pegarlo. */
export function normalizarCodigo(entrada: string): string | null {
  const c = entrada.replace(/\s/g, "");
  return /^\d{6}$/.test(c) ? c : null;
}

/** Nombre completo: al menos nombre y apellido. */
export function normalizarNombreCompleto(entrada: string): string | null {
  const n = entrada.trim().replace(/\s+/g, " ");
  if (n.length < 3 || n.length > 120) return null;
  if (n.split(" ").filter((p) => p.length > 0).length < 2) return null;
  if (/[0-9@]/.test(n)) return null;
  return n;
}

export function normalizarNombreEmpresa(entrada: string): string | null {
  const n = entrada.trim().replace(/\s+/g, " ");
  return n.length >= 2 && n.length <= 120 ? n : null;
}

export type DatosRegistro = {
  perfil: Perfil;
  nombre: string;
  telefono: string;
  /** Solo administrador: la empresa que crea. */
  empresa?: string;
  telefonoEmpresa?: string;
  /** Solo conductor: si ya eligió la foto de la licencia. */
  tieneLicencia?: boolean;
  aceptaTerminos: boolean;
};

export type Registro = {
  nombre: string;
  telefono: string;
  empresa?: string;
  telefonoEmpresa?: string;
};

export type Revision =
  | { ok: true; datos: Registro }
  | { ok: false; errores: Partial<Record<keyof DatosRegistro, string>> };

/** Revisa el formulario de registro de cada perfil y devuelve los datos limpios o los errores, campo por campo. */
export function revisarRegistro(d: DatosRegistro): Revision {
  const errores: Partial<Record<keyof DatosRegistro, string>> = {};
  const nombre = normalizarNombreCompleto(d.nombre);
  if (!nombre) errores.nombre = "Escribe tu nombre y apellido.";
  const telefono = normalizarTelefono(d.telefono);
  if (!telefono) errores.telefono = "Escribe un teléfono chileno, por ejemplo +56 9 1234 5678.";

  let empresa: string | null = null;
  let telefonoEmpresa: string | null = null;
  if (d.perfil === "admin") {
    empresa = normalizarNombreEmpresa(d.empresa ?? "");
    if (!empresa) errores.empresa = "Escribe el nombre de la empresa.";
    telefonoEmpresa = normalizarTelefono(d.telefonoEmpresa ?? "");
    if (!telefonoEmpresa) errores.telefonoEmpresa = "Escribe el teléfono de contacto de la empresa.";
  }
  if (d.perfil === "conductor" && !d.tieneLicencia) {
    errores.tieneLicencia = "Falta la foto de tu licencia de conducir.";
  }
  if (!d.aceptaTerminos) errores.aceptaTerminos = "Para seguir, acepta los Términos y la Política de privacidad.";

  if (Object.keys(errores).length > 0 || !nombre || !telefono) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      nombre,
      telefono,
      ...(empresa ? { empresa } : {}),
      ...(telefonoEmpresa ? { telefonoEmpresa } : {}),
    },
  };
}

/**
 * Fecha escrita a la chilena (`01-05-2028`, `1/5/2028`) a formato ISO (`2028-05-01`).
 * Devuelve `null` si no es una fecha real.
 */
export function normalizarFecha(entrada: string): string | null {
  const m = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*$/.exec(entrada);
  if (!m) return null;
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
