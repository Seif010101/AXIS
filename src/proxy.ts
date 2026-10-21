import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

// Per-request Content Security Policy with a script nonce. Next.js reads the nonce from the
// request's CSP header and puts it on its own scripts; anything injected into the page
// (an XSS) has no nonce and won't run. 'strict-dynamic' lets those trusted scripts load
// what they need, e.g. the Cloudflare Turnstile loader on the sign-in form.
//
// Not a security boundary for data: every server action and route handler still checks
// the session itself (see server/action.ts).

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes, static files and prefetches don't render HTML.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
