// Fase 1 en la app: un conductor invitado entra con su código, se registra con su
// licencia y acepta la invitación. La empresa y la invitación las prepara
// "Carolina" con el mismo cliente de Supabase que usa el panel.
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const URL_SUPABASE = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const CLAVE = process.env.E2E_SUPABASE_ANON_KEY ?? "";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const sello = Date.now().toString(36);
const carolina = `carolina.app.${sello}@cordillera.cl`;
const matias = `matias.app.${sello}@correo.cl`;

async function codigoDe(correo: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const r = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}`)).json()) as { messages: { ID: string }[] };
    if (r.messages.length) {
      const m = (await (await fetch(`${MAILPIT}/api/v1/message/${r.messages[0]!.ID}`)).json()) as { Text: string };
      const c = /\b(\d{6})\b/.exec(m.Text)?.[1];
      if (c) return c;
    }
    await new Promise((x) => setTimeout(x, 500));
  }
  throw new Error(`No llegó el código a ${correo}`);
}

test.beforeAll(async () => {
  const panel = createClient(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
  await panel.auth.signInWithOtp({ email: carolina });
  const { data } = await panel.auth.verifyOtp({ email: carolina, token: await codigoDe(carolina), type: "email" });
  const id = data.user!.id;
  await panel.from("usuarios").insert({ id, nombre: "Carolina Fuentes", telefono: "+56911111111", correo: carolina });
  const { data: empresa } = await panel.rpc("crear_empresa", { nombre: "Despachos Cordillera SpA", telefono_contacto: "+56222222222" });
  const { error } = await panel.from("invitaciones").insert({ empresa_id: empresa, correo: matias, rol: "conductor", invitada_por: id });
  expect(error).toBeNull();
});

test("el conductor entra, se registra con su licencia y acepta la invitación", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Entra con tu correo")).toBeVisible();
  await page.getByLabel("Correo").fill(matias);
  await page.getByText("Enviarme el código").click();
  await expect(page.getByText("Escribe el código")).toBeVisible();
  await page.getByLabel("Código").fill(await codigoDe(matias));
  await page.getByText("Entrar", { exact: true }).click();

  await expect(page.getByText("¿Cómo vas a usar la app?")).toBeVisible();
  await page.getByText("Soy conductor").last().click();

  // Sin licencia ni Términos no avanza.
  await page.getByText("Crear mi cuenta").click();
  await expect(page.getByText("Falta la foto de tu licencia de conducir.")).toBeVisible();

  await page.getByLabel("Nombre y apellido").fill("Matías Rojas");
  await page.getByLabel("Teléfono").fill("9 6666 6666");
  const [selector] = await Promise.all([page.waitForEvent("filechooser"), page.getByText("Elegir", { exact: true }).click()]);
  await selector.setFiles(path.join(__dirname, "licencia-ficticia.jpg"));
  await expect(page.getByLabel("Foto de tu licencia")).toBeVisible();
  await expect(page.getByText("Falta la foto de tu licencia de conducir.")).toBeHidden();
  await page.getByLabel("Vence (opcional)").fill("01-05-2028");
  await page.getByRole("checkbox").click();
  await page.getByText("Crear mi cuenta").click();

  await expect(page.getByText("Hola, Matías")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Despachos Cordillera SpA te invitó")).toBeVisible();
  await expect(page.getByText("Licencia de conducir · vence 01-05-2028")).toBeVisible();
  await page.getByText("Aceptar", { exact: true }).click();
  await expect(page.getByText("Ahora trabajas con Despachos Cordillera SpA.")).toBeVisible();
  await expect(page.getByText("Despachos Cordillera SpA · Conductor")).toBeVisible();
});
