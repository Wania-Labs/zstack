import { createFileRoute } from "@tanstack/react-router";
import { source, getLLMText } from "@/lib/source";

const HEADER = `# zstack docs (full)

Prefer /llms.txt for an index. This file concatenates every page for offline ingest.

---

`;

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const scan = source.getPages().map(getLLMText);
        const scanned = await Promise.all(scan);
        return new Response(`${HEADER}${scanned.join("\n\n---\n\n")}`, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      },
    },
  },
});
