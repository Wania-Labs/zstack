import { oc } from "@orpc/contract";

import { HealthResponse } from "./health";
import { StaffMeResponse } from "./staff";

export const health = oc.output(HealthResponse);

export const staff = {
  me: oc.output(StaffMeResponse),
};

/**
 * Client-safe oRPC contract. Implementations live in apps/api.
 */
export const appContract = {
  health,
  staff,
};

export type AppContract = typeof appContract;
