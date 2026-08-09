import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModel } from "ai";

function emptyUsage() {
  return {
    inputTokens: {
      total: 0,
      noCache: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    outputTokens: {
      total: 0,
      text: 0,
      reasoning: 0,
    },
  };
}

/**
 * Deterministic local model for clones without `AI_GATEWAY_API_KEY`.
 * Echoes a stable reply so tests/evals and local smoke never spend.
 */
export function createFakeLanguageModel(modelId = "fake/local"): LanguageModel {
  return new MockLanguageModelV4({
    provider: "zstack-fake",
    modelId,
    doGenerate: async ({ prompt }) => {
      const lastUser = [...prompt].reverse().find((message) => message.role === "user");
      let userText = "";
      if (lastUser?.role === "user") {
        userText = lastUser.content
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n");
      }

      const trimmed = userText.trim();
      const text =
        trimmed.length === 0
          ? "[fake] empty prompt"
          : trimmed.toLowerCase() === "ping"
            ? "pong"
            : `[fake] ${trimmed}`;

      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: emptyUsage(),
        warnings: [],
      };
    },
  });
}
