import { buildLlmsFull, LLMS_HEADERS } from "@/lib/llms-text";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(await buildLlmsFull(), { headers: LLMS_HEADERS });
      },
      HEAD() {
        return new Response(null, { headers: LLMS_HEADERS });
      },
    },
  },
});
