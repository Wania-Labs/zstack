import { ORPCError } from "@orpc/server";
import type { StaffMeResponse } from "@zstack/contracts/staff";

import { isStaff, staffCapabilitiesForRole } from "../auth/staff";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role?: string | null | undefined;
};

/**
 * Staff console session. Server enforces staff status — UI checks are UX only.
 */
export function getStaffMe(user: SessionUser | null | undefined): StaffMeResponse {
  if (!user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const capabilities = staffCapabilitiesForRole(user.role);
  if (!isStaff(capabilities)) {
    throw new ORPCError("FORBIDDEN");
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? null,
    capabilities: [...capabilities],
  };
}
