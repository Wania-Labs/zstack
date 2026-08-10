import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  applyAgentPacks,
  parseAgentToolsArg,
  parseMcpArg,
  parseSkillsArg,
  resolveAgentPackSelection,
  PACKS_DIR,
  MCP_CATALOG,
  type McpSelection,
} from "./apply-agent-packs.js";

function requireMcpList(raw: string): Exclude<McpSelection, "none"> {
  const parsed = parseMcpArg(raw);
  assert.notEqual(parsed, "none");
  return parsed as Exclude<McpSelection, "none">;
}

void test("parseAgentToolsArg accepts none, all, and comma lists", () => {
  assert.deepEqual(parseAgentToolsArg("none"), []);
  assert.deepEqual(parseAgentToolsArg("all"), ["claude", "cursor", "opencode", "codex"]);
  assert.deepEqual(parseAgentToolsArg("claude,cursor"), ["claude", "cursor"]);
  assert.equal(parseAgentToolsArg(undefined), "prompt");
  assert.throws(() => parseAgentToolsArg("windsurf"), /Unknown agent tool/);
});

void test("parseMcpArg accepts presets and catalog ids", () => {
  const docs = parseMcpArg("defaults");
  assert.ok(Array.isArray(docs));
  assert.ok(docs.includes("cloudflare-docs"));
  assert.ok(docs.includes("context7"));
  assert.ok(docs.includes("shadcn"));
  assert.equal(docs.includes("sentry"), false);

  const account = parseMcpArg("account");
  assert.ok(Array.isArray(account));
  assert.ok(account.includes("sentry"));
  assert.ok(account.includes("planetscale"));

  const all = parseMcpArg("all");
  assert.ok(Array.isArray(all));
  assert.equal(all.length, Object.keys(MCP_CATALOG).length);

  assert.equal(parseMcpArg("none"), "none");
  assert.deepEqual(parseMcpArg("sentry,context7"), ["sentry", "context7"]);
  assert.throws(() => parseMcpArg("not-a-server"), /Unknown --mcp/);
});

void test("parseSkillsArg accepts copy, symlink, none", () => {
  assert.equal(parseSkillsArg(undefined), "copy");
  assert.equal(parseSkillsArg("copy"), "copy");
  assert.equal(parseSkillsArg("symlink"), "symlink");
  assert.equal(parseSkillsArg("none"), "none");
  assert.throws(() => parseSkillsArg("hardlink"), /Unknown --skills/);
});

void test("resolveAgentPackSelection skips prompt when yes or non-TTY", async () => {
  const selection = await resolveAgentPackSelection({
    agentToolsArg: undefined,
    mcpArg: undefined,
    skillsArg: undefined,
    yes: true,
    isTTY: true,
    promptTools: async () => {
      throw new Error("should not prompt");
    },
  });
  assert.deepEqual(selection, { tools: [], mcp: "none", skills: "none" });
});

