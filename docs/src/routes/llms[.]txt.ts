import { buildLlmsIndex, LLMS_HEADERS } from "@/lib/llms-text";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET() {
        return new Response(buildLlmsIndex(), { headers: LLMS_HEADERS });
      },
      HEAD() {
        return new Response(null, { headers: LLMS_HEADERS });
      },
    },
  },
});
