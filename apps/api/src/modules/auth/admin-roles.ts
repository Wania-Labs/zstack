import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access";
import { StaffRole } from "@zstack/contracts/staff";

/**
 * Better Auth Admin access for staff who can look up users but not change roles.
 */
const staffReaderAc = defaultAc.newRole({
  user: ["list", "get"],
  session: [],
});

export const betterAuthAdminRoles = {
  admin: adminAc,
  owner: adminAc,
  support: staffReaderAc,
  operations: staffReaderAc,
  user: userAc,
} as const;

export const betterAuthAdminRoleNames = StaffRole.options;
