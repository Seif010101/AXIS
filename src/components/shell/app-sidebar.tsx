"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoMark, Wordmark } from "@/components/shell/logo";
import { RoleBadge } from "@/components/common/role-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { accountNavigation, navigation, type NavSection } from "@/config/navigation";
import { activeHref } from "./nav-utils";
import type { ShellUser } from "./user-menu";

/**
 * The role's navigation (src/config/navigation.ts). Collapses to icons on desktop and
 * becomes a sheet on phones; it sits on the inline-start side (right in Arabic).
 */
export function AppSidebar({ user, homeHref, dir }: { user: ShellUser; homeHref: string; dir: "rtl" | "ltr" }) {
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell.sidebar");
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const sections = navigation[user.role];
  const active = activeHref(
    pathname,
    [...sections, accountNavigation].flatMap((section) => section.items.map((item) => item.href)),
  );
  const side = dir === "rtl" ? "right" : "left";
  const tooltipSide = dir === "rtl" ? "left" : "right";
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderSection = (section: NavSection) => (
    <SidebarGroup key={section.label}>
      <SidebarGroupLabel>{tNav(`sections.${section.label}`)}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {section.items.map((item) => {
            const label = tNav(`items.${item.label}`);
            const isActive = item.href === active;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={{ children: label, side: tooltipSide }}
                  className="relative data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:start-0 data-active:before:w-[3px] data-active:before:rounded-full data-active:before:bg-sidebar-primary"
                >
                  <Link href={item.href} aria-current={isActive ? "page" : undefined} onClick={closeOnMobile}>
                    <item.icon aria-hidden />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar side={side} dir={dir} collapsible="icon" aria-label={tShell("label")}>
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={{ children: tShell("home"), side: tooltipSide }}>
              <Link href={homeHref} onClick={closeOnMobile}>
                <LogoMark className="size-8" />
                <Wordmark className="text-base" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-1">
        {sections.map(renderSection)}
        <SidebarSeparator className="my-1" />
        {renderSection(accountNavigation)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={{ children: user.name, side: tooltipSide }}>
              <Link href="/settings" onClick={closeOnMobile}>
                <UserAvatar name={user.name} image={user.image} size="sm" decorative />
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="w-full truncate text-sm font-medium">{user.name}</span>
                  <RoleBadge role={user.role} className="h-4 px-1.5 text-[0.65rem]" />
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail aria-label={tShell("toggle")} title={tShell("toggle")} />
    </Sidebar>
  );
}
