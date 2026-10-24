import "server-only";

// Correo de invitación por Resend (SPEC 3.10). Si no está configurado, no se
// envía nada y el panel le dice al administrador que avise por su cuenta.
export async function enviarInvitacion(opciones: {
  para: string;
  empresa: string;
  rol: "admin" | "conductor";
  invitadoPor: string;
}): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (!clave || !remitente) return false;

  const app = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Reparto";
  const donde =
    opciones.rol === "admin"
      ? `Entra al panel (${process.env.NEXT_PUBLIC_URL_PANEL ?? "el panel web"}) con este correo.`
      : `Descarga la app ${app} y entra con este correo.`;
  const texto = [
    `${opciones.invitadoPor} te invitó a ${opciones.empresa} en ${app} como ${opciones.rol === "admin" ? "administrador" : "conductor"}.`,
    "",
    donde,
    "Te llegará un código de 6 dígitos para entrar. La invitación dura 14 días.",
    "",
    "Si no conoces a esta empresa, ignora este correo.",
  ].join("\n");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remitente, to: [opciones.para], subject: `Te invitaron a ${opciones.empresa}`, text: texto }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
