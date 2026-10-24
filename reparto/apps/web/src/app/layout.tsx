import type { Metadata } from "next";
import { cssDelTema } from "./tema";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Reparto",
  description: "Panel del administrador de reparto.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssDelTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
