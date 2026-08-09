import type {
  AiCapabilitiesResponse,
  AiCapabilityId,
  AiCompleteResponse,
} from "@zstack/contracts/ai";
import { generateText } from "ai";
import { Context, Effect, Layer, Schema } from "effect";

import { listAiCapabilityPolicies } from "./capabilities";
import { resolveAiModel, resolveAiRoute, type AiRegistryEnv } from "./registry";

export class AiError extends Schema.TaggedError<AiError>()("AiError", {
  message: Schema.String,
}) {}

export type AiCompleteParams = {
  capability: AiCapabilityId;
  prompt: string;
};

/**
 * Application AI boundary. Domain code asks for capabilities; the registry
 * owns provider/model routing (fake locally, Vercel AI Gateway when keyed).
 */
export class AiService extends Context.Service<
  AiService,
  {
    listCapabilities(): Effect.Effect<AiCapabilitiesResponse, never>;
    complete(input: AiCompleteParams): Effect.Effect<AiCompleteResponse, AiError>;
  }
>()("@zstack/api/platform/ai/AiService") {}

function makeAiService(env: AiRegistryEnv): AiService["Service"] {
  const route = resolveAiRoute(env);

  return AiService.of({
    listCapabilities: () =>
      Effect.succeed({
        provider: route,
        capabilities: listAiCapabilityPolicies().map((policy) => ({
          id: policy.id,
          description: policy.description,
          route,
          maxOutputTokens: policy.maxOutputTokens,
        })),
      }),
    complete: (input) =>
      Effect.tryPromise({
        try: async () => {
          const resolved = resolveAiModel(input.capability, env);
          const result = await generateText({
            model: resolved.model,
            prompt: input.prompt,
            temperature: resolved.policy.temperature,
            maxOutputTokens: resolved.policy.maxOutputTokens,
          });

          return {
            capability: input.capability,
            text: result.text,
            route: resolved.route,
            modelId: resolved.modelId,
          } satisfies AiCompleteResponse;
        },
        catch: (cause) =>
          new AiError({
            message:
              cause instanceof Error
                ? `ai complete failed: ${cause.message}`
                : "ai complete failed",
          }),
      }),
  });
}

export function AiLive(env: AiRegistryEnv): Layer.Layer<AiService> {
  return Layer.succeed(AiService, makeAiService(env));
}

/** Template default — always fake, no network. */
export const FakeAiLive = AiLive({});

export async function runAiEffect<A, E>(
  effect: Effect.Effect<A, E, AiService>,
  live: Layer.Layer<AiService> = FakeAiLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
