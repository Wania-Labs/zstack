import { access, copyFile, cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { ProjectIdentity } from "./project-identity.js";

export const AGENT_TOOLS = ["claude", "cursor", "opencode", "codex"] as const;
export type AgentTool = (typeof AGENT_TOOLS)[number];

/**
 * MCP servers known to create-zstack.
 *
 * - docs: no account required (or free/public docs fetch)
 * - account: OAuth / per-clone credentials — scaffolded off until the user signs in
 *
 * Do NOT add blockchain Alchemy (`mcp.alchemy.com`) — that is a different product
 * from the Cloudflare IaC package `alchemy` used in this starter.
 */
export const MCP_CATALOG = {
  "cloudflare-docs": {
    group: "docs",
    kind: "remote",
    url: "https://docs.mcp.cloudflare.com/mcp",
    note: "Cloudflare Workers / platform docs",
  },
  context7: {
    group: "docs",
    kind: "remote",
    url: "https://mcp.context7.com/mcp",
    note: "Live library docs (Effect, Drizzle, Hono, TanStack, Better Auth, oRPC, Zod, AI SDK, …)",
  },
  shadcn: {
    group: "docs",
    kind: "local",
    command: "npx",
    args: ["shadcn@latest", "mcp"],
    note: "Component registry for apps/web and apps/admin",
  },
  "cloudflare-bindings": {
    group: "account",
    kind: "remote",
    url: "https://bindings.mcp.cloudflare.com/mcp",
    note: "Cloudflare Workers bindings (OAuth)",
  },
  "cloudflare-observability": {
    group: "account",
    kind: "remote",
    url: "https://observability.mcp.cloudflare.com/mcp",
    note: "Workers logs/metrics (OAuth)",
  },
  sentry: {
    group: "account",
    kind: "remote",
    url: "https://mcp.sentry.dev/mcp",
    note: "Errors/traces when observability is enabled (OAuth)",
  },
  planetscale: {
    group: "account",
    kind: "remote",
    url: "https://mcp.pscale.dev/mcp/planetscale",
    note: "PlanetScale Postgres schema/Insights on deploy (OAuth)",
  },
} as const;

export type McpServerId = keyof typeof MCP_CATALOG;
export type McpSelection = "none" | McpServerId[];
export type SkillsMode = "copy" | "symlink" | "none";

export type AgentPackSelection = {
  tools: AgentTool[];
  mcp: McpSelection;
  /** How to expose `.agent/skills` to Cursor/Claude skill dirs. */
  skills: SkillsMode;
};

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PACKS_DIR = join(PACKAGE_ROOT, "packs");

const DOC_MCP_IDS = (Object.keys(MCP_CATALOG) as McpServerId[]).filter(
  (id) => MCP_CATALOG[id].group === "docs",
);
const ACCOUNT_MCP_IDS = (Object.keys(MCP_CATALOG) as McpServerId[]).filter(
  (id) => MCP_CATALOG[id].group === "account",
);

export function parseAgentToolsArg(raw: string | undefined): "prompt" | AgentTool[] {
  if (raw === undefined) {
    return "prompt";
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "" || trimmed === "none") {
    return [];
  }
  if (trimmed === "all") {
    return [...AGENT_TOOLS];
  }
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const tools: AgentTool[] = [];
  for (const part of parts) {
    if (!(AGENT_TOOLS as readonly string[]).includes(part)) {
      throw new Error(
        `Unknown agent tool "${part}". Use none, all, or a comma list of: ${AGENT_TOOLS.join(", ")}.`,
      );
    }
    if (!tools.includes(part as AgentTool)) {
      tools.push(part as AgentTool);
    }
  }
  return tools;
}

export function parseMcpArg(raw: string | undefined): McpSelection {
  if (raw === undefined || raw.trim() === "") {
    return [...DOC_MCP_IDS];
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "none") {
    return "none";
  }
  if (trimmed === "defaults" || trimmed === "docs") {
    return [...DOC_MCP_IDS];
  }
  if (trimmed === "account") {
    return [...ACCOUNT_MCP_IDS];
  }
  if (trimmed === "all") {
    return [...DOC_MCP_IDS, ...ACCOUNT_MCP_IDS];
  }

  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const ids: McpServerId[] = [];
  for (const part of parts) {
    if (!(part in MCP_CATALOG)) {
      throw new Error(
        `Unknown --mcp value "${part}". Use none, defaults, docs, account, all, or a comma list of: ${Object.keys(MCP_CATALOG).join(", ")}.`,
      );
    }
    if (!ids.includes(part as McpServerId)) {
      ids.push(part as McpServerId);
    }
  }
  return ids;
}

export function parseSkillsArg(raw: string | undefined): SkillsMode {
  if (raw === undefined || raw.trim() === "") {
    return "copy";
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "copy" || trimmed === "symlink" || trimmed === "none") {
    return trimmed;
  }
  throw new Error(`Unknown --skills value "${raw}". Use copy, symlink, or none.`);
}

export async function resolveAgentPackSelection(input: {
  agentToolsArg: string | undefined;
  mcpArg: string | undefined;
  skillsArg: string | undefined;
  yes: boolean;
  isTTY: boolean;
  promptTools: () => Promise<AgentTool[]>;
}): Promise<AgentPackSelection> {
  const parsed = parseAgentToolsArg(input.agentToolsArg);
  let tools: AgentTool[];
  if (parsed === "prompt") {
    if (input.yes || !input.isTTY) {
      tools = [];
    } else {
      tools = await input.promptTools();
    }
  } else {
    tools = parsed;
  }

  let mcp = parseMcpArg(input.mcpArg);
  let skills = parseSkillsArg(input.skillsArg);
  if (tools.length === 0) {
    mcp = "none";
    skills = "none";
  }

  return { tools, mcp, skills };
}

async function ensureDirFor(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDirFor(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function mergeMcpServers(
  filePath: string,
  rootKey: "mcpServers",
  servers: Record<string, unknown>,
): Promise<void> {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    existing = {};
  }
  const prev = (existing[rootKey] as Record<string, unknown> | undefined) ?? {};
  existing[rootKey] = { ...prev, ...servers };
  await writeJson(filePath, existing);
}

function cursorClaudeServers(ids: McpServerId[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    const entry = MCP_CATALOG[id];
    if (entry.kind === "remote") {
      out[id] = { url: entry.url };
    } else {
      out[id] = { command: entry.command, args: [...entry.args] };
    }
  }
  return out;
}

function opencodeServers(ids: McpServerId[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    const entry = MCP_CATALOG[id];
    if (entry.kind === "remote") {
      out[id] = { type: "remote", url: entry.url };
    } else {
      out[id] = { type: "local", command: [entry.command, ...entry.args] };
    }
  }
  return out;
}

async function installSkills(root: string, destRelative: string, mode: SkillsMode): Promise<void> {
  if (mode === "none") {
    return;
  }

  const from = join(root, ".agent/skills");
  const to = join(root, destRelative);
  try {
    await access(from);
  } catch {
    return;
  }

  await rm(to, { recursive: true, force: true });

  if (mode === "symlink") {
    await mkdir(dirname(to), { recursive: true });
    const target = relative(dirname(to), from) || ".";
    await symlink(target, to, process.platform === "win32" ? "junction" : "dir");
    return;
  }

  await cp(from, to, { recursive: true });
}

export async function applyAgentPacks(
  root: string,
  selection: AgentPackSelection,
  identity: ProjectIdentity,
  packsDir: string = PACKS_DIR,
): Promise<void> {
  const { tools, mcp, skills } = selection;
  if (tools.length === 0) {
    return;
  }

  if (tools.includes("claude")) {
    const dest = join(root, "CLAUDE.md");
    await ensureDirFor(dest);
    await copyFile(join(packsDir, "claude/CLAUDE.md"), dest);
    await installSkills(root, ".claude/skills", skills);
  }

  if (tools.includes("cursor")) {
    for (const name of ["contracts.mdc", "effect.mdc"] as const) {
      const src = join(packsDir, "cursor/rules", name);
      const dest = join(root, ".cursor/rules", name);
      await ensureDirFor(dest);
      try {
        await copyFile(src, dest);
      } catch {
        if (name !== "effect.mdc") {
          throw new Error(`Missing cursor pack rule: ${name}`);
        }
      }
    }
    const projectRulePath = join(root, ".cursor/rules", `${identity.slug}.mdc`);
    await ensureDirFor(projectRulePath);
    await writeFile(projectRulePath, renderProjectRule(identity));
    await installSkills(root, ".cursor/skills", skills);
  }

  if (tools.includes("opencode")) {
    const dest = join(root, "opencode.json");
    await ensureDirFor(dest);
    await copyFile(join(packsDir, "opencode/opencode.json"), dest);
  }

  if (mcp === "none") {
    return;
  }

  const mcpServers = cursorClaudeServers(mcp);

  if (tools.includes("claude")) {
    await mergeMcpServers(join(root, ".mcp.json"), "mcpServers", mcpServers);
  }
  if (tools.includes("cursor")) {
    await mergeMcpServers(join(root, ".cursor/mcp.json"), "mcpServers", mcpServers);
  }
  if (tools.includes("opencode")) {
    const dest = join(root, "opencode.json");
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await readFile(dest, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {
        $schema: "https://opencode.ai/config.json",
        instructions: ["AGENTS.md", ".agent/playbooks/*.md"],
      };
    }
    const prevMcp = (existing.mcp as Record<string, unknown> | undefined) ?? {};
    existing.mcp = { ...prevMcp, ...opencodeServers(mcp) };
    await writeJson(dest, existing);
  }
}

export function renderProjectRule(identity: ProjectIdentity): string {
  return `---
description: ${identity.displayName} product monorepo invariants — Alchemy deploy, ports/adapters, contracts-only frontends
alwaysApply: true
---

Read and follow \`AGENTS.md\` at the repo root (and nested \`AGENTS.md\` / \`.agent/playbooks/\` when editing those trees).

Hard constraints: Alchemy is the only deploy path; modules call platform ports; frontends import \`${identity.npm.scope}/contracts\` only; keep \`patches/\`; no secrets in \`product.config.ts\`.
`;
}
