import { useId } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * The brand mark: two crossing axes with a highlighted data point inside a rounded
 * square (indigo → violet). Decorative by default; pass `title` to expose it to screen readers.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId();
  const gradient = `${id}-bg`;
  const glow = `${id}-glow`;
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-violet)" />
        </linearGradient>
        <radialGradient id={glow} cx="0.72" cy="0.3" r="0.5">
          <stop offset="0" stopColor="white" stopOpacity="0.28" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradient})`} />
      <rect width="32" height="32" rx="8" fill={`url(#${glow})`} />
      <path
        d="M11 6.5v19M6.5 21h19"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeOpacity="0.95"
      />
      <path
        d="M11 21 15.5 16.5l3 2L22 11.5"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.55"
      />
      <circle cx="22" cy="11" r="3.4" fill="var(--highlight)" stroke="white" strokeWidth="1.6" />
    </svg>
  );
}

/** The brand name as a wordmark (bold, wide tracking). The name comes from src/config/brand.ts. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-[0.2em] text-foreground", className)} dir="ltr">
      {brand.name}
    </span>
  );
}

/** Mark + wordmark, the standard lockup for headers. */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <Wordmark className="text-lg" />
    </span>
  );
}
