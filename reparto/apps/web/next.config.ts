import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo se publican como TypeScript y Next los compila.
  transpilePackages: ["@reparto/dominio", "@reparto/ui-tokens"],
  // Los textos legales viven en reparto/docs/legal y se leen al compilar.
  outputFileTracingIncludes: { "/legal/[documento]": ["../../docs/legal/*.md"] },
  // Los Excel de entregas pueden pesar hasta 5 MB (el tope de lib/excel.ts), más el sobre del formulario.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

// Los mapas de código para Sentry solo se suben si hay credenciales (en la CI de producción).
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT_WEB,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
    })
  : nextConfig;
