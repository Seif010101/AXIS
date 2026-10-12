"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Copies `value` to the clipboard and confirms with a check mark for two seconds.
 * Icon-only by default (with an accessible label); pass `children` for a text button.
 *
 * @example <CopyButton value={secretKey} />
 * @example <CopyButton value={codes.join("\n")} variant="outline">{t("copyAll")}</CopyButton>
 */
export function CopyButton({
  value,
  label,
  children,
  variant = "ghost",
  size,
  className,
}: {
  value: string;
  /** Accessible label of the icon-only button (defaults to "Copy"). */
  label?: string;
  children?: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const t = useTranslations("common.actions");
  const tShell = useTranslations("shell.copy");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error(tShell("failed"));
    }
  };

  const Icon = copied ? Check : Copy;
  const status = copied ? t("copied") : (label ?? t("copy"));
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (children ? "default" : "icon-sm")}
      onClick={copy}
      className={className}
      aria-label={children ? undefined : status}
    >
      <Icon className={copied ? "text-success" : undefined} data-icon={children ? "inline-start" : undefined} aria-hidden />
      {children && <span>{copied ? t("copied") : children}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </Button>
  );
}
