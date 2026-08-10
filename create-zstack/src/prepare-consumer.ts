import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { PackageManagerName } from "nypm";

const CREATE_ZSTACK_IMPORTER_RE = /\n {2}create-zstack:\n(?: {4}.*\n)*/;

export async function stripAuthoringManifest(root: string): Promise<void> {
  const workspacePath = join(root, "pnpm-workspace.yaml");
  const workspace = await readFile(workspacePath, "utf8");
  const nextWorkspace = workspace
    .split("\n")
    .filter((line) => !/^\s*-\s*"create-zstack"\s*$/.test(line))
    .join("\n");
  if (nextWorkspace !== workspace) {
    await writeFile(workspacePath, nextWorkspace);
  }

  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
    packageManager?: string;
  };
  if (packageJson.scripts && "create-zstack" in packageJson.scripts) {
    delete packageJson.scripts["create-zstack"];
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  await stripCreateZstackLockfileImporter(root);

  await rm(join(root, ".github/workflows/docs.yml"), { force: true });

  const readmePath = join(root, "README.md");
  try {
    let readme = await readFile(readmePath, "utf8");
    readme = readme
      .replace(
        /^- `create-zstack` \/ `@wanialabs\/create-zstack` scaffold CLI \(excluded from clones\)\n/m,
        "",
      )
      .replace(
        /^- `create-zstack` authoring CLI \(citty \+ giget \+ nypm; excluded from clones\)\n/m,
        "",
      )
      .replace(
        /Product PRs run `\.github\/workflows\/ci\.yml` \(ignores `docs\/\*\*`\)\. Docs changes run `\.github\/workflows\/docs\.yml` against the standalone `docs\/` lockfile\./,
        "Product PRs run `.github/workflows/ci.yml`.",
      )
      .replace(/\nnpm create @wanialabs\/zstack@latest my-app\n/g, "\n")
      .replace(/\npnpm create @wanialabs\/zstack my-app\n/g, "\n")
      .replace(/\npnpm create-zstack my-app\n/g, "\n")
      .replace(/\ncd docs && pnpm install && pnpm dev {3}# authoring docs :4000\n/g, "\n")
      .replace(/\ncreate-zstack\/ {13}# authoring-only scaffold CLI \(not in clones\)\n/g, "\n")
      .replace(
        /\ndocs\/ {22}# authoring-only docs site \(own lockfile\/CI; not in clones\)\n/g,
        "\n",
      )
      .replace(
        /\nSee \[AUTHORING\.md\]\(AUTHORING\.md\)\. Agents: \[AGENTS\.md\]\(AGENTS\.md\)\.\n/g,
        "\nSee [AGENTS.md](AGENTS.md).\n",
      )
      .replace(/\nSee \[AUTHORING\.md\]\(AUTHORING\.md\)\.\n/g, "\n");
    await writeFile(readmePath, readme);
  } catch {
    // README optional
  }
}

/** Drop the authoring CLI importer so consumer `pnpm install --frozen-lockfile` succeeds. */
export async function stripCreateZstackLockfileImporter(root: string): Promise<void> {
  const lockPath = join(root, "pnpm-lock.yaml");
  try {
    const lock = await readFile(lockPath, "utf8");
    const next = lock.replace(CREATE_ZSTACK_IMPORTER_RE, "\n");
    if (next !== lock) {
      await writeFile(lockPath, next);
    }
  } catch {
    // lockfile optional (e.g. non-pnpm install will regenerate)
  }
}

const PACKAGE_MANAGER_FIELD: Record<Exclude<PackageManagerName, "deno" | "aube" | "nub">, string> =
  {
    npm: "npm@10",
    yarn: "yarn@1.22.22",
    pnpm: "pnpm@11.18.0",
    bun: "bun@1.2.0",
  };

export type ScaffoldPackageManager = keyof typeof PACKAGE_MANAGER_FIELD;

export function isScaffoldPackageManager(value: string): value is ScaffoldPackageManager {
  return value in PACKAGE_MANAGER_FIELD;
}

/**
 * Align the clone with the chosen install tool.
 * Non-pnpm drops `pnpm-lock.yaml` so nypm does not keep selecting pnpm from the lockfile.
 */
export async function applyPackageManagerChoice(
  root: string,
  packageManager: ScaffoldPackageManager,
): Promise<void> {
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
    packageManager?: string;
  };
  packageJson.packageManager = PACKAGE_MANAGER_FIELD[packageManager];
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  if (packageManager !== "pnpm") {
    await rm(join(root, "pnpm-lock.yaml"), { force: true });
  }
}

export function runScriptCommand(packageManager: ScaffoldPackageManager, script: string): string {
  switch (packageManager) {
    case "npm":
      return `npm run ${script}`;
    case "yarn":
      return `yarn ${script}`;
    case "bun":
      return `bun run ${script}`;
    case "pnpm":
      return `pnpm ${script}`;
    default: {
      const _exhaustive: never = packageManager;
      return _exhaustive;
    }
  }
}
