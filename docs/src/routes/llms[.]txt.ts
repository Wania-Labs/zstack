import { source } from "@/lib/source";
import { createFileRoute } from "@tanstack/react-router";
import { llms } from "fumadocs-core/source";

const PREFACE = `# zstack docs

> Opinionated TypeScript product starter. Prefer markdown endpoints over HTML when scraping.

## Agent entry

- [/llms.txt](/llms.txt): page index (this file)
- [/llms-full.txt](/llms-full.txt): full concatenated markdown
- Per-page: append \`.md\` to any \`/docs/...\` URL, or send \`Accept: text/markdown\`
- Start here: [/docs/for-agents.md](/docs/for-agents.md)

## Reading order

1. [/docs](/docs) — what zstack is
2. [/docs/getting-started](/docs/getting-started) — scaffold and run
3. [/docs/concepts/capabilities](/docs/concepts/capabilities) — absent vs configured
4. [/docs/concepts/ports-and-adapters](/docs/concepts/ports-and-adapters) — how swaps work
5. Guides under [/docs/guides](/docs/guides) — turn-on and swap how-tos

## Truth rules

- Document implemented starter behavior only. Future architecture-guide chapters are not shipped features.
- Swaps use Effect ports, Layers, product.config.ts, and empty-credential defaults. No plugin registry.
- Consumer clones strip docs/, create-zstack/, tech-stack-architecture-guide/, and AUTHORING.md.

`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET() {
        return new Response(`${PREFACE}\n${llms(source).index()}`, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      },
    },
  },
});
