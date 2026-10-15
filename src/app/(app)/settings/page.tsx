import { Bell, BookOpenCheck, Globe, Palette, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/page-header";
import { describeUserAgent, displayIp } from "@/lib/format";
import { requirePageSession } from "@/server/auth/page";
import {
  getPreferences,
  getProfile,
  getTwoFactorStatus,
  listSessions,
} from "@/server/modules/settings/settings";
import { AppearanceTab } from "./_components/appearance-tab";
import { AvatarPicker } from "./_components/avatar-picker";
import { LanguageTab } from "./_components/language-tab";
import { LearningTab } from "./_components/learning-tab";
import { NotificationsTab } from "./_components/notifications-tab";
import { ProfileDetails } from "./_components/profile-details";
import { PasswordCard } from "./_components/password-card";
import { SessionsCard, type SessionRow } from "./_components/sessions-card";
import { SettingsTabs } from "./_components/settings-tabs";
import { SETTINGS_TABS, type SettingsTab } from "./_components/tabs";
import { TwoFactorCard } from "./_components/two-factor-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

const ICONS: Record<SettingsTab, ReactNode> = {
  profile: <UserRound aria-hidden />,
  appearance: <Palette aria-hidden />,
  language: <Globe aria-hidden />,
  notifications: <Bell aria-hidden />,
  learning: <BookOpenCheck aria-hidden />,
  security: <ShieldCheck aria-hidden />,
};

// Every role's own settings. All data is the signed-in user's: the module functions only
// ever read ctx.user.id.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const ctx = await requirePageSession();
  const locale = await getLocale();
  const [profile, preferences, twoFactor, sessions, t, tSessions, format] = await Promise.all([
    getProfile(ctx),
    getPreferences(ctx, locale),
    getTwoFactorStatus(ctx),
    listSessions(ctx),
    getTranslations("settings"),
    getTranslations("settings.security.sessions"),
    getFormatter(),
  ]);

  const isStudent = ctx.user.role === "student";
  const available = SETTINGS_TABS.filter((tab) => tab !== "learning" || isStudent);
  const requested = (await searchParams).tab;
  const initialTab = available.find((tab) => tab === requested) ?? "profile";

  // Dates are formatted here so server and browser render the same text.
  const now = new Date();
  const sessionRows: SessionRow[] = sessions.map((session) => {
    const device = describeUserAgent(session.userAgent);
    return {
      id: session.id,
      current: session.current,
      mobile: device.mobile,
      device:
        device.browser && device.os
          ? tSessions("device", { browser: device.browser, os: device.os })
          : (device.browser ?? device.os ?? tSessions("unknownDevice")),
      lastActive: format.relativeTime(session.lastActiveAt, now),
      signedIn: format.dateTime(session.createdAt, { dateStyle: "medium" }),
      ipAddress: displayIp(session.ipAddress),
    };
  });

  const content: Record<SettingsTab, ReactNode> = {
    profile: (
      <>
        <ProfileDetails profile={profile} />
        <AvatarPicker name={profile.name} image={profile.image} />
      </>
    ),
    appearance: <AppearanceTab />,
    language: <LanguageTab current={locale} />,
    notifications: <NotificationsTab enabled={preferences.notificationsEnabled} />,
    learning: (
      <LearningTab
        initial={{
          difficulty: preferences.difficulty,
          tutorPersonality: preferences.tutorPersonality,
          hobbies: preferences.hobbies,
        }}
      />
    ),
    security: (
      <>
        <PasswordCard />
        <TwoFactorCard status={twoFactor} email={profile.email} />
        <SessionsCard sessions={sessionRows} />
      </>
    ),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsTabs
        initialTab={initialTab}
        tabs={available.map((tab) => ({ value: tab, label: t(`tabs.${tab}`), icon: ICONS[tab], content: content[tab] }))}
      />
    </div>
  );
}
