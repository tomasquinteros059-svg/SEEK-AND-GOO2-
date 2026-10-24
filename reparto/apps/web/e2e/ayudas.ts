import { expect, type Page } from "@playwright/test";

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_CLAVE = process.env.E2E_SUPABASE_ANON_KEY ?? "";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Lee el código de 6 dígitos del último correo que recibió esa dirección (Mailpit, el correo de prueba de Supabase local). */
export async function codigoDe(correo: string): Promise<string> {
  for (let intento = 0; intento < 40; intento++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}`);
    const { messages } = (await r.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const m = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json()) as { Text: string };
      await fetch(`${MAILPIT}/api/v1/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDs: messages.map((x) => x.ID) }),
      });
      const codigo = /\b(\d{6})\b/.exec(m.Text)?.[1];
      if (codigo) return codigo;
    }
    await new Promise((listo) => setTimeout(listo, 500));
  }
  throw new Error(`No llegó el código a ${correo}`);
}

/** Entra al panel con correo y código, como lo haría una persona. */
export async function entrar(page: Page, correo: string): Promise<void> {
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill(correo);
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByRole("heading", { name: "Escribe el código" })).toBeVisible();
  await page.getByLabel("Código").fill(await codigoDe(correo));
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/panel/);
}
