import {
  AssignableUserRole,
  type AssignableUserRole as AssignableRole,
} from "@zstack/contracts/staff";

export type { AssignableRole };

export const ASSIGNABLE_ROLES = AssignableUserRole.options;

export const ROLE_LABELS = {
  user: "User (no staff)",
  admin: "Admin",
  support: "Support",
  operations: "Operations",
  owner: "Owner",
} as const satisfies Record<AssignableRole, string>;

export function parseAssignableRole(value: string | null | undefined): AssignableRole {
  if (!value) {
    return "user";
  }

  const primary = value.split(",")[0]?.trim() ?? "user";
  const parsed = AssignableUserRole.safeParse(primary);
  return parsed.success ? parsed.data : "user";
}

export function formatRole(value: string | null | undefined): string {
  if (!value) {
    return "user";
  }
  return value;
}
