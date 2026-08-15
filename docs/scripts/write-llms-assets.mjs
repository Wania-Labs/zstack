#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DOCS = join(ROOT, "content", "docs");
const PUBLIC = join(ROOT, "public");

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

function collectMdx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectMdx(full, acc);
    else if (name.endsWith(".mdx")) acc.push(full);
  }
  return acc;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { title: "", description: "", body: raw.trim() };
  }
  const fm = match[1];
  const body = match[2].trim();
  const title = fm.match(/^title:\s*(.*)$/m)?.[1]?.trim() ?? "";
  const description = fm.match(/^description:\s*(.*)$/m)?.[1]?.trim() ?? "";
  return { title, description, body };
}

function pageUrl(file) {
  const rel = relative(DOCS, file)
    .replace(/\.mdx$/, "")
    .replaceAll("\\", "/");
  if (rel === "index") return "/docs";
  if (rel.endsWith("/index")) return `/docs/${rel.slice(0, -"/index".length)}`;
  return `/docs/${rel}`;
}

function loadPages() {
  return collectMdx(DOCS)
    .map((file) => {
      const parsed = parseFrontmatter(readFileSync(file, "utf8"));
      return { file, url: pageUrl(file), ...parsed };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
}

function buildIndex(pages) {
  const lines = pages.map((page) => {
    const title = page.title || page.url;
    return page.description
      ? `- [${title}](${page.url}): ${page.description}`
      : `- [${title}](${page.url})`;
  });
  return `${PREFACE}\n## Pages\n\n${lines.join("\n")}\n`;
}

function buildFull(pages) {
  const chunks = pages.map((page) => {
    const title = page.title || page.url;
    const summary = page.description ? `Summary: ${page.description}\n` : "";
    return `# ${title}\n\nSource: ${page.url}.md\n${summary}\n${page.body}`;
  });
  return `# zstack docs (full)\n\nPrefer /llms.txt for an index. This file concatenates every page for offline ingest.\n\n---\n\n${chunks.join("\n\n---\n\n")}\n`;
}

const pages = loadPages();
if (pages.length === 0) {
  console.error("write-llms-assets: no MDX pages under content/docs");
  process.exit(1);
}

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, "llms.txt"), buildIndex(pages));
writeFileSync(join(PUBLIC, "llms-full.txt"), buildFull(pages));
console.log(
  `wrote ${relative(ROOT, join(PUBLIC, "llms.txt"))} and llms-full.txt (${pages.length} pages)`,
);
