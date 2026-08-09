import { defineCommand, runMain } from "citty";
import { downloadTemplate } from "giget";
import { installDependencies } from "nypm";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Paths that belong to zstack authoring — never ship into consumer clones.
 * Keep in sync with AUTHORING.md → Consumer ignore contract.
 */
export const CONSUMER_IGNORE = [
  "tech-stack-architecture-guide/**",
  "AUTHORING.md",
  ".cursor/**",
  "create-zstack/**",
  "agent-transcripts/**",
] as const;

/** Override with ZSTACK_TEMPLATE (e.g. `file:../zstack` or `gh:org/zstack`). */
const DEFAULT_TEMPLATE = process.env.ZSTACK_TEMPLATE?.trim() || "gh:Wania-Labs/zstack";

const main = defineCommand({
  meta: {
    name: "create-zstack",
    version: "0.0.0",
    description: "Scaffold a product from the zstack template (giget + nypm).",
  },
  args: {
    dir: {
      type: "positional",
      description: "Target directory",
      required: false,
      default: "my-product",
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
  },
  async run({ args }) {
    const dir = resolve(process.cwd(), args.dir);

    if (existsSync(dir) && !args.force) {
      console.error(
        `Directory already exists: ${dir}\nPass --force to overwrite into it, or choose another path.`,
      );
      process.exit(1);
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

    if (args.install) {
      console.log("Installing dependencies…");
      await installDependencies({
        cwd: result.dir,
        silent: false,
      });
      console.log("Dependencies installed.");
    }

    console.log(`
Next:
  cd ${args.dir}
  cp apps/api/.dev.vars.example apps/api/.dev.vars
  pnpm dev:services
  pnpm db:migrate && pnpm db:seed
  pnpm alchemy:dev
`);
  },
});

void runMain(main);
