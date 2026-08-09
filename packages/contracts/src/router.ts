import { oc } from "@orpc/contract";

import { AiCapabilitiesResponse, AiCompleteInput, AiCompleteResponse } from "./ai";
import { HealthResponse } from "./health";
import { StaffMeResponse } from "./staff";

export const health = oc.output(HealthResponse);

export const staff = {
  me: oc.output(StaffMeResponse),
};

export const ai = {
  capabilities: oc.output(AiCapabilitiesResponse),
  complete: oc.input(AiCompleteInput).output(AiCompleteResponse),
};

/**
 * Client-safe oRPC contract. Implementations live in apps/api.
 */
export const appContract = {
  health,
  staff,
  ai,
};

export type AppContract = typeof appContract;
