"use client";

import { Download, TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

/**
 * One-time display of 2FA backup codes with copy and .txt download. The codes are never
 * shown again, so screens that use it ask the user to confirm they saved them.
 */
export function BackupCodes({ codes, email }: { codes: string[]; email: string }) {
  const t = useTranslations("auth.backupCodes");
  const format = useFormatter();

  const download = () => {
    const lines = [
      t("fileTitle"),
      t("fileAccount", { email }),
      t("fileDate", { date: format.dateTime(new Date(), { dateStyle: "long", timeStyle: "short" }) }),
      "",
      ...codes,
      "",
      t("fileHint"),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${brand.name.toLowerCase()}-backup-codes.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
        <p>{t("warning")}</p>
      </div>
      <ol className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 font-mono text-sm sm:p-4" dir="ltr">
        {codes.map((code) => (
          <li key={code} className="rounded-md bg-card px-2.5 py-1.5 text-center tracking-wider shadow-xs">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <CopyButton value={codes.join("\n")} variant="outline" className="flex-1">
          {t("copyAll")}
        </CopyButton>
        <Button type="button" variant="outline" onClick={download} className="flex-1">
          <Download data-icon="inline-start" aria-hidden />
          {t("download")}
        </Button>
      </div>
    </div>
  );
}
