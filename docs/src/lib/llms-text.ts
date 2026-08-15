import { getLLMText, source } from "@/lib/source";
import { llms } from "fumadocs-core/source";

export const LLMS_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=60",
} as const;

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

function pagesIndex() {
  const pages = source.getPages();
  if (pages.length === 0) {
    return llms(source).index();
  }

  const lines = [...pages]
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((page) => {
      const title = page.data.title || page.url;
      const description = page.data.description?.trim();
      return description
        ? `- [${title}](${page.url}): ${description}`
        : `- [${title}](${page.url})`;
    });

  return `## Pages\n\n${lines.join("\n")}`;
}

export function buildLlmsIndex() {
  return `${PREFACE}\n${pagesIndex()}\n`;
}

export async function buildLlmsFull() {
  const pages = source.getPages();
  const scanned = await Promise.all(pages.map(getLLMText));
  return `# zstack docs (full)

Prefer /llms.txt for an index. This file concatenates every page for offline ingest.

---

${scanned.join("\n\n---\n\n")}
`;
}
