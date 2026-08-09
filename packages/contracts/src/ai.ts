import { z } from "zod";

export const AiCapabilityId = z.enum(["chat.fast", "chat.smart", "extract.structured"]);

export type AiCapabilityId = z.infer<typeof AiCapabilityId>;

export const AiCapabilitySummary = z
  .object({
    id: AiCapabilityId,
    description: z.string().min(1),
    /** Resolved only when a live gateway key is bound; otherwise `fake`. */
    route: z.enum(["fake", "gateway"]),
    maxOutputTokens: z.number().int().positive(),
  })
  .strict();

export type AiCapabilitySummary = z.infer<typeof AiCapabilitySummary>;

export const AiCapabilitiesResponse = z
  .object({
    capabilities: z.array(AiCapabilitySummary),
    provider: z.enum(["fake", "gateway"]),
  })
  .strict();

export type AiCapabilitiesResponse = z.infer<typeof AiCapabilitiesResponse>;

export const AiCompleteInput = z
  .object({
    capability: AiCapabilityId,
    prompt: z.string().min(1).max(32_000),
  })
  .strict();

export type AiCompleteInput = z.infer<typeof AiCompleteInput>;

export const AiCompleteResponse = z
  .object({
    capability: AiCapabilityId,
    text: z.string(),
    route: z.enum(["fake", "gateway"]),
    modelId: z.string().min(1),
  })
  .strict();

export type AiCompleteResponse = z.infer<typeof AiCompleteResponse>;
