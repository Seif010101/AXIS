import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { directionOf } from "@/i18n/config";
import { requirePageSession } from "@/server/auth/page";
import { homePath } from "@/server/policy/roles";

// Session gate for the whole signed-in app: unauthenticated visitors go to /login, and
// unfinished account setup (temporary password, missing 2FA) is completed first.
// Role areas add their own gate in <area>/layout.tsx.
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const { user } = await requirePageSession();
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  const dir = directionOf(await getLocale());
  return (
    <AppShell
      user={{ name: user.name, email: user.email, image: user.image, role: user.role }}
      homeHref={homePath(user.role)}
      twoFactorEnabled={user.twoFactorEnabled}
      sidebarOpen={sidebarOpen}
      dir={dir}
    >
      {children}
    </AppShell>
  );
}
