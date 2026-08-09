import { createGateway } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";
import type { AiCapabilityId } from "@zstack/contracts/ai";

import { getAiCapabilityPolicy, type AiCapabilityPolicy, type AiRoute } from "./capabilities";
import { createFakeLanguageModel } from "./fake-model";

export type AiRegistryEnv = {
  AI_GATEWAY_API_KEY?: string;
};

export type ResolvedAiModel = {
  capability: AiCapabilityId;
  policy: AiCapabilityPolicy;
  route: AiRoute;
  modelId: string;
  model: LanguageModel;
};

export function readAiGatewayApiKey(env: AiRegistryEnv): string | undefined {
  const key = env.AI_GATEWAY_API_KEY?.trim();
  return key || undefined;
}

export function resolveAiRoute(env: AiRegistryEnv): AiRoute {
  return readAiGatewayApiKey(env) ? "gateway" : "fake";
}

/**
 * Resolve a product capability to an AI SDK language model.
 * Empty/missing gateway key → deterministic fake (template-safe default).
 */
export function resolveAiModel(capability: AiCapabilityId, env: AiRegistryEnv): ResolvedAiModel {
  const policy = getAiCapabilityPolicy(capability);
  const apiKey = readAiGatewayApiKey(env);

  if (!apiKey) {
    const modelId = `fake/${policy.id}`;
    return {
      capability,
      policy,
      route: "fake",
      modelId,
      model: createFakeLanguageModel(modelId),
    };
  }

  const gateway = createGateway({ apiKey });
  return {
    capability,
    policy,
    route: "gateway",
    modelId: policy.gatewayModelId,
    model: gateway.languageModel(policy.gatewayModelId),
  };
}
