#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "content", "docs");
const MIN_BYTES = 700;
const INDEX_MIN_BYTES = 250;

const REQUIRED = [
  "index",
  "getting-started",
  "local-development",
  "for-agents",
  "concepts/index",
  "concepts/stack-map",
  "concepts/capabilities",
  "concepts/ports-and-adapters",
  "guides/index",
  "guides/coding-agents",
  "guides/turn-on-email",
  "guides/turn-on-ai",
  "guides/turn-on-observability",
  "guides/turn-on-billing",
  "guides/swap-email-transport",
  "guides/swap-ai-provider",
  "guides/deploy",
  "guides/staff-console",
  "reference/index",
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
  "for-agents": ["llms.txt", "llms-full.txt", ".md", "coding-agents"],
  "guides/coding-agents": [
    "AGENTS.md",
    "--skills",
    "symlink",
    "context7",
    "vendor-effect",
    "Agent setup prompt",
    "Set up this zstack product for coding agents",
  ],
  "guides/swap-email-transport": ["EmailService", "Bento"],
  "guides/swap-ai-provider": ["capability", "AI_GATEWAY"],
  "guides/turn-on-observability": ["VITE_SENTRY_DSN_WEB", "VITE_SENTRY_DSN_ADMIN"],
  "reference/create-zstack": [".audit/**", "agent-transcripts/**"],
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
  const min = id.endsWith("/index") || id === "index" ? INDEX_MIN_BYTES : MIN_BYTES;
  if (bytes < min) {
    errors.push(`thin page (${bytes}B < ${min}B): ${id}.mdx`);
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
