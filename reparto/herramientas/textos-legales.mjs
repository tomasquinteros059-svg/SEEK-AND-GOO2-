// Copia los textos legales de docs/legal dentro del código del panel (apps/web/src/lib/textos-legales.ts).
// En Cloudflare no hay disco: el panel no puede leer archivos al responder.
// Corre solo antes de cada compilación del panel (`prebuild`). El archivo generado también va en git,
// para que la revisión de tipos funcione sin compilar antes.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const textos = {
  terminos: readFileSync(join(raiz, "docs/legal/terminos-y-condiciones.md"), "utf8"),
  privacidad: readFileSync(join(raiz, "docs/legal/politica-de-privacidad.md"), "utf8"),
};
const salida = `// GENERADO por herramientas/textos-legales.mjs desde docs/legal. No editar a mano.
export const TEXTOS_LEGALES: Record<"terminos" | "privacidad", string> = ${JSON.stringify(textos, null, 2)};
`;
writeFileSync(join(raiz, "apps/web/src/lib/textos-legales.ts"), salida);
console.log("textos legales copiados");
