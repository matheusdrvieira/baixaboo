import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/", destination: "/pt", permanent: true },
      { source: "/terms", destination: "/pt/terms", permanent: true },
      { source: "/privacy", destination: "/pt/privacy", permanent: true },
      { source: "/copyright", destination: "/pt/copyright", permanent: true },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

export default withNextIntl(nextConfig);
