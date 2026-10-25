// Textos legales públicos (Términos y Privacidad). Meta, Google y Apple piden estas URLs.
// Los textos vienen de docs/legal, copiados al compilar (en Cloudflare no hay disco).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { nombreApp } from "@/lib/configuracion";
import { TEXTOS_LEGALES } from "@/lib/textos-legales";

const TITULOS = { terminos: "Términos y Condiciones", privacidad: "Política de privacidad" } as const;
type Documento = keyof typeof TITULOS;
const esDocumento = (d: string): d is Documento => d in TITULOS;

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(TITULOS).map((documento) => ({ documento }));
}

type Props = { params: Promise<{ documento: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { documento } = await params;
  return { title: esDocumento(documento) ? `${TITULOS[documento]} · ${nombreApp}` : nombreApp };
}

export default async function Legal({ params }: Props) {
  const { documento } = await params;
  if (!esDocumento(documento)) notFound();
  // Los borradores son nuestros (docs/legal), no texto de usuarios.
  const html = await marked.parse(TEXTOS_LEGALES[documento].replaceAll("[NOMBRE APP]", nombreApp));
  return <main className="contenedor angosto legal" dangerouslySetInnerHTML={{ __html: html }} />;
}
