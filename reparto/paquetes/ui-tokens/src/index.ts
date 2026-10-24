// Identidad visual de Reparto (SPEC, sección 8). Los valores salen del
// prototipo (`prototipo/app-admin.html`), en modo claro y oscuro.

export type Paleta = {
  fondo: string;
  superficie: string;
  hundido: string;
  tinta: string;
  apagado: string;
  linea: string;
  marca: string;
  marcaTinta: string;
  acento: string;
  acentoTinta: string;
  ok: string;
  okFondo: string;
  aviso: string;
  avisoFondo: string;
  atraso: string;
  atrasoFondo: string;
};

export const claro: Paleta = {
  fondo: "#edf1f5",
  superficie: "#ffffff",
  hundido: "#e3e9ef",
  tinta: "#10212f",
  apagado: "#566676",
  linea: "#cfd8e1",
  marca: "#143b5c", // azul cordillera
  marcaTinta: "#ffffff",
  acento: "#f2b705", // amarillo de señalética vial
  acentoTinta: "#1b1500",
  ok: "#197542", // el del prototipo (#1d7f48) daba 4,3:1 sobre okFondo
  okFondo: "#dff2e6",
  aviso: "#a04a09", // el del prototipo (#b4530b) daba 4,3:1 sobre avisoFondo
  avisoFondo: "#fcebd9",
  atraso: "#b42318",
  atrasoFondo: "#fbe3e1",
};

export const oscuro: Paleta = {
  fondo: "#0a131b",
  superficie: "#122029",
  hundido: "#0e1a22",
  tinta: "#e6edf3",
  apagado: "#91a3b3",
  linea: "#243644",
  marca: "#1d4a70",
  marcaTinta: "#f1f6fa",
  acento: "#f6c430",
  acentoTinta: "#1b1500",
  ok: "#47c07d",
  okFondo: "#12301f",
  aviso: "#f19a55",
  avisoFondo: "#3a2412",
  atraso: "#f26b61",
  atrasoFondo: "#3b1715",
};

export const paletas = { claro, oscuro } as const;
export type Tema = keyof typeof paletas;

/** Nombres de las familias tal como se cargan en Google Fonts / Expo. */
export const tipografias = {
  texto: "Atkinson Hyperlegible",
  titulos: "Archivo",
  cifras: "IBM Plex Mono",
} as const;

export const medidas = {
  /** Mínimo táctil (SPEC 8: 48 × 48 px). */
  toque: 48,
  radio: 12,
  radioGrande: 20,
  espacio: { xs: 4, s: 8, m: 16, l: 24, xl: 32 },
  texto: { chico: 14, normal: 17, grande: 20, titulo: 28 },
} as const;

/** Variables CSS para el panel web: `--marca`, `--acento`, etc. */
export function variablesCss(p: Paleta): string {
  return Object.entries(p)
    .map(([clave, valor]) => `--${clave.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${valor};`)
    .join("");
}

// --- Contraste (WCAG 2.x) -------------------------------------------------

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Color inválido: ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Razón de contraste entre dos colores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Pares texto/fondo que se usan en pantalla y deben leerse bien. */
export const paresDeTexto: readonly (readonly [keyof Paleta, keyof Paleta])[] = [
  ["tinta", "fondo"],
  ["tinta", "superficie"],
  ["apagado", "superficie"],
  ["marcaTinta", "marca"],
  ["acentoTinta", "acento"],
  ["ok", "okFondo"],
  ["aviso", "avisoFondo"],
  ["atraso", "atrasoFondo"],
];
