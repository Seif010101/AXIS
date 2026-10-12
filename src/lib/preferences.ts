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

/** Narrows a string (e.g. a radio group value) to one of the allowed values. */
export function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export type AddHobbyResult =
  | { ok: true; hobbies: string[] }
  | { ok: false; reason: "empty" | "tooLong" | "duplicate" | "limit" };

/**
 * Adds a hobby typed by the student, with the server's rules (trimmed, at most
 * HOBBY_MAX_LENGTH characters, unique ignoring case, at most HOBBIES_MAX entries).
 */
export function addHobby(hobbies: readonly string[], raw: string): AddHobbyResult {
  const hobby = raw.trim().replace(/\s+/g, " ");
  if (!hobby) return { ok: false, reason: "empty" };
  if (hobby.length > HOBBY_MAX_LENGTH) return { ok: false, reason: "tooLong" };
  if (hobbies.some((item) => item.toLocaleLowerCase() === hobby.toLocaleLowerCase())) {
    return { ok: false, reason: "duplicate" };
  }
  if (hobbies.length >= HOBBIES_MAX) return { ok: false, reason: "limit" };
  return { ok: true, hobbies: [...hobbies, hobby] };
}
