export const ROLES = ["owner", "manager", "admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// Which roles may enter each app area. Owner can open every hub.
// Legacy bug fixed: school admins could reach /manager and its platform-wide endpoints.
export const AREA_ACCESS = {
  owner: ["owner"],
  manager: ["manager", "owner"],
  admin: ["admin", "owner"],
  teacher: ["teacher", "owner"],
  student: ["student", "owner"],
} as const satisfies Record<Role, readonly Role[]>;

export type Area = keyof typeof AREA_ACCESS;

export function canAccessArea(role: Role, area: Area): boolean {
  return (AREA_ACCESS[area] as readonly Role[]).includes(role);
}

export function homePath(role: Role): `/${Role}` {
  return `/${role}`;
}

// Roles that must enroll TOTP 2FA and pass step-up for high-risk actions.
export const PRIVILEGED_ROLES = ["owner", "manager", "admin"] as const satisfies readonly Role[];

export function requiresTwoFactor(role: Role): boolean {
  return (PRIVILEGED_ROLES as readonly Role[]).includes(role);
}
