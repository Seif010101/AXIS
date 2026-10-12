import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The button row at the end of a form. Buttons stack full-width on phones (the primary
 * button on top: put it last in the markup) and sit on the inline-end side from `sm` up.
 */
export function FormActions({
  children,
  align = "end",
  divider = false,
  className,
}: {
  children: ReactNode;
  /** `between` puts the first child on the start side (e.g. a destructive action). */
  align?: "end" | "between";
  divider?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:items-center",
        align === "end" ? "sm:justify-end" : "sm:justify-between",
        divider && "border-t pt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
