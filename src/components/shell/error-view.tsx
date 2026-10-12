import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared layout of the error, not-found and forbidden screens: a large status code over a
 * faint coordinate grid, a title, a short explanation and actions. Pass translated text.
 */
export function ErrorView({
  code,
  title,
  description,
  actions,
  footer,
  fullScreen = false,
}: {
  code: string;
  title: ReactNode;
  description: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
  /** Outside the app shell: fill the viewport. Inside it: fill the content area. */
  fullScreen?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden px-6 text-center",
        fullScreen ? "min-h-svh py-16" : "min-h-[60svh] rounded-2xl border bg-card py-14 shadow-xs",
      )}
    >
      <div
        className="absolute inset-0 -z-10 bg-grid opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
        aria-hidden
      />
      <div
        className="absolute top-1/4 start-1/2 -z-10 size-80 -translate-x-1/2 rounded-full bg-brand-violet/15 blur-3xl rtl:translate-x-1/2"
        aria-hidden
      />
      <p
        className="text-brand-gradient text-7xl font-bold tracking-tight tabular-nums select-none sm:text-8xl animate-in fade-in-0 zoom-in-95"
        dir="ltr"
        aria-hidden
      >
        {code}
      </p>
      <h1 className="mt-4 max-w-lg text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-md text-sm text-pretty text-muted-foreground sm:text-base">{description}</p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">{actions}</div>
      {footer && <div className="mt-6 text-xs text-muted-foreground">{footer}</div>}
    </section>
  );
}
