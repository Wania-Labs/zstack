import { Effect } from "effect";

import { AiService } from "../../platform/ai/ai-service";
import type { AiCompleteParams } from "../../platform/ai/ai-service";

export const listAiCapabilities = Effect.fn("listAiCapabilities")(function* () {
  const ai = yield* AiService;
  return yield* ai.listCapabilities();
});

export const completeAi = Effect.fn("completeAi")(function* (input: AiCompleteParams) {
  const ai = yield* AiService;
  return yield* ai.complete(input);
});
