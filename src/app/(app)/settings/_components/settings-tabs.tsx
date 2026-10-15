"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const listRef = useRef<HTMLDivElement>(null);

  // On phones the tab list scrolls sideways: bring the open tab into view.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-state="active"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  const change = (value: string) => {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <Tabs value={tab} onValueChange={change} className="gap-6">
      {/* Scrolls sideways on narrow phones instead of squeezing the labels. */}
      <div
        ref={listRef}
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <TabsList variant="line" aria-label={t("label")} className="h-10 w-max min-w-full justify-start border-b">
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
