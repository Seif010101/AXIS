import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Title block at the top of every auth screen. */
export function AuthHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="mb-8 space-y-2">
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      {subtitle && <p className="text-sm text-pretty text-muted-foreground sm:text-base">{subtitle}</p>}
    </div>
  );
}

/** Inline error box for auth forms (announced to screen readers). */
export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive animate-in fade-in-0"
    >
      {children}
    </div>
  );
}
