"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side providers mounted once in the root layout: theme (class strategy, follows
 * the OS by default), reading direction for Radix primitives, tooltips and toasts.
 */
export function AppProviders({ dir, children }: { dir: "rtl" | "ltr"; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DirectionProvider dir={dir}>
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster dir={dir} position={dir === "rtl" ? "bottom-left" : "bottom-right"} closeButton={false} />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
