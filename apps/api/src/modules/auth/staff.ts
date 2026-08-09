import { StaffRole, type StaffCapability } from "@zstack/contracts/staff";

/**
 * Better Auth `user.role` may be a single role or comma-separated list.
 * Product authorization uses capabilities, not role string equality.
 */
export const STAFF_CAPABILITY = {
  console: "staff.console",
} as const satisfies Record<string, StaffCapability>;

const ROLE_CAPABILITIES: Record<StaffRole, readonly StaffCapability[]> = {
  admin: [STAFF_CAPABILITY.console],
  support: [STAFF_CAPABILITY.console],
  operations: [STAFF_CAPABILITY.console],
  owner: [STAFF_CAPABILITY.console],
};

export function staffCapabilitiesForRole(
  role: string | null | undefined,
): ReadonlySet<StaffCapability> {
  if (!role) {
    return new Set();
  }

  const capabilities = new Set<StaffCapability>();
  for (const part of role.split(",")) {
    const key = part.trim();
    if (!key) continue;
    const parsed = StaffRole.safeParse(key);
    if (!parsed.success) continue;
    for (const capability of ROLE_CAPABILITIES[parsed.data]) {
      capabilities.add(capability);
    }
  }
  return capabilities;
}

export function isStaff(capabilities: ReadonlySet<string> | undefined): boolean {
  return capabilities?.has(STAFF_CAPABILITY.console) ?? false;
}

export function requireStaffCapability(
  capabilities: ReadonlySet<string> | undefined,
  capability: StaffCapability,
): boolean {
  return capabilities?.has(capability) ?? false;
}
