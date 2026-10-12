import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A titled card section (settings groups, dashboard panels). The header gets a divider
 * when it has a title; `action` sits on the inline-end side of the header.
 */
export function SectionCard({
  title,
  description,
  action,
  footer,
  children,
  className,
  contentClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <Card id={id} className={cn("gap-0 py-0 shadow-xs", className)}>
      {(title || action) && (
        <CardHeader className="border-b py-4">
          {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn("py-5", contentClassName)}>{children}</CardContent>
      {footer && <CardFooter className="border-t py-3">{footer}</CardFooter>}
    </Card>
  );
}
