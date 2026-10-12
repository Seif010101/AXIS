"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { SectionCard } from "@/components/common/section-card";
import { AvatarPresetPreview, UserAvatar } from "@/components/common/user-avatar";
import { useAction } from "@/hooks/use-action";
import { AVATAR_PRESETS, presetFromImage, type AvatarPreset } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { updateAvatarAction } from "../actions";

type Choice = AvatarPreset | null;
const CHOICES: Choice[] = [null, ...AVATAR_PRESETS];

/** Preset avatar picker (a radio group); saves as soon as one is chosen. */
export function AvatarPicker({ name, image }: { name: string; image: string | null }) {
  const t = useTranslations("settings.profile.avatar");
  const [selected, setSelected] = useState<Choice>(presetFromImage(image));
  const { execute, pending } = useAction(updateAvatarAction, { successMessage: t("saved") });

  const choose = async (choice: Choice) => {
    if (choice === selected || pending) return;
    const previous = selected;
    setSelected(choice);
    const result = await execute({ preset: choice });
    if (!result.ok) setSelected(previous);
  };

  // Arrow keys move between options, as in any radio group (the grid reads in DOM order).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const delta = rtl && horizontal ? -step : step;
    const index = CHOICES.indexOf(selected);
    const next = CHOICES[(index + delta + CHOICES.length) % CHOICES.length];
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-choice="${next ?? "initials"}"]`)?.focus();
    void choose(next);
  };

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div
        role="radiogroup"
        aria-label={t("label")}
        aria-busy={pending}
        onKeyDown={onKeyDown}
        className="grid grid-cols-4 gap-3 sm:grid-cols-7"
      >
        {CHOICES.map((choice) => {
          const checked = choice === selected;
          const label = choice ? t(`presets.${choice}`) : t("initials");
          return (
            <button
              key={choice ?? "initials"}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={label}
              title={label}
              tabIndex={checked ? 0 : -1}
              data-choice={choice ?? "initials"}
              onClick={() => void choose(choice)}
              className={cn(
                "group relative flex aspect-square items-center justify-center rounded-full p-1 outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/60 motion-safe:hover:scale-105",
                checked ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "ring-1 ring-border",
              )}
            >
              {choice ? (
                <AvatarPresetPreview preset={choice} name={name} size="lg" className="size-full" />
              ) : (
                <UserAvatar name={name} size="lg" className="size-full" decorative />
              )}
              {checked && (
                <span className="absolute -end-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-card">
                  <Check className="size-3" aria-hidden />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
