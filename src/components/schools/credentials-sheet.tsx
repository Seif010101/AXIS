"use client";

import { Download, KeyRound, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopyButton } from "@/components/common/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildCsv } from "./csv";
import { downloadBlob } from "./list-controls";

export interface CredentialRow {
  name: string;
  email: string;
  role: "manager" | "admin" | "teacher" | "student";
  grade: string | null;
  section: string | null;
  password: string;
}

/**
 * One-time credentials sheet. Passwords exist only in this component's state: they are
 * never stored, put in the URL or cached. Closing asks for confirmation until the sheet has
 * been downloaded or copied, and leaving the page is guarded while it is open.
 */
export function CredentialsSheet({ rows, onClose }: { rows: CredentialRow[] | null; onClose: () => void }) {
  const t = useTranslations("schools.credentials");
  const tRoles = useTranslations("common.roles");
  const [saved, setSaved] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const open = rows !== null && rows.length > 0;

  useEffect(() => {
    if (!open || saved) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [open, saved]);

  if (!open) return null;

  const classOf = (row: CredentialRow) => [row.grade, row.section].filter(Boolean).join(" / ");
  const header = [t("columns.name"), t("columns.email"), t("columns.role"), t("columns.class"), t("columns.password")];
  const table = rows.map((r) => [r.name, r.email, tRoles(r.role), classOf(r), r.password]);
  const tsv = [header, ...table].map((line) => line.join("\t")).join("\n");

  const download = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([buildCsv([header, ...table])], { type: "text/csv;charset=utf-8" }), `credentials-${stamp}.csv`);
    setSaved(true);
  };

  const close = () => {
    setSaved(false);
    onClose();
  };

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && (saved ? close() : setConfirmClose(true))}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" aria-hidden />
              {t("title", { count: rows.length })}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>{t("warningTitle")}</AlertTitle>
            <AlertDescription>{t("warning")}</AlertDescription>
          </Alert>
          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {header.map((h) => (
                    <th key={h} className="px-3 py-2 text-start font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.email} className="border-t">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                      {row.email}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{tRoles(row.role)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{classOf(row) || "—"}</td>
                    <td className="px-3 py-2">
                      <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs select-all">
                        {row.password}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button onClick={download}>
                <Download aria-hidden />
                {t("download")}
              </Button>
              <span onClickCapture={() => setSaved(true)}>
                <CopyButton value={tsv} variant="outline" label={t("copyAll")}>
                  {t("copyAll")}
                </CopyButton>
              </span>
            </div>
            <Button variant="ghost" onClick={() => (saved ? close() : setConfirmClose(true))}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t("closeConfirmTitle")}
        description={t("closeConfirm")}
        confirmLabel={t("closeAnyway")}
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          close();
        }}
      />
    </>
  );
}
