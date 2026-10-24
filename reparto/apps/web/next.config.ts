import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Los paquetes del monorepo se publican como TypeScript y Next los compila.
  transpilePackages: ["@reparto/dominio", "@reparto/ui-tokens"],
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
