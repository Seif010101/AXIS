"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SettingsTab } from "./tabs";

/**
 * The settings sections as tabs. The open tab is mirrored in `?tab=` (without a server
 * round trip) so a reload or a shared link opens the same section.
 */
export function SettingsTabs({
  tabs,
  initialTab,
}: {
  tabs: { value: SettingsTab; label: string; icon: ReactNode; content: ReactNode }[];
  initialTab: SettingsTab;
}) {
  const t = useTranslations("settings.tabs");
  const [tab, setTab] = useState<string>(initialTab);

  const change = (value: string) => {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <Tabs value={tab} onValueChange={change} className="gap-6">
      {/* Scrolls sideways on narrow phones instead of squeezing the labels. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line" aria-label={t("label")} className="h-10 w-full justify-start border-b sm:w-fit">
          {tabs.map(({ value, label, icon }) => (
            <TabsTrigger key={value} value={value} className="flex-none px-3">
              {icon}
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map(({ value, content }) => (
        <TabsContent key={value} value={value} className="space-y-6 animate-in fade-in-0">
          {content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
