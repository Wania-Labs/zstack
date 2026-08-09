import { generateText } from "ai";
import { expect } from "vitest";
import { aiSdkHarness } from "@vitest-evals/harness-ai-sdk";
import { describeEval } from "vitest-evals";

import { resolveAiModel } from "../../src/platform/ai/registry";

const harness = aiSdkHarness({
  run: async ({ input }) => {
    const resolved = resolveAiModel("chat.fast", {});
    const result = await generateText({
      model: resolved.model,
      prompt: input,
      temperature: 0,
      maxOutputTokens: 64,
    });
    return { output: result.text, route: resolved.route, modelId: resolved.modelId };
  },
});

describeEval(
  "chat.fast fake model",
  {
    harness,
  },
  (it) => {
    it("answers ping with pong", async ({ run }) => {
      const result = await run("ping");
      expect(result.output).toBe("pong");
    });

    it("prefixes free-form prompts with [fake]", async ({ run }) => {
      const result = await run("hello evals");
      expect(result.output).toBe("[fake] hello evals");
    });
  },
);
