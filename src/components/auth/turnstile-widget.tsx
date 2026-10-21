"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { cn } from "@/lib/utils";

// Cloudflare Turnstile widget (bot check on the sign-in form). The token it produces is
// single-use and is checked on the server by src/server/auth/turnstile.ts.

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Turnstile's own language codes for the app's locales.
const LANGUAGES: Record<string, string> = { ar: "ar", en: "en", zh: "zh-cn", de: "de", es: "es", fr: "fr" };

let loader: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once per page, shared by every widget. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loader ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"));
    script.onerror = () => {
      loader = null; // allow a retry on the next mount
      script.remove();
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export interface TurnstileHandle {
  /** Issues a new token: call after every sign-in attempt (tokens are single-use). */
  reset(): void;
}

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  ref,
  className,
}: {
  siteKey: string;
  action: string;
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
  className?: string;
}) {
  const t = useTranslations("auth.login.botCheck");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const tokenCallback = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    tokenCallback.current = onToken;
  }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset() {
      tokenCallback.current(null);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  }));

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        setFailed(false);
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          theme,
          size: "flexible",
          language: LANGUAGES[locale] ?? "auto",
          callback: (token: string) => tokenCallback.current(token),
          "expired-callback": () => tokenCallback.current(null),
          "timeout-callback": () => tokenCallback.current(null),
          "error-callback": () => {
            tokenCallback.current(null);
            // Returning true tells Turnstile the error was handled (no console exception);
            // it keeps retrying on its own.
            return true;
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId.current) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = null;
      }
      tokenCallback.current(null);
    };
  }, [siteKey, action, theme, locale]);

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={container} className="min-h-[65px]" />
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t("loadFailed")}
        </p>
      )}
    </div>
  );
}