void test("applyAgentPacks writes packs, skills copy, and expanded MCP defaults", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-packs-"));
  try {
    await mkdir(join(root, ".agent/skills/effect-ts"), { recursive: true });
    await writeFile(
      join(root, ".agent/skills/effect-ts/SKILL.md"),
      "---\nname: effect-ts\n---\n# test\n",
    );

    await applyAgentPacks(
      root,
      {
        tools: ["claude", "cursor", "opencode", "codex"],
        mcp: requireMcpList("defaults"),
        skills: "copy",
      },
      PACKS_DIR,
    );

    const claude = await readFile(join(root, "CLAUDE.md"), "utf8");
    assert.match(claude, /@AGENTS\.md/);
    assert.match(claude, /effect\/AGENTS\.md/);

    const skill = await readFile(join(root, ".claude/skills/effect-ts/SKILL.md"), "utf8");
    assert.match(skill, /effect-ts/);

    const cursorSkill = await readFile(join(root, ".cursor/skills/effect-ts/SKILL.md"), "utf8");
    assert.match(cursorSkill, /effect-ts/);

    const effectRule = await readFile(join(root, ".cursor/rules/effect.mdc"), "utf8");
    assert.match(effectRule, /node_modules\/effect\/AGENTS\.md/);

    const cursorMcp = JSON.parse(await readFile(join(root, ".cursor/mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.ok(cursorMcp.mcpServers["cloudflare-docs"]);
    assert.ok(cursorMcp.mcpServers.context7);
    assert.ok(cursorMcp.mcpServers.shadcn);
    assert.equal(cursorMcp.mcpServers.sentry, undefined);

    const opencode = JSON.parse(await readFile(join(root, "opencode.json"), "utf8")) as {
      mcp: Record<string, unknown>;
    };
    assert.ok(opencode.mcp.context7);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("applyAgentPacks can symlink skills into tool dirs", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-packs-symlink-"));
  try {
    await mkdir(join(root, ".agent/skills/effect-ts"), { recursive: true });
    await writeFile(
      join(root, ".agent/skills/effect-ts/SKILL.md"),
      "---\nname: effect-ts\n---\n# linked\n",
    );

    await applyAgentPacks(
      root,
      { tools: ["claude", "cursor"], mcp: "none", skills: "symlink" },
      PACKS_DIR,
    );

    const claudeStat = await lstat(join(root, ".claude/skills"));
    assert.equal(claudeStat.isSymbolicLink(), true);
    const cursorStat = await lstat(join(root, ".cursor/skills"));
    assert.equal(cursorStat.isSymbolicLink(), true);

    const target = await readlink(join(root, ".cursor/skills"));
    assert.match(target, /\.agent\/skills/);

    const viaLink = await readFile(join(root, ".cursor/skills/effect-ts/SKILL.md"), "utf8");
    assert.match(viaLink, /linked/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("applyAgentPacks with skills none skips skill dirs", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-packs-noskills-"));
  try {
    await mkdir(join(root, ".agent/skills/effect-ts"), { recursive: true });
    await writeFile(join(root, ".agent/skills/effect-ts/SKILL.md"), "# x\n");
    await applyAgentPacks(root, { tools: ["claude"], mcp: "none", skills: "none" }, PACKS_DIR);
    await readFile(join(root, "CLAUDE.md"), "utf8");
    await assert.rejects(readFile(join(root, ".claude/skills/effect-ts/SKILL.md")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("applyAgentPacks with mcp all includes account servers", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-packs-all-"));
  try {
    await applyAgentPacks(
      root,
      { tools: ["claude"], mcp: requireMcpList("all"), skills: "none" },
      PACKS_DIR,
    );
    const mcp = JSON.parse(await readFile(join(root, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.ok(mcp.mcpServers.sentry);
    assert.ok(mcp.mcpServers.planetscale);
    assert.ok(mcp.mcpServers["cloudflare-bindings"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("applyAgentPacks with mcp none skips MCP files", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-packs-nomcp-"));
  try {
    await applyAgentPacks(root, { tools: ["claude"], mcp: "none", skills: "none" }, PACKS_DIR);
    await assert.rejects(readFile(join(root, ".mcp.json")));
    await readFile(join(root, "CLAUDE.md"), "utf8");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("applyAgentPacks is a no-op when tools empty", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-packs-empty-"));
  try {
    await mkdir(root, { recursive: true });
    await applyAgentPacks(
      root,
      { tools: [], mcp: requireMcpList("defaults"), skills: "copy" },
      PACKS_DIR,
    );
    await assert.rejects(readFile(join(root, "CLAUDE.md")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("applyAgentPacks merges into existing cursor mcp.json", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-packs-merge-"));
  try {
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(
      join(root, ".cursor/mcp.json"),
      `${JSON.stringify({ mcpServers: { custom: { url: "https://example.com/mcp" } } }, null, 2)}\n`,
    );
    await applyAgentPacks(
      root,
      { tools: ["cursor"], mcp: requireMcpList("defaults"), skills: "none" },
      PACKS_DIR,
    );
    const mcp = JSON.parse(await readFile(join(root, ".cursor/mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.ok(mcp.mcpServers.custom);
    assert.ok(mcp.mcpServers.context7);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
