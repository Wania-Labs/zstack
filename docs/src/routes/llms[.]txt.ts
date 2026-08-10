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
3. [/docs/guides/coding-agents](/docs/guides/coding-agents) — AGENTS.md, skills, MCP, Effect
4. [/docs/concepts/capabilities](/docs/concepts/capabilities) — absent vs configured
5. [/docs/concepts/ports-and-adapters](/docs/concepts/ports-and-adapters) — how swaps work
6. Guides under [/docs/guides](/docs/guides) — turn-on and swap how-tos

## Truth rules

- Document implemented starter behavior only. Future architecture-guide chapters are not shipped features.
- Swaps use Effect ports, Layers, product.config.ts, and empty-credential defaults. No plugin registry.
- Consumer clones strip docs/, create-zstack/, tech-stack-architecture-guide/, AUTHORING.md, .cursor/, agent-transcripts/, and .audit/. Clones keep AGENTS.md, .agent/playbooks/, and .agent/skills/; optional tool packs come from create-zstack --agent-tools / --mcp / --skills (copy or symlink). See [/docs/guides/coding-agents](/docs/guides/coding-agents).

`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET() {
        return new Response(`${PREFACE}\n${llms(source).index()}`, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          },
        });
      },
    },
  },
});
