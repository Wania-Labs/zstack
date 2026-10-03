import { defineCommand, runMain } from "citty";
import { downloadTemplate } from "giget";
import { installDependencies } from "nypm";
import * as p from "@clack/prompts";
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { applyAgentPacks, resolveAgentPackSelection, type AgentTool } from "./apply-agent-packs.js";
import {
  formatIdentitySummary,
  projectNameProblem,
  resolveProjectIdentity,
  type ProjectIdentity,
} from "./project-identity.js";
import { personalizeClone } from "./personalize-identity.js";
import {
  claimTargetDirectory,
  isConsumerIgnored,
  parsePackageManager,
  stripAuthoringManifest,
  type TargetClaim,
} from "./prepare-consumer.js";

/** Override with ZSTACK_TEMPLATE (e.g. `git:$(pwd)` or `gh:org/zstack`). */
const DEFAULT_TEMPLATE = process.env.ZSTACK_TEMPLATE?.trim() || "gh:Wania-Labs/zstack";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

/** Run in the clone so corepack (strict mode) sees its `packageManager` field. */
function isPnpmAvailable(cwd: string): boolean {
  const result = spawnSync("pnpm", ["--version"], {
    cwd,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

const main = defineCommand({
  meta: {
    name: "create-zstack",
    version,
    description: "Scaffold a product from the zstack template (giget + nypm).",
  },
  args: {
    dir: {
      type: "positional",
      description: "Target directory",
      required: false,
      default: "my-product",
    },
    name: {
      type: "string",
      description:
        "Product display name: letters, digits, spaces, . ' & - (max 32). Default: title-cased directory basename",
      required: false,
    },
    scope: {
      type: "string",
      description: "npm scope for workspace packages, with or without @ (default: @<slug>)",
      required: false,
    },
    "keep-identity": {
      type: "boolean",
      description: "Skip product identity personalization (keep template zstack / @zstack names)",
      default: false,
    },
    template: {
      type: "string",
      description: `Template source (default: ${DEFAULT_TEMPLATE})`,
      default: DEFAULT_TEMPLATE,
    },
    force: {
      type: "boolean",
      description: "Write into an existing non-empty directory",
      default: false,
    },
    offline: {
      type: "boolean",
      description: "Prefer giget offline cache",
      default: false,
    },
    install: {
      type: "boolean",
      description: "Install dependencies with pnpm after download",
      default: true,
    },
    "package-manager": {
      type: "string",
      description:
        "Clone install manager. Only pnpm is supported (clones are pnpm workspaces); npm/yarn/bun create still work as launchers",
      required: false,
      alias: "p",
    },
    "agent-tools": {
      type: "string",
      description:
        "Coding-agent packs to write: none | all | comma list (claude,cursor,opencode,codex). Omit to prompt on a TTY; non-TTY / --yes defaults to none.",
      required: false,
    },
    mcp: {
      type: "string",
      description:
        "MCP servers when agent tools are selected: none | defaults|docs | account | all | comma ids (cloudflare-docs,context7,shadcn,cloudflare-bindings,cloudflare-observability,sentry,planetscale). Default: docs group.",
      required: false,
    },
    skills: {
      type: "string",
      description:
        "How to install .agent/skills for Cursor/Claude: copy (default) | symlink | none",
      required: false,
    },
    yes: {
      type: "boolean",
      description: "Skip prompts; agent-tools default to none unless --agent-tools is set",
      default: false,
      alias: "y",
    },
  },
  async run({ args }) {
    const dir = resolve(process.cwd(), args.dir);
    const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

    // Early, friendly check before any prompts. The authoritative claim happens
    // right before download (claimTargetDirectory), since the path can change meanwhile.
    const existing = lstatSync(dir, { throwIfNoEntry: false });
    if (existing) {
      const isDir = existing.isSymbolicLink()
        ? statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true
        : existing.isDirectory();
      if (!isDir) {
        fail(`Target exists and is not a directory: ${dir}`);
      }
      if (readdirSync(dir).length > 0 && !args.force) {
        fail(
          `Directory is not empty: ${dir}\nPass --force to write into it, or choose another path.`,
        );
      }
    }

    let packageManager;
    try {
      packageManager = parsePackageManager(args["package-manager"]);
    } catch (error) {
      fail(error);
    }

    let identity: ProjectIdentity | undefined;
    if (!args["keep-identity"]) {
      try {
        const base = {
          targetDir: dir,
          ...(args.name !== undefined ? { name: args.name } : {}),
          ...(args.scope !== undefined ? { scope: args.scope } : {}),
        };
        identity = await resolveProjectIdentity(
          args.yes || !isTTY
            ? { ...base, mode: "automatic" as const }
            : {
                ...base,
                mode: "interactive" as const,
                promptProjectName: async (defaultName: string) => {
                  const answer = await p.text({
                    message: "Project name?",
                    placeholder: defaultName,
                    defaultValue: defaultName,
                    validate: (value) => {
                      const candidate = value?.trim() || defaultName;
                      return candidate ? projectNameProblem(candidate) : "Project name is empty.";
                    },
                  });
                  if (p.isCancel(answer)) {
                    p.cancel("Scaffold cancelled.");
                    process.exit(1);
                  }
                  return answer;
                },
              },
        );
      } catch (error) {
        fail(error);
      }
    }

    let selection;
    try {
      selection = await resolveAgentPackSelection({
        agentToolsArg: args["agent-tools"],
        mcpArg: args.mcp,
        skillsArg: args.skills,
        yes: args.yes,
        isTTY,
        promptTools: async () => {
          p.intro("create-zstack");
          const chosen = await p.multiselect({
            message: "Which coding-agent packs should we write into the clone?",
            options: [
              { value: "claude", label: "Claude Code (CLAUDE.md + optional .mcp.json)" },
              { value: "cursor", label: "Cursor (.cursor/rules + optional mcp.json)" },
              { value: "opencode", label: "OpenCode (opencode.json)" },
              { value: "codex", label: "Codex (uses shipped AGENTS.md; no extra files)" },
            ],
            required: false,
          });
          if (p.isCancel(chosen)) {
            p.cancel("Scaffold cancelled.");
            process.exit(1);
          }
          return chosen as AgentTool[];
        },
      });
    } catch (error) {
      fail(error);
    }

    // Everything up to the agent packs is template preparation. If any of it fails,
    // do not leave a half-personalized tree behind in a directory we created.
    let cloneDir = dir;
    let claim: TargetClaim | undefined;
    try {
      claim = await claimTargetDirectory(dir, { force: args.force });
      console.log(`Downloading ${args.template} → ${dir}`);
      const result = await downloadTemplate(args.template, {
        dir,
        force: args.force,
        offline: args.offline,
        preferOffline: args.offline,
        ignore: isConsumerIgnored,
      });
      cloneDir = result.dir;

      console.log(`Template ready at ${cloneDir}`);
      await stripAuthoringManifest(cloneDir, { preserve: claim.preserve });

      if (identity) {
        await personalizeClone({ root: cloneDir, identity, preserve: claim.preserve });
        console.log(formatIdentitySummary(identity));
      } else {
        console.log("Keeping template identity (--keep-identity).");
      }

      if (selection.tools.length > 0) {
        const packIdentity =
          identity ??
          (await resolveProjectIdentity({
            mode: "automatic",
            targetDir: cloneDir,
            name: "zstack",
            scope: "@zstack",
          }));
        await applyAgentPacks(cloneDir, selection, packIdentity);
        const toolLabel = selection.tools.join(", ");
        const mcpLabel = selection.mcp === "none" ? "" : ` + MCP (${selection.mcp.join(", ")})`;
        const skillsLabel = selection.skills === "none" ? "" : ` + skills:${selection.skills}`;
        console.log(`Agent packs written: ${toolLabel}${mcpLabel}${skillsLabel}`);
        if (selection.tools.includes("codex") && selection.tools.every((t) => t === "codex")) {
          console.log(
            "Note: Codex uses the shipped AGENTS.md. Configure Codex MCP in ~/.codex/config.toml if needed.",
          );
        }
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      if (claim?.created) {
        await rm(dir, { recursive: true, force: true });
        console.error(`Removed partially created ${dir}.`);
      } else if (claim) {
        console.error(
          `${dir} existed before create-zstack ran, so it was left in place and may contain a partial clone.`,
        );
      }
      process.exit(1);
    }

    let installed = false;
    if (args.install) {
      if (isPnpmAvailable(cloneDir)) {
        // nypm's installDependencies does not take env. Inherit into the child install.
        process.env.SHARP_IGNORE_GLOBAL_LIBVIPS ??= "1";
        console.log(`Installing dependencies with ${packageManager}…`);
        await installDependencies({
          cwd: cloneDir,
          silent: false,
          packageManager,
        });
        console.log("Dependencies installed.");
        installed = true;
      } else {
        console.warn(
          [
            "pnpm was not found on PATH, so dependencies were not installed.",
            "zstack clones are pnpm workspaces. Install pnpm first:",
            "  corepack enable pnpm   (Node 22 ships corepack)",
            "  npm install -g pnpm    (alternative)",
          ].join("\n"),
        );
      }
    }

    console.log(`
Next:
  cd ${args.dir}${installed ? "" : "\n  pnpm install"}
  cp apps/api/.dev.vars.example apps/api/.dev.vars
  pnpm dev:services
  pnpm db:migrate && pnpm db:seed
  pnpm alchemy:dev
`);
  },
});

void runMain(main);
