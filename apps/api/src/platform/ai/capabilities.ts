import type { AiCapabilityId } from "@zstack/contracts/ai";

export type AiRoute = "fake" | "gateway";

export type AiCapabilityPolicy = {
  id: AiCapabilityId;
  description: string;
  /** Gateway model id when live routing is available. */
  gatewayModelId: string;
  maxOutputTokens: number;
  temperature: number;
};

/**
 * Product capability → model policy. Feature code asks for capability IDs only.
 * Model strings live here — not in routes, React, or prompts.
 */
export const AI_CAPABILITY_POLICIES = {
  "chat.fast": {
    id: "chat.fast",
    description: "Low-latency chat and short answers.",
    gatewayModelId: "openai/gpt-4.1-mini",
    maxOutputTokens: 2_048,
    temperature: 0.7,
  },
  "chat.smart": {
    id: "chat.smart",
    description: "Higher-quality chat and reasoning within default limits.",
    gatewayModelId: "anthropic/claude-sonnet-4.5",
    maxOutputTokens: 4_096,
    temperature: 0.5,
  },
  "extract.structured": {
    id: "extract.structured",
    description: "Deterministic-leaning extraction into structured fields.",
    gatewayModelId: "openai/gpt-4.1-mini",
    maxOutputTokens: 2_048,
    temperature: 0,
  },
} as const satisfies Record<AiCapabilityId, AiCapabilityPolicy>;

export function listAiCapabilityPolicies(): readonly AiCapabilityPolicy[] {
  return Object.values(AI_CAPABILITY_POLICIES);
}

export function getAiCapabilityPolicy(id: AiCapabilityId): AiCapabilityPolicy {
  return AI_CAPABILITY_POLICIES[id];
}
