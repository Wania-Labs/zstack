import { defineCommand, runMain } from "citty";
import { downloadTemplate } from "giget";
import { installDependencies } from "nypm";
import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { applyAgentPacks, resolveAgentPackSelection, type AgentTool } from "./apply-agent-packs.js";
import {
  formatIdentitySummary,
  resolveProjectIdentity,
  type ProjectIdentity,
} from "./project-identity.js";
import { personalizeClone } from "./personalize-identity.js";
import {
  applyPackageManagerChoice,
  isScaffoldPackageManager,
  runScriptCommand,
  stripAuthoringManifest,
  type ScaffoldPackageManager,
} from "./prepare-consumer.js";

/**
 * Paths that belong to zstack authoring — never ship into consumer clones.
 * Keep in sync with AUTHORING.md → Consumer ignore contract.
 *
 * Consumer Cursor packs are written by `applyAgentPacks` after download.
 * Do not put consumer rules under the authoring tree's `.cursor/` — this ignore drops them.
 */
export const CONSUMER_IGNORE = [
  "tech-stack-architecture-guide/**",
  "AUTHORING.md",
  ".cursor/**",
  "create-zstack/**",
  "docs/**",
  "agent-transcripts/**",
  ".audit/**",
  ".github/workflows/publish-create-zstack.yml",
  ".github/workflows/generate-clone.yml",
  ".github/workflows/docs.yml",
  "scripts/smoke-create-zstack",
  "apps/*/.cta.json",
  "repos/**",
] as const;

/** Override with ZSTACK_TEMPLATE (e.g. `git:$(pwd)` or `gh:org/zstack`). */
const DEFAULT_TEMPLATE = process.env.ZSTACK_TEMPLATE?.trim() || "gh:Wania-Labs/zstack";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const PACKAGE_MANAGERS = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
] as const satisfies readonly ScaffoldPackageManager[];

async function resolvePackageManager(options: {
  packageManagerArg: string | undefined;
  yes: boolean;
  isTTY: boolean;
}): Promise<ScaffoldPackageManager> {
  const raw = options.packageManagerArg?.trim().toLowerCase();
  if (raw) {
    if (!isScaffoldPackageManager(raw) || !PACKAGE_MANAGERS.includes(raw)) {
      throw new Error(
        `Unknown --package-manager "${raw}". Use one of: ${PACKAGE_MANAGERS.join(", ")}.`,
      );
    }
    return raw;
  }

  if (options.yes || !options.isTTY) {
    return "pnpm";
  }

  const chosen = await p.select({
    message: "Package manager for install + next steps?",
    options: [
      { value: "pnpm", label: "pnpm (recommended — template is a pnpm workspace)" },
      { value: "npm", label: "npm" },
      { value: "yarn", label: "yarn" },
      { value: "bun", label: "bun" },
    ],
    initialValue: "pnpm",
  });
  if (p.isCancel(chosen)) {
    p.cancel("Scaffold cancelled.");
    process.exit(1);
  }
  return chosen as ScaffoldPackageManager;
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
      description: "Product display name (default: title-cased directory basename)",
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
      description: "Write into an existing directory",
      default: false,
    },
    offline: {
      type: "boolean",
      description: "Prefer giget offline cache",
      default: false,
    },
    install: {
      type: "boolean",
      description: "Install dependencies with nypm after download",
      default: true,
    },
    "package-manager": {
      type: "string",
      description: "Install + next-step package manager: pnpm (default) | npm | yarn | bun",
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

    if (existsSync(dir) && !args.force) {
      console.error(
        `Directory already exists: ${dir}\nPass --force to overwrite into it, or choose another path.`,
      );
      process.exit(1);
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
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      }
    }

    console.log(`Downloading ${args.template} → ${dir}`);
    const result = await downloadTemplate(args.template, {
      dir,
      force: args.force,
      offline: args.offline,
      preferOffline: args.offline,
      ignore: [...CONSUMER_IGNORE],
    });

    console.log(`Template ready at ${result.dir}`);
    await stripAuthoringManifest(result.dir);

    if (identity) {
      try {
        await personalizeClone({ root: result.dir, identity });
        console.log(formatIdentitySummary(identity));
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      }
    } else {
      console.log("Keeping template identity (--keep-identity).");
    }

    let packageManager: ScaffoldPackageManager;
    try {
      packageManager = await resolvePackageManager({
        packageManagerArg: args["package-manager"],
        yes: args.yes,
        isTTY,
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
    await applyPackageManagerChoice(result.dir, packageManager);
    if (packageManager !== "pnpm") {
      console.log(
        `Note: the template is a pnpm workspace. You chose ${packageManager}; scripts that use pnpm filters may need adjusting.`,
      );
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
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }

    if (selection.tools.length > 0) {
      const packIdentity =
        identity ??
        (await resolveProjectIdentity({
          mode: "automatic",
          targetDir: result.dir,
          name: "zstack",
          scope: "@zstack",
        }));
      await applyAgentPacks(result.dir, selection, packIdentity);
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

    if (args.install) {
      // nypm's installDependencies does not take env. Inherit into the child install.
      process.env.SHARP_IGNORE_GLOBAL_LIBVIPS ??= "1";
      console.log(`Installing dependencies with ${packageManager}…`);
      await installDependencies({
        cwd: result.dir,
        silent: false,
        packageManager,
      });
      console.log("Dependencies installed.");
    }

    const run = (script: string) => runScriptCommand(packageManager, script);
    console.log(`
Next:
  cd ${args.dir}
  cp apps/api/.dev.vars.example apps/api/.dev.vars
  ${run("dev:services")}
  ${run("db:migrate")} && ${run("db:seed")}
  ${run("alchemy:dev")}
`);
  },
});

void runMain(main);
