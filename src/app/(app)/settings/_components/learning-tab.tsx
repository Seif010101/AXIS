"use client";

import { Dumbbell, FlaskConical, GraduationCap, Plus, Smile, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { FormActions } from "@/components/common/form-actions";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import {
  DIFFICULTIES,
  HOBBIES_MAX,
  HOBBY_MAX_LENGTH,
  TUTOR_PERSONALITIES,
  addHobby,
  isOneOf,
  type Difficulty,
  type TutorPersonality,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { updateLearningAction } from "../actions";

const PERSONALITY_ICONS: Record<TutorPersonality, LucideIcon> = {
  friend: Smile,
  strict: GraduationCap,
  coach: Dumbbell,
  scientist: FlaskConical,
};

const LEVEL_BARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

function ChoiceCard({
  id,
  value,
  checked,
  title,
  description,
  media,
}: {
  id: string;
  value: string;
  checked: boolean;
  title: string;
  description: string;
  media: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 hover:bg-accent/40",
        checked && "border-primary bg-primary/5 hover:bg-primary/5",
      )}
    >
      <RadioGroupItem id={id} value={value} className="sr-only" />
      {media}
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

/** Students' AI tutor preferences: explanation level, tutor personality and hobbies. */
export function LearningTab({
  initial,
}: {
  initial: { difficulty: Difficulty; tutorPersonality: TutorPersonality; hobbies: string[] };
}) {
  const t = useTranslations("settings.learning");
  const ids = { difficulty: useId(), personality: useId(), hobby: useId() };
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [personality, setPersonality] = useState(initial.tutorPersonality);
  const [hobbies, setHobbies] = useState(initial.hobbies);
  const [draft, setDraft] = useState("");
  const [hobbyError, setHobbyError] = useState<string | null>(null);
  const { execute, pending } = useAction(updateLearningAction, { successMessage: t("saved") });

  const add = () => {
    const result = addHobby(hobbies, draft);
    if (!result.ok) {
      if (result.reason !== "empty") {
        setHobbyError(t(`hobbies.${result.reason}`, { max: result.reason === "limit" ? HOBBIES_MAX : HOBBY_MAX_LENGTH }));
      }
      return;
    }
    setHobbies(result.hobbies);
    setDraft("");
    setHobbyError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void execute({ difficulty, tutorPersonality: personality, hobbies });
  };

  return (
    <form onSubmit={submit}>
      <SectionCard
        title={t("title")}
        description={t("description")}
        contentClassName="space-y-7"
        footer={
          <FormActions className="w-full">
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" aria-hidden />}
              {t("save")}
            </Button>
          </FormActions>
        }
      >
        <fieldset className="space-y-3">
          <legend id={ids.difficulty} className="mb-3 text-sm font-medium">
            {t("difficulty.label")}
          </legend>
          <RadioGroup
            value={difficulty}
            onValueChange={(value) => isOneOf(DIFFICULTIES, value) && setDifficulty(value)}
            aria-labelledby={ids.difficulty}
            className="grid gap-2.5 sm:grid-cols-3"
          >
            {DIFFICULTIES.map((level) => (
              <ChoiceCard
                key={level}
                id={`${ids.difficulty}-${level}`}
                value={level}
                checked={difficulty === level}
                title={t(`difficulty.${level}.title`)}
                description={t(`difficulty.${level}.description`)}
                media={
                  <span className="mt-1 flex h-4 shrink-0 items-end gap-0.5" aria-hidden>
                    {[1, 2, 3].map((bar) => (
                      <span
                        key={bar}
                        className={cn(
                          "w-1.5 rounded-full",
                          bar <= LEVEL_BARS[level] ? "bg-primary" : "bg-muted",
                          bar === 1 ? "h-1.5" : bar === 2 ? "h-2.5" : "h-4",
                        )}
                      />
                    ))}
                  </span>
                }
              />
            ))}
          </RadioGroup>
        </fieldset>

        <fieldset className="space-y-3">
          <legend id={ids.personality} className="mb-3 text-sm font-medium">
            {t("personality.label")}
          </legend>
          <RadioGroup
            value={personality}
            onValueChange={(value) => isOneOf(TUTOR_PERSONALITIES, value) && setPersonality(value)}
            aria-labelledby={ids.personality}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {TUTOR_PERSONALITIES.map((key) => {
              const Icon = PERSONALITY_ICONS[key];
              return (
                <ChoiceCard
                  key={key}
                  id={`${ids.personality}-${key}`}
                  value={key}
                  checked={personality === key}
                  title={t(`personality.${key}.title`)}
                  description={t(`personality.${key}.description`)}
                  media={
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                      aria-hidden
                    >
                      <Icon className="size-4.5" />
                    </span>
                  }
                />
              );
            })}
          </RadioGroup>
        </fieldset>

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={ids.hobby} className="text-sm font-medium">
              {t("hobbies.label")}
            </label>
            <p className="text-xs text-muted-foreground">{t("hobbies.description", { max: HOBBIES_MAX })}</p>
          </div>
          <div className="flex gap-2">
            <Input
              id={ids.hobby}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setHobbyError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder={t("hobbies.placeholder")}
              maxLength={HOBBY_MAX_LENGTH + 10}
              aria-invalid={hobbyError ? true : undefined}
              aria-describedby={hobbyError ? `${ids.hobby}-error` : undefined}
              disabled={hobbies.length >= HOBBIES_MAX}
            />
            <Button type="button" variant="outline" onClick={add} disabled={hobbies.length >= HOBBIES_MAX}>
              <Plus data-icon="inline-start" aria-hidden />
              {t("hobbies.add")}
            </Button>
          </div>
          {hobbyError && (
            <p id={`${ids.hobby}-error`} className="text-sm text-destructive" role="alert">
              {hobbyError}
            </p>
          )}
          {hobbies.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("hobbies.empty")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label={t("hobbies.label")}>
              {hobbies.map((hobby) => (
                <li key={hobby}>
                  <Badge variant="secondary" className="h-7 gap-1 ps-3 pe-1 text-sm font-normal">
                    {hobby}
                    <button
                      type="button"
                      onClick={() => setHobbies(hobbies.filter((item) => item !== hobby))}
                      className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={t("hobbies.remove", { hobby })}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </form>
  );
}
