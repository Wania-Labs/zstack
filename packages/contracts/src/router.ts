import { oc } from "@orpc/contract";

import { HealthResponse } from "./health";

export const health = oc.output(HealthResponse);

/**
 * Client-safe oRPC contract. Implementations live in apps/api.
 */
export const appContract = {
  health,
};

export type AppContract = typeof appContract;
