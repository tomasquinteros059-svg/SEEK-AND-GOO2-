// Lista de aceptación de la Fase 1 (SPEC 16): "Creas una empresa, invitas a otro
// administrador y a un conductor, cada uno entra con el código de su correo".
// Matías usa la app; aquí se simula con el mismo cliente de Supabase que usa la app.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { codigoDe, entrar, SUPABASE_CLAVE, SUPABASE_URL } from "./ayudas";

const sello = Date.now().toString(36);
const carolina = `carolina.${sello}@cordillera.cl`;
const rodrigo = `rodrigo.${sello}@cordillera.cl`;
const matias = `matias.${sello}@correo.cl`;
const empresa = `Despachos Cordillera ${sello}`;
let equipoUrl = "";
// Cada persona conserva su sesión: pedir otro código antes de 60 s está bloqueado (SPEC 9).
const sesionDe = (quien: string) => path.join(__dirname, "..", "test-results", `sesion-${quien}-${sello}.json`);

test.describe.configure({ mode: "serial" });

test("sin sesión, el panel manda a entrar", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("los Términos están publicados", async ({ page }) => {
  await page.goto("/legal/terminos");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Términos y Condiciones");
});

test("Carolina entra con su código, registra la empresa e invita al equipo", async ({ page }) => {
  await entrar(page, carolina);
  await expect(page).toHaveURL(/\/panel\/empezar\?modo=completo/);

  // Sin aceptar los Términos no avanza.
  await page.getByLabel("Tu nombre y apellido").fill("Carolina Fuentes");
  await page.getByLabel("Tu teléfono").fill("9 1111 1111");
  await page.getByLabel("Nombre de la empresa").fill(empresa);
  await page.getByLabel("Teléfono de contacto de la empresa").fill("22 222 2222");
  await page.getByRole("button", { name: "Crear la empresa" }).click();
  await expect(page.getByText("Para seguir, acepta los Términos")).toBeVisible();

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear la empresa" }).click();
  await page.waitForURL(/\/panel\/[0-9a-f-]{36}\/equipo/);
  equipoUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: `${empresa} · Equipo` })).toBeVisible();

  await page.getByLabel("Correo").fill(rodrigo);
  await page.getByLabel("Como").selectOption("admin");
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(page.getByText(`Invitación creada. Avísale a ${rodrigo}`)).toBeVisible();

  await page.getByLabel("Correo").fill(matias);
  await page.getByLabel("Como").selectOption("conductor");
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(page.getByText(`Invitación creada. Avísale a ${matias}`)).toBeVisible();

  await page.getByLabel("Correo").fill(matias);
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(page.getByText(`Ya hay una invitación pendiente para ${matias}`)).toBeVisible();
  await page.context().storageState({ path: sesionDe("carolina") });
});

test("Rodrigo entra con su código, completa sus datos y acepta ser administrador", async ({ page }) => {
  await entrar(page, rodrigo);
  await expect(page).toHaveURL(/\/panel\/empezar\?modo=perfil/);
  await page.getByLabel("Tu nombre y apellido").fill("Rodrigo Paz");
  await page.getByLabel("Tu teléfono").fill("+56 9 2222 2222");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Guardar mis datos" }).click();

  await expect(page.getByRole("heading", { name: "Te invitaron" })).toBeVisible();
  await page.getByRole("button", { name: "Aceptar" }).click();
  await page.waitForURL(/\/equipo/);
  const personas = page.locator("table.tabla tbody");
  await expect(personas).toContainText("Carolina Fuentes");
  await expect(personas).toContainText("Rodrigo Paz (tú)");
  await page.context().storageState({ path: sesionDe("rodrigo") });
});

test("Matías (app) entra con su código, acepta y sube su licencia; no ve a nadie más", async () => {
  const app = createClient(SUPABASE_URL, SUPABASE_CLAVE, { auth: { persistSession: false } });
  expect((await app.auth.signInWithOtp({ email: matias })).error).toBeNull();
  const { data: sesion, error } = await app.auth.verifyOtp({ email: matias, token: await codigoDe(matias), type: "email" });
  expect(error).toBeNull();
  const id = sesion.user!.id;

  expect((await app.from("usuarios").insert({ id, nombre: "Matías Rojas", telefono: "+56966666666", correo: matias })).error).toBeNull();
  expect((await app.from("consentimientos").insert([
    { usuario_id: id, tipo: "terminos", version: "1.0" },
    { usuario_id: id, tipo: "privacidad", version: "1.0" },
  ])).error).toBeNull();

  const { data: invitaciones } = await app.rpc("mis_invitaciones");
  expect(invitaciones).toHaveLength(1);
  expect((await app.rpc("aceptar_invitacion", { invitacion: invitaciones![0].id })).error).toBeNull();

  const foto = await readFile(path.join(__dirname, "archivos", "licencia-ficticia.jpg"));
  const ruta = `${id}/licencia.jpg`;
  expect((await app.storage.from("documentos").upload(ruta, foto, { contentType: "image/jpeg" })).error).toBeNull();
  expect((await app.from("documentos_conductor").insert({ usuario_id: id, tipo: "licencia", ruta, vence: "2028-05-01" })).error).toBeNull();

  // Lo que la app NO debe poder hacer.
  const { data: otros } = await app.from("usuarios").select("nombre").neq("id", id);
  expect(otros).toEqual([]);
  const trampa = await app.storage.from("documentos").upload(`00000000-0000-0000-0000-000000000000/x.jpg`, foto, { contentType: "image/jpeg" });
  expect(trampa.error).not.toBeNull();
});

test("Carolina ve la licencia de Matías y la aprueba", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesionDe("carolina") })).newPage();
  await page.goto(equipoUrl);
  await expect(page.locator("table.tabla tbody")).toContainText("Matías Rojas");
  const documento = page.locator("article.documento", { hasText: "Matías Rojas" });
  await expect(documento).toContainText("Por revisar");
  await expect(documento.getByRole("img")).toBeVisible();
  await documento.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("Documento aprobado.")).toBeVisible();
  await expect(page.locator("article.documento", { hasText: "Matías Rojas" })).toContainText("Aprobado");
});

test("pedir otro código antes de 60 segundos está bloqueado", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill(carolina);
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByText("Pediste muchos códigos seguidos. Espera un minuto.")).toBeVisible();
});

test("la empresa no se queda sin administradores", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesionDe("rodrigo") })).newPage();
  await page.goto(equipoUrl);
  const filaCarolina = page.locator("tr", { hasText: "Carolina Fuentes" });
  await filaCarolina.getByRole("button", { name: "Suspender" }).click();
  await expect(page.getByText("Acceso suspendido.")).toBeVisible();
  const filaRodrigo = page.locator("tr", { hasText: "Rodrigo Paz" });
  await filaRodrigo.getByRole("button", { name: "Suspender" }).click();
  await expect(page.getByText("La empresa no puede quedarse sin administrador")).toBeVisible();
});
