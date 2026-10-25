// Fase 3 en el panel: publicar el día y ver en vivo lo que hace el conductor
// (estado, mensaje, foto, ubicación y lo que concluyó el Agente de Entregas), sin recargar.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { codigoDe, entrar, SUPABASE_CLAVE, SUPABASE_URL } from "./ayudas";

const sello = Date.now().toString(36);
const carolina = `carolina.f3.${sello}@cordillera.cl`;
const matias = `matias.f3.${sello}@correo.cl`;
const sesion = path.join(__dirname, "..", "test-results", `sesion-f3-${sello}.json`);
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
let base = "";
let app: SupabaseClient;

test.describe.configure({ mode: "serial" });

test("preparar: empresa, Matías como conductor y dos entregas de hoy", async ({ page }) => {
  await entrar(page, carolina);
  await page.getByLabel("Tu nombre y apellido").fill("Carolina Fuentes");
  await page.getByLabel("Tu teléfono").fill("9 1111 1111");
  await page.getByLabel("Nombre de la empresa").fill(`Despachos ${sello}`);
  await page.getByLabel("Teléfono de contacto de la empresa").fill("22 222 2222");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear la empresa" }).click();
  await page.waitForURL(/\/equipo/);
  base = new URL(page.url()).pathname.replace(/\/equipo$/, "");
  await page.getByLabel("Correo").fill(matias);
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(page.getByText(`Invitación creada. Avísale a ${matias}`)).toBeVisible();

  app = createClient(SUPABASE_URL, SUPABASE_CLAVE, { auth: { persistSession: false } });
  await app.auth.signInWithOtp({ email: matias });
  const { data } = await app.auth.verifyOtp({ email: matias, token: await codigoDe(matias), type: "email" });
  await app.from("usuarios").insert({ id: data.user!.id, nombre: "Matías Rojas", telefono: "+56966666666", correo: matias });
  const { data: inv } = await app.rpc("mis_invitaciones");
  await app.rpc("aceptar_invitacion", { invitacion: inv![0].id });

  for (const [cliente, guia] of [["Jumbo La Florida", "G-31"], ["Líder Ñuñoa", "G-32"]] as const) {
    await page.goto(`${base}/entregas?fecha=${hoy}`);
    await page.getByText("Nueva entrega").click();
    await page.getByLabel("Cliente (local)").fill(cliente);
    await page.getByLabel("Dirección").fill("Av. Ficticia 123");
    await page.getByLabel("Comuna").selectOption("La Florida");
    await page.getByLabel("N° guía").fill(guia);
    await page.getByLabel("Bultos").fill("12");
    await page.getByLabel("Teléfono contacto").fill("9 5555 5555");
    await page.getByLabel("Conductor", { exact: true }).selectOption({ label: "Matías Rojas" });
    await page.getByRole("button", { name: "Crear entrega" }).click();
    await expect(page.getByText("Entrega creada.")).toBeVisible();
  }
  await page.context().storageState({ path: sesion });
});

test("Carolina publica el día y ve en vivo la entrega con incidencia de Matías", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesion })).newPage();
  await page.goto(`${base}/entregas?fecha=${hoy}`);
  await page.getByRole("button", { name: "Publicar el día (2)" }).click();
  await expect(page.getByText("Se publicaron 2 entregas: los conductores ya las ven.")).toBeVisible();
  await expect(page.getByText("En vivo")).toBeVisible({ timeout: 15_000 });

  // Matías (con el mismo cliente que usa la app) inicia la ruta y entrega G-31 con un problema.
  const { data: lista } = await app.rpc("mis_entregas_del_dia", { empresa: base.split("/")[2], dia: hoy });
  const g31 = (lista as { id: string; empresa_id: string; guia: string }[]).find((e) => e.guia === "G-31")!;
  await app.rpc("iniciar_jornada", { jornada: crypto.randomUUID(), empresa: g31.empresa_id, dia: hoy, ocurrido_en: new Date().toISOString() });
  const foto = crypto.randomUUID();
  const ruta = `${g31.empresa_id}/${g31.id}/${foto}.jpg`;
  expect((await app.storage.from("entregas").upload(ruta, await readFile(path.join(__dirname, "archivos", "guia-firmada.jpg")), { contentType: "image/jpeg" })).error).toBeNull();
  expect((await app.rpc("registrar_adjunto", { adjunto: foto, entrega: g31.id, tipo: "guia", ruta })).data).toBe("ok");
  const evento = crypto.randomUUID();
  expect((await app.rpc("registrar_evento", {
    evento, entrega: g31.id, tipo: "entregada", ocurrido_en: new Date().toISOString(),
    mensaje: "Recibió Pedro, pero 2 cajas venían dañadas", lat: -33.5206, lng: -70.5986, fotos: [foto],
  })).data).toBe("ok");
  const { data: revision } = await app.functions.invoke("agente-entregas", { body: { accion: "revisar", evento_id: evento } });
  expect(revision).toMatchObject({ foto_ok: true, clase: "incidencia", urgente: true });

  // Sin recargar: la fila cambia sola.
  const fila = page.getByRole("row", { name: /G-31/ });
  await expect(fila).toContainText("Entregada", { timeout: 15_000 });
  await expect(fila).toContainText("Urgente");
  await expect(page.getByRole("row", { name: /G-32/ })).toContainText("Publicada");
});

test("el detalle muestra mensaje, foto, ubicación y el mensaje propuesto para el cliente, que se puede corregir", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: sesion })).newPage();
  await page.goto(`${base}/entregas?fecha=${hoy}`);
  await page.getByRole("link", { name: "Jumbo La Florida" }).click();
  await expect(page.getByRole("heading", { name: /Jumbo La Florida · guía G-31/ })).toBeVisible();
  await expect(page.getByText("Recibió Pedro, pero 2 cajas venían dañadas", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver ubicación" })).toHaveAttribute("href", /-33\.5206,-70\.5986/);
  await expect(page.getByRole("img", { name: /Foto de la guía/ })).toBeVisible();
  const agente = page.getByLabel("Agente de Entregas");
  await expect(agente).toContainText("Entregada con incidencia");
  const mensaje = page.getByLabel("Mensaje para el cliente (propuesto por el agente)");
  await expect(mensaje).toHaveValue(/2 cajas venían dañadas/);
  await mensaje.fill("Hola, entregamos su pedido (guía G-31). Dos cajas llegaron dañadas: le contactaremos para reponerlas.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Mensaje para el cliente (propuesto por el agente)")).toHaveValue(/le contactaremos para reponerlas/);
});
