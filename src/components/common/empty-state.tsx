import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * The empty state of a list or page. Say what will appear here and, when possible, offer
 * the action that creates the first item.
 *
 * @example <EmptyState icon={ClipboardList} title={t("empty.title")} description={t("empty.body")}
 *   action={<Button asChild><Link href="/teacher/homework/new">{t("create")}</Link></Button>} />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border bg-card/60 py-10 sm:py-14", className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/10 text-primary [&_svg]:size-6">
            <Icon aria-hidden />
          </EmptyMedia>
        )}
        <EmptyTitle className="text-base font-semibold">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
