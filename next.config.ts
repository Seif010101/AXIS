import path from "node:path";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// next-intl resolves the request config through the `next-intl/config` alias. We set the
// alias ourselves instead of using `next-intl/plugin`: the plugin eagerly loads the
// `@swc/core` native addon (only needed for its experimental message extraction), and that
// addon refuses to start on machines whose cache directory ACLs include an AppContainer SID.
const I18N_REQUEST_CONFIG = "./src/i18n/request.ts";

// Baseline security headers (ported from the FastAPI SecurityHeadersMiddleware, tightened).
// A nonce-based script CSP is added with proxy.ts before cutover.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    resolveAlias: { "next-intl/config": I18N_REQUEST_CONFIG },
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["next-intl/config"] = path.resolve(config.context, I18N_REQUEST_CONFIG);
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
