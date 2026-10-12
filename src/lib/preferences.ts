// Allowed values of the user preferences edited on /settings. Shared by the settings
// screens (to render the choices) and src/server/modules/settings (to validate them).

/** Preset avatars, stored in users.image as `preset:<id>`. Rendered by <UserAvatar/>. */
export const AVATAR_PRESETS = [
  "aurora",
  "ocean",
  "sunset",
  "forest",
  "berry",
  "citrus",
  "lagoon",
  "dusk",
  "ember",
  "mint",
  "orchid",
  "nebula",
] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export const AVATAR_PREFIX = "preset:";

export function isAvatarPreset(value: unknown): value is AvatarPreset {
  return typeof value === "string" && (AVATAR_PRESETS as readonly string[]).includes(value);
}

/** The preset id stored in users.image, or null for anything else (URL, empty, unknown id). */
export function presetFromImage(image: string | null | undefined): AvatarPreset | null {
  if (!image?.startsWith(AVATAR_PREFIX)) return null;
  const id = image.slice(AVATAR_PREFIX.length);
  return isAvatarPreset(id) ? id : null;
}

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** AI tutor personalities (ported from the legacy student router). Labels live in messages. */
export const TUTOR_PERSONALITIES = ["friend", "strict", "coach", "scientist"] as const;
export type TutorPersonality = (typeof TUTOR_PERSONALITIES)[number];

export const HOBBIES_MAX = 10;
export const HOBBY_MAX_LENGTH = 40;
