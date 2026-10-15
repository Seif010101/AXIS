"use client";

import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/common/confirm-dialog";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { revokeOtherSessionsAction, revokeSessionAction } from "../actions";

// Unicode "left-to-right isolate" and "pop directional isolate".
const LRI = "\u2066";
const PDI = "\u2069";

/** One signed-in device, with its texts already formatted by the page. */
export interface SessionRow {
  id: string;
  current: boolean;
  mobile: boolean;
  device: string;
  lastActive: string;
  signedIn: string;
  ipAddress: string | null;
}

/** Settings → Security → signed-in devices, with per-device and "all others" sign-out. */
export function SessionsCard({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations("settings.security.sessions");
  const revokeOne = useAction(revokeSessionAction, { successMessage: t("revoked") });
  const revokeOthers = useAction(revokeOtherSessionsAction, {
    onSuccess: ({ count }) => toast.success(t("revokedOthers", { count })),
  });
  const others = sessions.filter((session) => !session.current).length;

  return (
    <SectionCard
      title={t("title")}
      description={t("description")}
      contentClassName="p-0"
      footer={
        others > 0 ? (
          <ConfirmButton
            variant="outline"
            className="w-full sm:ms-auto sm:w-auto"
            destructive
            title={t("revokeOthersTitle")}
            description={t("revokeOthersDescription")}
            confirmLabel={t("revokeOthers")}
            onConfirm={async () => (await revokeOthers.execute({})).ok}
          >
            <LogOut data-icon="inline-start" className="rtl:rotate-180" aria-hidden />
            {t("revokeOthers")}
          </ConfirmButton>
        ) : (
          <p className="text-sm text-muted-foreground">{t("onlyThis")}</p>
        )
      }
    >
      <ul className="divide-y">
        {sessions.map((session) => {
          const Icon = session.mobile ? Smartphone : Monitor;
          return (
            <li key={session.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  session.current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span dir="auto">{session.device}</span>
                  {session.current && <Badge className="border-0 bg-success/12 text-success">{t("current")}</Badge>}
                </p>
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{t("lastActive", { time: session.lastActive })}</span>
                  <span>{t("signedIn", { date: session.signedIn })}</span>
                  {session.ipAddress && (
                    // Isolated so the address keeps its left-to-right order inside Arabic text.
                    <span>{t("ip", { ip: `${LRI}${session.ipAddress}${PDI}` })}</span>
                  )}
                </p>
              </div>
              {!session.current && (
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("revokeLabel", { device: session.device })}
                  destructive
                  title={t("revokeTitle")}
                  description={t("revokeDescription")}
                  confirmLabel={t("revoke")}
                  onConfirm={async () => (await revokeOne.execute({ sessionId: session.id })).ok}
                >
                  {t("revoke")}
                </ConfirmButton>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
