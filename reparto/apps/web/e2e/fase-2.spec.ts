// Lista de aceptación de la Fase 2 (SPEC 16): "Subes un Excel de 50 filas y ves las listas,
// las por revisar y las con error; las entregas aparecen en el mapa en su sector".
// Las direcciones se ubican con el proveedor simulado (GEOCODER=simulado): no sale nada a internet.
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { codigoDe, entrar, SUPABASE_CLAVE, SUPABASE_URL } from "./ayudas";

const sello = Date.now().toString(36);
const carolina = `carolina.f2.${sello}@cordillera.cl`;
const matias = `matias.f2.${sello}@correo.cl`;
const sesion = path.join(__dirname, "..", "test-results", `sesion-f2-${sello}.json`);
let base = "";

test.describe.configure({ mode: "serial" });

test("preparar: Carolina con su empresa, y Matías como conductor", async ({ page }) => {
  await entrar(page, carolina);
  await page.getByLabel("Tu nombre y apellido").fill("Carolina Fuentes");
  await page.getByLabel("Tu teléfono").fill("9 1111 1111");
  await page.getByLabel("Nombre de la empresa").fill(`Despachos Cordillera ${sello}`);
  await page.getByLabel("Teléfono de contacto de la empresa").fill("22 222 2222");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear la empresa" }).click();
  await page.waitForURL(/\/equipo/);
  base = new URL(page.url()).pathname.replace(/\/equipo$/, "");
  await page.getByLabel("Correo").fill(matias);
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(page.getByText(`Invitación creada. Avísale a ${matias}`)).toBeVisible();
  await page.context().storageState({ path: sesion });

  const app = createClient(SUPABASE_URL, SUPABASE_CLAVE, { auth: { persistSession: false } });
  await app.auth.signInWithOtp({ email: matias });
  const { data } = await app.auth.verifyOtp({ email: matias, token: await codigoDe(matias), type: "email" });
  await app.from("usuarios").insert({ id: data.user!.id, nombre: "Matías Rojas", telefono: "+56966666666", correo: matias });
  const { data: inv } = await app.rpc("mis_invitaciones");
  expect((await app.rpc("aceptar_invitacion", { invitacion: inv![0].id })).error).toBeNull();
});

test("crea los sectores Oriente y Sur", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesion })).newPage();
  await page.goto(`${base}/sectores`);
  const nuevo = page.locator("section.tarjeta", { hasText: "Nuevo sector" });
  await nuevo.getByLabel("Nombre").fill("Oriente");
  for (const c of ["Providencia", "Ñuñoa", "Las Condes", "Macul"]) await nuevo.getByLabel(c, { exact: true }).check();
  await nuevo.getByRole("button", { name: "Crear sector" }).click();
  await expect(page.getByText("Sector creado.")).toBeVisible();
  await page.reload();
  const otro = page.locator("section.tarjeta", { hasText: "Nuevo sector" });
  await expect(otro.getByLabel("Providencia (en otro sector)")).toBeDisabled();
  await otro.getByLabel("Nombre").fill("Sur");
  for (const c of ["La Florida", "Puente Alto", "Maipú", "Santiago"]) await otro.getByLabel(c, { exact: true }).check();
  await otro.getByRole("button", { name: "Crear sector" }).click();
  await expect(page.getByText("Sector creado.")).toBeVisible();
});

