export const ROLES = ["admin", "approver", "analyst"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  approver: "Approver",
  analyst: "Analyst",
};

/** Higher rank implies every capability of the lower ranks. */
const RANK: Record<Role, number> = {
  analyst: 0,
  approver: 1,
  admin: 2,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasRole(role: Role, required: Role | Role[]): boolean {
  const list = Array.isArray(required) ? required : [required];
  return list.some((candidate) => RANK[role] >= RANK[candidate]);
}
