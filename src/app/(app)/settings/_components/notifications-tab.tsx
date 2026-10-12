"use client";

import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/section-card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { updateNotificationsAction } from "../actions";

/** In-app notifications on/off (user_settings.notificationsEnabled). Saves immediately. */
export function NotificationsTab({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings.notifications");
  const id = useId();
  const [checked, setChecked] = useState(enabled);
  const { execute, pending } = useAction(updateNotificationsAction);

  const toggle = async (next: boolean) => {
    setChecked(next);
    const result = await execute({ enabled: next });
    if (result.ok) toast.success(next ? t("enabled") : t("disabled"));
    else setChecked(!next);
  };

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex items-start gap-4 rounded-xl border bg-muted/30 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={id} className="text-sm font-medium">
            {t("inApp")}
          </Label>
          <p id={`${id}-description`} className="text-sm text-muted-foreground">
            {t("inAppDescription")}
          </p>
        </div>
        <Switch
          id={id}
          checked={checked}
          disabled={pending}
          onCheckedChange={(next) => void toggle(next)}
          aria-describedby={`${id}-description`}
          className="mt-1"
        />
      </div>
    </SectionCard>
  );
}
