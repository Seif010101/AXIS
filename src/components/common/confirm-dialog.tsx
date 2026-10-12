"use client";

import { useTranslations } from "next-intl";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface ConfirmContentProps {
  title: ReactNode;
  description?: ReactNode;
  /** Label of the confirm button (defaults to common.actions.confirm). */
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** Red confirm button, for deletions and other irreversible actions. */
  destructive?: boolean;
  /**
   * Runs on confirm. The dialog stays open (button shows a spinner) until the promise
   * settles; return `false` to keep it open (e.g. the action failed).
   */
  onConfirm: () => unknown;
}

function ConfirmContent({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  close,
}: ConfirmContentProps & { close: () => void }) {
  const t = useTranslations("common.actions");
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      const result = await onConfirm();
      if (result !== false) close();
    } finally {
      setPending(false);
    }
  };
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{cancelLabel ?? t("cancel")}</AlertDialogCancel>
        <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" aria-hidden />}
          {confirmLabel ?? t("confirm")}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

/**
 * Controlled confirmation dialog (AlertDialog). Use it when the trigger is not a plain
 * button, e.g. a menu item that sets `open`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  ...content
}: ConfirmContentProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmContent {...content} close={() => onOpenChange(false)} />
    </AlertDialog>
  );
}

/**
 * A button that asks for confirmation before running `onConfirm`.
 *
 * @example
 * <ConfirmButton variant="destructive" destructive title={t("delete.title")}
 *   description={t("delete.body")} confirmLabel={tCommon("actions.delete")}
 *   onConfirm={() => execute({ id })}>{tCommon("actions.delete")}</ConfirmButton>
 */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  ...buttonProps
}: ConfirmContentProps & Omit<ComponentProps<typeof Button>, "onClick" | "title">) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button {...buttonProps}>{children}</Button>
      </AlertDialogTrigger>
      <ConfirmContent
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        onConfirm={onConfirm}
        close={() => setOpen(false)}
      />
    </AlertDialog>
  );
}
