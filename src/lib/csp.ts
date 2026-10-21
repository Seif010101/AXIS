// The Content Security Policy sent with every page (see src/proxy.ts). Pure, unit-tested.

const TURNSTILE = "https://challenges.cloudflare.com";

export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React, Radix and toasts set style attributes; inline styles can't run code.
    "style-src 'self' 'unsafe-inline'",
    // https: images come from markdown content (AI answers, uploaded notes).
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${TURNSTILE}`,
    `frame-src ${TURNSTILE}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
