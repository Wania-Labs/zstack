import { z } from "zod";

export const CreateCheckoutInput = z.object({
  customerId: z.string().describe("Organization ID (opaque)"),
  productSlug: z.string().describe("Product slug (e.g., 'pro', 'enterprise')"),
  successUrl: z.string().optional().describe("Optional redirect URL after checkout success"),
});

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutInput>;

export const CheckoutIntent = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("unconfigured"),
  }),
  z.object({
    kind: z.literal("url"),
    url: z.string().url(),
  }),
]);

export type CheckoutIntent = z.infer<typeof CheckoutIntent>;

export const CustomerPortalInput = z.object({
  customerId: z.string().describe("Organization ID (opaque)"),
});

export type CustomerPortalInput = z.infer<typeof CustomerPortalInput>;

export const PortalIntent = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("unconfigured"),
  }),
  z.object({
    kind: z.literal("url"),
    url: z.string().url(),
  }),
]);

export type PortalIntent = z.infer<typeof PortalIntent>;
