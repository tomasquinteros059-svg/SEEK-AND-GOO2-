import { paletas, variablesCss } from "@reparto/ui-tokens";

/** Variables CSS de color para el modo claro y el oscuro (SPEC 8), tomadas de `@reparto/ui-tokens`. */
export const cssDelTema = [
  `:root{${variablesCss(paletas.claro)}color-scheme:light}`,
  `@media (prefers-color-scheme: dark){:root{${variablesCss(paletas.oscuro)}color-scheme:dark}}`,
].join("");
