"use client";

import { createContext, useContext, type ReactNode } from "react";

interface ShellContextValue {
  /** The signed-in user's home (e.g. /teacher). */
  homeHref: string;
}

const ShellContext = createContext<ShellContextValue>({ homeHref: "/" });

/** Exposes shell facts to client components rendered inside the app shell (error boundaries…). */
export function ShellProvider({ homeHref, children }: { homeHref: string; children: ReactNode }) {
  return <ShellContext value={{ homeHref }}>{children}</ShellContext>;
}

export function useShell(): ShellContextValue {
  return useContext(ShellContext);
}
