// Fase 3 en la app (SPEC 16): "Con dos teléfonos haces el día de Matías y el administrador ve cada estado cambiar".
// Aquí: la app del conductor en su versión web + Carolina con el mismo cliente de Supabase que usa el panel.
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_SUPABASE = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const CLAVE = process.env.E2E_SUPABASE_ANON_KEY ?? "";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const sello = Date.now().toString(36);
const carolina = `carolina.dia.${sello}@cordillera.cl`;
const matias = `matias.dia.${sello}@correo.cl`;
const archivo = (n: string) => path.join(__dirname, n);
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

let panel: SupabaseClient;
let empresa = "";

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

async function foto(page: Page, boton: string, nombre: string) {
  const [selector] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: boton, exact: true }).click()]);
  await selector.setFiles(archivo(nombre));
}

test.describe.configure({ mode: "serial" });

test("Carolina crea la empresa e invita a Matías", async () => {
  panel = createClient(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
  await panel.auth.signInWithOtp({ email: carolina });
  const { data } = await panel.auth.verifyOtp({ email: carolina, token: await codigoDe(carolina), type: "email" });
  await panel.from("usuarios").insert({ id: data.user!.id, nombre: "Carolina Fuentes", telefono: "+56911111111", correo: carolina });
  empresa = (await panel.rpc("crear_empresa", { nombre: "Despachos Cordillera SpA", telefono_contacto: "+56222222222" })).data as string;
  expect((await panel.from("invitaciones").insert({ empresa_id: empresa, correo: matias, rol: "conductor", invitada_por: data.user!.id })).error).toBeNull();
});

test("Matías entra en la app, se registra y acepta", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Correo").fill(matias);
  await page.getByText("Enviarme el código").click();
  await page.getByLabel("Código").fill(await codigoDe(matias));
  await page.getByText("Entrar", { exact: true }).click();
  await page.getByText("Soy conductor").last().click();
  await page.getByLabel("Nombre y apellido").fill("Matías Rojas");
  await page.getByLabel("Teléfono").fill("9 6666 6666");
  await foto(page, "Elegir", "licencia-ficticia.jpg");
  await page.getByRole("checkbox").click();
  await page.getByText("Crear mi cuenta").click();
  await page.getByText("Aceptar", { exact: true }).click();
  await expect(page.getByText("Ahora trabajas con Despachos Cordillera SpA.")).toBeVisible();
  await page.context().storageState({ path: path.join(__dirname, "..", "test-results", `matias-${sello}.json`) });
});

test("Carolina carga 3 entregas de hoy para Matías y publica el día", async () => {
  const { data: m } = await panel.from("membresias").select("usuario_id").eq("empresa_id", empresa).eq("rol", "conductor").single();
  const base = { fecha: hoy, comuna: "La Florida", cobro: "pagada", conductor_id: m!.usuario_id, lat: -33.52, lng: -70.598, fuente: "simulado" };
  const { data: carga } = await panel.from("cargas").insert({
    empresa_id: empresa, archivo: "prueba", filas: [
      { n: 2, estado: "lista", datos: { ...base, cliente: "Jumbo La Florida", direccion: "Av. Vicuña Mackenna 7110", guia: "G-1", bultos: 12, hora: "09:30" } },
      { n: 3, estado: "lista", datos: { ...base, cliente: "Ferretería Los Aromos", direccion: "Pje. Los Aromos 455", guia: "G-2", bultos: 4, hora: "10:30", cobro: "cobrar", monto: 22500 } },
      { n: 4, estado: "lista", datos: { ...base, cliente: "Líder Puente Alto", direccion: "Av. Concha y Toro 1000", guia: "G-3", bultos: 2, hora: "11:30" } },
    ],
  }).select("id").single();
  expect((await panel.rpc("crear_entregas_desde_carga", { carga: carga!.id })).data).toBe(3);
  expect((await panel.rpc("publicar_dia", { empresa, dia: hoy })).data).toBe(3);
});

