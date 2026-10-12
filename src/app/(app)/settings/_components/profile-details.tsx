import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { RoleBadge } from "@/components/common/role-badge";
import { SectionCard } from "@/components/common/section-card";
import { UserAvatar } from "@/components/common/user-avatar";
import type { Profile } from "@/server/modules/settings/settings";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 rounded-lg border bg-muted/30 px-3.5 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Read-only account details: staff manage names, emails and classes. */
export function ProfileDetails({ profile }: { profile: Profile }) {
  const t = useTranslations("settings.profile");
  const tFields = useTranslations("common.fields");
  return (
    <SectionCard title={t("title")}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={profile.name} image={profile.image} size="xl" decorative />
          <div className="min-w-0 space-y-1.5">
            <p className="truncate text-lg font-semibold">{profile.name}</p>
            <p className="truncate text-sm text-muted-foreground" dir="ltr">
              {profile.email}
            </p>
            <RoleBadge role={profile.role} />
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label={tFields("name")}>{profile.name}</Detail>
          <Detail label={tFields("email")}>
            <span dir="ltr">{profile.email}</span>
          </Detail>
          <Detail label={tFields("school")}>
            {profile.schoolName ?? <span className="text-muted-foreground">{t("noSchool")}</span>}
          </Detail>
          {profile.role === "student" && (profile.grade || profile.section) && (
            <Detail label={`${tFields("grade")} · ${tFields("section")}`}>
              {[profile.grade, profile.section].filter(Boolean).join(" · ")}
            </Detail>
          )}
          {profile.role === "teacher" && profile.subject && (
            <Detail label={tFields("subject")}>{profile.subject}</Detail>
          )}
        </dl>
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("description")}</span>
        </p>
      </div>
    </SectionCard>
  );
}
