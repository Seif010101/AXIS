"use client";

import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import type { Role } from "@/server/policy/roles";
import { findNavItem } from "./nav-utils";

/** Opens/collapses the sidebar (sheet on phones). */
export function ShellSidebarTrigger() {
  const t = useTranslations("shell.sidebar");
  const { toggleSidebar } = useSidebar();
  return (
    <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label={t("toggle")} className="-ms-1">
      <PanelLeft className="rtl:rotate-180" aria-hidden />
    </Button>
  );
}

/** "Section / Page" for the current route, derived from the navigation config. */
export function TopbarTitle({ role }: { role: Role }) {
  const tNav = useTranslations("nav");
  const t = useTranslations("shell.topbar");
  const pathname = usePathname();
  const match = findNavItem(role, pathname);
  if (!match) return null;
  const isExact = match.item.href === pathname;
  return (
    <nav aria-label={t("breadcrumb")} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden shrink-0 text-muted-foreground sm:block">{tNav(`sections.${match.section.label}`)}</li>
        <li className="hidden shrink-0 text-muted-foreground/60 sm:block" aria-hidden>
          /
        </li>
        <li className="min-w-0 truncate font-medium">
          {isExact ? (
            <span aria-current="page">{tNav(`items.${match.item.label}`)}</span>
          ) : (
            <Link href={match.item.href} className="hover:underline">
              {tNav(`items.${match.item.label}`)}
            </Link>
          )}
        </li>
      </ol>
    </nav>
  );
}