test("el día de Matías: iniciar, entregar (foto rechazada y otra), cobrar, no entregado y terminar", async ({ browser }) => {
  const contexto = await browser.newContext({ storageState: path.join(__dirname, "..", "test-results", `matias-${sello}.json`) });
  const page = await contexto.newPage();
  page.on("pageerror", (e) => console.log("error de página:", e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Ruta de hoy/ }).click();
  await expect(page.getByText("3 entregas · 0 cerradas · 18 bultos")).toBeVisible();
  await page.getByRole("button", { name: "Iniciar ruta" }).click();
  await expect(page.getByRole("button", { name: "Terminar ruta" })).toBeVisible();

  // 1) Jumbo: llegué, entregar con foto en negro → el agente la rechaza → otra foto.
  await page.getByRole("button", { name: /1\. Jumbo La Florida/ }).click();
  await page.getByRole("button", { name: "Llegué" }).click();
  await expect(page.getByRole("button", { name: "Llegué" })).toBeHidden();
  await page.getByRole("button", { name: "Entregar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(page.getByText("Falta la foto de la guía firmada.")).toBeVisible();
  await expect(page.getByText(/Falta el mensaje/)).toBeVisible();
  await foto(page, "Tomar foto", "foto-negra.jpg");
  await page.getByLabel("Mensaje").fill("Recibió Pedro en andén 3, 12 bultos");
  await page.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(page.getByText("La foto no sirve")).toBeVisible({ timeout: 15_000 });
  await foto(page, "Tomar otra foto", "guia-firmada.jpg");
  await expect(page.getByText("Entrega registrada")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Volver a la ruta" }).click();

  // 2) Ferretería: con cobro: no deja confirmar sin «Recibí el pago».
  await expect(page.getByText(/1 cerradas/)).toBeVisible();
  await page.getByRole("button", { name: /2\. Ferretería Los Aromos/ }).click();
  await page.getByRole("button", { name: "Entregar", exact: true }).click();
  await expect(page.getByText("Cobro: $22.500")).toBeVisible();
  await foto(page, "Tomar foto", "guia-firmada.jpg");
  await page.getByLabel("Mensaje").fill("Entregado a Luis, pagó en efectivo");
  await page.getByRole("button", { name: "Efectivo" }).click();
  await page.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(page.getByText("Confirma que recibiste el pago.")).toBeVisible();
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(page.getByText("Entrega registrada")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Volver a la ruta" }).click();

  // 3) Líder: no entregado, con motivo.
  await page.getByRole("button", { name: /3\. Líder Puente Alto/ }).click();
  await page.getByRole("button", { name: "No entregado" }).click();
  await foto(page, "Tomar foto", "guia-firmada.jpg");
  await page.getByLabel("Mensaje").fill("Cortina abajo a las 11:40, nadie contesta");
  await page.getByRole("button", { name: "Confirmar no entregado" }).click();
  await expect(page.getByText("Elige el motivo.")).toBeVisible();
  await page.getByRole("radio", { name: "Local cerrado" }).click();
  await page.getByRole("button", { name: "Confirmar no entregado" }).click();
  await expect(page.getByText("Registrado como no entregado")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Volver a la ruta" }).click();

  await expect(page.getByText(/3 cerradas/)).toBeVisible();
  await page.getByRole("button", { name: "Terminar ruta" }).click();
  await expect(page.getByText("Ruta terminada")).toBeVisible();
  await expect(page.getByText("2 entregadas · 1 no entregadas · 16 bultos")).toBeVisible();
  await expect(page.getByText("Cobrado: $22.500")).toBeVisible();
});

test("Carolina ve lo que pasó: mensajes, ubicación, cobro y lo que concluyó el agente", async () => {
  const { data: entregas } = await panel.from("entregas").select("id, guia, estado").eq("empresa_id", empresa).order("guia");
  expect(entregas!.map((e) => e.estado)).toEqual(["entregada", "entregada", "fallida"]);
  const { data: ev } = await panel.from("eventos_entrega").select("tipo, mensaje, lat").eq("entrega_id", entregas![0]!.id).eq("tipo", "entregada").single();
  expect(ev).toMatchObject({ mensaje: "Recibió Pedro en andén 3, 12 bultos" });
  expect(ev!.lat).toBeCloseTo(-33.5206, 3);
  const { data: clas } = await panel.from("clasificaciones_entrega").select("entrega_id, clase, foto_ok, mensaje_cliente").eq("empresa_id", empresa);
  const de = (id: string) => clas!.find((c) => c.entrega_id === id)!;
  expect(de(entregas![0]!.id)).toMatchObject({ clase: "entregada", foto_ok: true });
  expect(de(entregas![2]!.id)).toMatchObject({ clase: "fallida" });
  expect(de(entregas![0]!.id).mensaje_cliente).toContain("Recibió Pedro en andén 3");
  const { data: pago } = await panel.from("pagos").select("estado, forma").eq("entrega_id", entregas![1]!.id).single();
  expect(pago).toEqual({ estado: "confirmado", forma: "efectivo" });
});