test("sube el Excel de 50 filas y ve listas, por revisar y con error", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesion })).newPage();
  await page.goto(`${base}/cargar`);
  await page.getByLabel("Archivo").setInputFiles(path.join(__dirname, "archivos", "entregas-50.xlsx"));
  await page.getByRole("button", { name: "Ver vista previa" }).click();
  await page.waitForURL(/\/cargar\/[0-9a-f-]{36}/);

  // Termina de ubicar las direcciones y queda: 41 listas, 5 por revisar, 4 con error.
  await expect(page.getByRole("button", { name: "Crear 46 entregas" })).toBeEnabled({ timeout: 30_000 });
  const cifras = page.getByLabel("Resultado de la revisión");
  await expect(cifras.getByRole("button", { name: /41\s*Listas/ })).toBeVisible();
  await expect(cifras.getByRole("button", { name: /5\s*Por revisar/ })).toBeVisible();
  await expect(cifras.getByRole("button", { name: /4\s*Con error/ })).toBeVisible();
  const filas = page.getByRole("table", { name: "Filas del archivo" });
  await expect(filas).toContainText("La guía G-50001 está repetida en el archivo.");
  await expect(filas).toContainText("«0» no es una cantidad de bultos válida.");
  await expect(filas).toContainText("No reconozco la comuna «Viña del Mar».");
  await expect(filas).toContainText("No encuentro al conductor «Conductor Inexistente»");
  await expect(filas).toContainText("No encontré la dirección en el mapa");

  await page.getByRole("button", { name: "Crear 46 entregas" }).click();
  await page.waitForURL(/\/entregas\?fecha=2030-01-15/);
  await expect(page.getByText("Se crearon 46 entregas.")).toBeVisible();
  const resumen = page.getByLabel("Resumen del día");
  await expect(resumen).toContainText("46entregas");
  await expect(resumen).toContainText("1sin ubicación");
  // La mitad de las filas listas venía con «Matías Rojas»: quedan asignadas.
  await expect(page.getByRole("combobox", { name: "Conductor de la guía G-50003" })).toHaveValue(/.+/);
  await expect(page.getByRole("row", { name: /G-50003/ })).toContainText("Asignada");
  await expect(page.getByRole("row", { name: /G-50002/ })).toContainText("Sin asignar");
});

test("las entregas aparecen en el mapa en su sector, y la que faltaba se marca a mano", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesion })).newPage();
  await page.goto(`${base}/mapa?fecha=2030-01-15`);
  await expect(page.getByRole("list", { name: "Entregas del sector Oriente" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Entregas del sector Sur" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sin ubicación (1)" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Entregas del sector Sur" })).toContainText("Jumbo La Florida 17");

  const mapa = page.getByLabel("Mapa de entregas");
  await expect(mapa).toHaveAttribute("data-marcadores", "45");
  await expect(page.locator(".marcador")).toHaveCount(45);

  await page.getByRole("button", { name: "Marcar en el mapa" }).click();
  await expect(page.getByText("Haz clic en el mapa donde está")).toBeVisible();
  await mapa.click({ position: { x: 200, y: 200 } });
  await expect(page.getByText("Ubicación de Acuenta Ñuñoa Sur guardada.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sin ubicación/ })).toHaveCount(0);
  await expect(page.locator(".marcador")).toHaveCount(46);
});

test("asigna un conductor y crea una entrega a mano reconociendo al cliente", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesion })).newPage();
  await page.goto(`${base}/entregas?fecha=2030-01-15`);
  const fila = page.getByRole("row", { name: /G-50002/ });
  await fila.getByRole("combobox").selectOption({ label: "Matías Rojas" });
  await fila.getByRole("button", { name: "Asignar" }).click();
  await expect(page.getByRole("row", { name: /G-50002/ })).toContainText("Asignada");

  await page.getByText("Nueva entrega").click();
  await page.getByLabel("Cliente (local)").fill("Jumbo La Florida 17");
  await expect(page.getByLabel("Dirección")).not.toHaveValue("");
  await page.getByLabel("N° guía").fill("G-MANUAL-1");
  await page.getByLabel("Bultos").fill("7");
  await page.getByLabel("Teléfono contacto").fill("9 6000 1016");
  await page.getByRole("button", { name: "Crear entrega" }).click();
  await expect(page.getByText("Entrega creada.")).toBeVisible();
  await expect(page.getByRole("row", { name: /G-MANUAL-1/ })).toContainText("Jumbo La Florida 17");

  // La misma guía no se puede volver a crear.
  await page.getByText("Nueva entrega").click();
  await page.getByLabel("Cliente (local)").fill("Jumbo La Florida 17");
  await page.getByLabel("N° guía").fill("G-MANUAL-1");
  await page.getByLabel("Bultos").fill("1");
  await page.getByRole("button", { name: "Crear entrega" }).click();
  await expect(page.getByText("La guía G-MANUAL-1 ya está registrada.")).toBeVisible();
});
