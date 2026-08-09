#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "content", "docs");
const MIN_BYTES = 400;

const REQUIRED = [
  "index",
  "getting-started",
  "local-development",
  "for-agents",
  "concepts/stack-map",
  "concepts/capabilities",
  "concepts/ports-and-adapters",
  "guides/turn-on-email",
  "guides/turn-on-ai",
  "guides/turn-on-observability",
  "guides/swap-email-transport",
  "guides/swap-ai-provider",
  "guides/deploy",
  "guides/staff-console",
  "reference/apps-and-packages",
  "reference/create-zstack",
  "reference/product-config",
  "reference/ai",
  "authoring",
];

const MUST_MENTION = {
  index: ["cloneable", "create-zstack"],
  "concepts/ports-and-adapters": ["Effect", "Layer", "EmailService"],
  "concepts/capabilities": ["absent", "configured", "product.config"],
  "for-agents": ["llms.txt", "llms-full.txt", ".md"],
  "guides/swap-email-transport": ["EmailService", "Bento"],
  "guides/swap-ai-provider": ["capability", "AI_GATEWAY"],
};

function collectMdx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectMdx(full, acc);
    else if (name.endsWith(".mdx")) acc.push(full);
  }
  return acc;
}

const errors = [];
const pages = new Map();

for (const file of collectMdx(ROOT)) {
  const rel = relative(ROOT, file)
    .replace(/\.mdx$/, "")
    .replaceAll("\\", "/");
  pages.set(rel, readFileSync(file, "utf8"));
}

for (const id of REQUIRED) {
  const body = pages.get(id);
  if (!body) {
    errors.push(`missing page: ${id}.mdx`);
    continue;
  }
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes < MIN_BYTES) {
    errors.push(`thin page (${bytes}B < ${MIN_BYTES}B): ${id}.mdx`);
  }
  const needles = MUST_MENTION[id];
  if (needles) {
    for (const needle of needles) {
      if (!body.includes(needle)) {
        errors.push(`page ${id}.mdx must mention "${needle}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("docs completeness failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`docs completeness ok: ${REQUIRED.length} required pages present`);
