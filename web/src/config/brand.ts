// The ONLY place the product name lives. UI strings reference it through the
// {brand} token in messages/*.json (see src/i18n/request.ts).
// Phase 6 of the migration flips this to "AXIS".
export const brand = {
  name: "Morix",
  tagline: "Smart Learning Platform",
} as const;
