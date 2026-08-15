import { oc } from "@orpc/contract";

import { AiCapabilitiesResponse, AiCompleteInput, AiCompleteResponse } from "./ai";
import { CheckoutIntent, CreateCheckoutInput, CustomerPortalInput, PortalIntent } from "./billing";
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

export const billing = {
  createCheckout: oc.input(CreateCheckoutInput).output(CheckoutIntent),
  customerPortal: oc.input(CustomerPortalInput).output(PortalIntent),
};

/**
 * Client-safe oRPC contract. Implementations live in apps/api.
 */
export const appContract = {
  health,
  staff,
  ai,
  billing,
};

export type AppContract = typeof appContract;
