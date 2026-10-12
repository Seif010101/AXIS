"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RoleBadge } from "@/components/common/role-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/server/policy/roles";
import { useSignOut } from "./sign-out";

export interface ShellUser {
  name: string;
  email: string;
  image: string | null;
  role: Role;
}

/** Avatar button in the top bar: who is signed in, settings, sign out. */
export function UserMenu({ user }: { user: ShellUser }) {
  const t = useTranslations("shell.userMenu");
  const { signOut, pending } = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("label")}>
          <UserAvatar name={user.name} image={user.image} size="sm" decorative />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
          <UserAvatar name={user.name} image={user.image} size="md" decorative />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {user.email}
            </p>
            <RoleBadge role={user.role} />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden />
              {t("settings")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => void signOut()}>
          <LogOut className="rtl:rotate-180" aria-hidden />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
