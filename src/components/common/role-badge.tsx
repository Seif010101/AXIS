import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "@/server/policy/roles";

const TONES: Record<Role, string> = {
  owner: "bg-brand-violet/12 text-brand-violet",
  manager: "bg-primary/10 text-primary",
  admin: "bg-info/12 text-info",
  teacher: "bg-success/12 text-success",
  student: "bg-star/25 text-star-foreground dark:bg-star/15 dark:text-star",
};

/** The localized role name (common.roles) in the role's color. */
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const t = useTranslations("common.roles");
  return <Badge className={cn("border-0 font-medium", TONES[role], className)}>{t(role)}</Badge>;
}
