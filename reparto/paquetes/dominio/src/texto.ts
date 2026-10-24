/** Clave para comparar textos: sin tildes, en minúsculas y con un solo espacio. Igual que `public.clave()` en la base. */
export function clave(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
