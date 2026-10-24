// Textos legales públicos (Términos y Privacidad). Meta, Google y Apple piden estas URLs.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { nombreApp } from "@/lib/configuracion";

const DOCUMENTOS: Record<string, { archivo: string; titulo: string }> = {
  terminos: { archivo: "terminos-y-condiciones.md", titulo: "Términos y Condiciones" },
  privacidad: { archivo: "politica-de-privacidad.md", titulo: "Política de privacidad" },
};

export function generateStaticParams() {
  return Object.keys(DOCUMENTOS).map((documento) => ({ documento }));
}

type Props = { params: Promise<{ documento: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = DOCUMENTOS[(await params).documento];
  return { title: doc ? `${doc.titulo} · ${nombreApp}` : nombreApp };
}

export default async function Legal({ params }: Props) {
  const doc = DOCUMENTOS[(await params).documento];
  if (!doc) notFound();
  const crudo = await readFile(path.join(process.cwd(), "..", "..", "docs", "legal", doc.archivo), "utf8");
  // Los borradores son nuestros (docs/legal), no texto de usuarios.
  const html = await marked.parse(crudo.replaceAll("[NOMBRE APP]", nombreApp));
  return <main className="contenedor angosto legal" dangerouslySetInnerHTML={{ __html: html }} />;
}
