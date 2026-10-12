import type { ReactNode } from "react";
import { getSessionContext } from "@/server/auth/session";
import { homePath } from "@/server/policy/roles";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

// Public marketing pages (landing, about). No session required; a signed-in visitor gets
// a "Go to dashboard" button instead of "Sign in".
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const context = await getSessionContext();
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <SiteHeader homeHref={context ? homePath(context.user.role) : null} />
      <main id="content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
