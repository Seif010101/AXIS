import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { StepUpProvider } from "@/components/auth/step-up-provider";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { LocaleSwitcher } from "./locale-switcher";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { ShellProvider } from "./shell-context";
import { ShellSidebarTrigger, TopbarTitle } from "./topbar-parts";
import { UserMenu, type ShellUser } from "./user-menu";

/**
 * The signed-in frame: sidebar + sticky top bar + content column, with the global
 * step-up dialog. Rendered by src/app/(app)/layout.tsx only.
 */
export function AppShell({
  user,
  homeHref,
  twoFactorEnabled,
  sidebarOpen,
  dir,
  children,
}: {
  user: ShellUser;
  homeHref: string;
  twoFactorEnabled: boolean;
  sidebarOpen: boolean;
  dir: "rtl" | "ltr";
  children: ReactNode;
}) {
  const t = useTranslations("shell");
  return (
    <ShellProvider homeHref={homeHref}>
    <StepUpProvider twoFactorEnabled={twoFactorEnabled}>
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t("skipToContent")}
      </a>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar user={user} homeHref={homeHref} dir={dir} />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-4">
            <ShellSidebarTrigger />
            <Separator orientation="vertical" className="me-1 data-[orientation=vertical]:h-5" />
            <TopbarTitle role={user.role} />
            <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
              <NotificationBell />
              <LocaleSwitcher persist />
              <ThemeToggle />
              <UserMenu user={user} />
            </div>
          </header>
          <div id="content" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-7xl animate-in fade-in-0">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </StepUpProvider>
    </ShellProvider>
  );
}
