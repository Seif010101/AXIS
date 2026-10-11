// Every message namespace. One JSON file per namespace per locale lives in
// messages/<locale>/<namespace>.json. Each feature area owns its namespace, so parallel
// work never edits the same file (see docs/CONVENTIONS.md).
export const namespaces = [
  "common",
  "nav",
  "auth",
  "shell",
  "settings",
  "landing",
  "classroom",
  "assessments",
  "chat",
  "studio",
  "student",
  "library",
  "schools",
  "insights",
] as const;

export type Namespace = (typeof namespaces)[number];
