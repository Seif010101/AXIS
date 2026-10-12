/** The /settings sections, in display order. `learning` is shown to students only. */
export const SETTINGS_TABS = ["profile", "appearance", "language", "notifications", "learning", "security"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
