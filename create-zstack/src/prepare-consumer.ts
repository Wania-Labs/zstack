import { lstat, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { formatJson } from "./format-json.js";

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

/**
 * Authoring-only directories removed again after download. giget's string
 * `ignore` uses `path.matchesGlob`, whose `**` skips dotfiles, so a glob alone
 * leaked `docs/.npmrc` and friends. `isConsumerIgnored` fixes the matcher; this
 * sweep keeps clones clean even if a future template source bypasses it.
 */
export const AUTHORING_DIRECTORIES = [
  "tech-stack-architecture-guide",
  ".cursor",
  "create-zstack",
  "docs",
  "agent-transcripts",
  ".audit",
  "repos",
] as const;

function globSegmentToRegExp(segment: string): string {
  return segment
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
}

function compileIgnorePattern(pattern: string): (path: string) => boolean {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -"/**".length);
    const prefixRe = new RegExp(`^${prefix.split("/").map(globSegmentToRegExp).join("/")}(?:/|$)`);
    return (path) => prefixRe.test(path);
  }
  const exactRe = new RegExp(`^${pattern.split("/").map(globSegmentToRegExp).join("/")}/?$`);
  return (path) => exactRe.test(path);
}

const CONSUMER_IGNORE_MATCHERS = CONSUMER_IGNORE.map(compileIgnorePattern);

/**
 * giget `ignore` predicate. Unlike `path.matchesGlob`, `*` and `**` here match
 * dot-prefixed names, so `docs/.npmrc` is ignored along with `docs/README.md`.
 */
export function isConsumerIgnored(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").replace(/^\.?\//, "");
  if (!normalized) {
    return false;
  }
  return CONSUMER_IGNORE_MATCHERS.some((matches) => matches(normalized));
}

const AUTHORING_FILES = [
  "AUTHORING.md",
  ".github/workflows/publish-create-zstack.yml",
  ".github/workflows/generate-clone.yml",
  ".github/workflows/docs.yml",
  "scripts/smoke-create-zstack",
] as const;

/** Lint/format ignore entries that only exist for authoring directories. */
const AUTHORING_IGNORE_PATTERNS = new Set(["docs/**", "tech-stack-architecture-guide/**"]);

const CREATE_ZSTACK_IMPORTER_RE = /\n {2}create-zstack:\n(?: {4}.*\n)*/;

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function listCtaJsonPaths(root: string): Promise<string[]> {
  let apps: string[];
  try {
    apps = await readdir(join(root, "apps"));
  } catch {
    return [];
  }
  return apps.map((app) => `apps/${app}/.cta.json`);
}

/**
 * Relative paths the authoring sweep would delete that already exist in the
 * target *before* download. `create-zstack . --force` into an existing repo
 * must never delete the user's own `docs/`, `.cursor/`, `repos/`, …
 */
export async function snapshotPreexistingSweepTargets(root: string): Promise<Set<string>> {
  const preexisting = new Set<string>();
  const candidates = [
    ...AUTHORING_DIRECTORIES,
    ...AUTHORING_FILES,
    ...(await listCtaJsonPaths(root)),
  ];
  for (const rel of candidates) {
    if (await pathExists(join(root, rel))) {
      preexisting.add(rel);
    }
  }
  return preexisting;
}

export type TargetClaim = Readonly<{
  /** True only when this call created the directory; only then may cleanup remove it. */
  created: boolean;
  /** Sweep targets that already existed (empty when `created`). */
  preserve: ReadonlySet<string>;
}>;

/**
 * Claim the target right before download. A non-recursive `mkdir` either
 * creates the directory (so we own it and may remove it on failure) or fails
 * with EEXIST, in which case the existing entry is validated with `lstat`
 * semantics and is never removed by cleanup — including a dangling symlink, or
 * a directory that appeared while prompts were open.
 */
export async function claimTargetDirectory(
  dir: string,
  options: Readonly<{ force: boolean }>,
): Promise<TargetClaim> {
  await mkdir(dirname(dir), { recursive: true });
  try {
    await mkdir(dir);
    return { created: true, preserve: new Set() };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }

  const info = await lstat(dir);
  if (info.isSymbolicLink()) {
    const target = await stat(dir).catch(() => undefined);
    if (!target?.isDirectory()) {
      throw new Error(`Target is a symlink that does not point to a directory: ${dir}`);
    }
  } else if (!info.isDirectory()) {
    throw new Error(`Target exists and is not a directory: ${dir}`);
  }
  if ((await readdir(dir)).length > 0 && !options.force) {
    throw new Error(
      `Directory is not empty: ${dir}\nPass --force to write into it, or choose another path.`,
    );
  }
  return { created: false, preserve: await snapshotPreexistingSweepTargets(dir) };
}

export type StripAuthoringOptions = Readonly<{
  /** Paths from `snapshotPreexistingSweepTargets`; never deleted. */
  preserve?: ReadonlySet<string>;
}>;

export async function stripAuthoringManifest(
  root: string,
  options: StripAuthoringOptions = {},
): Promise<void> {
  const preserve = options.preserve ?? new Set<string>();
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
  };
  if (packageJson.scripts) {
    let scriptsChanged = false;
    for (const name of ["create-zstack", "smoke:create"] as const) {
      if (name in packageJson.scripts) {
        delete packageJson.scripts[name];
        scriptsChanged = true;
      }
    }
    if (scriptsChanged) {
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    }
  }

  await stripCreateZstackLockfileImporter(root);

  for (const dir of AUTHORING_DIRECTORIES) {
    if (!preserve.has(dir)) {
      await rm(join(root, dir), { recursive: true, force: true });
    }
  }
  for (const file of [...AUTHORING_FILES, ...(await listCtaJsonPaths(root))]) {
    if (!preserve.has(file)) {
      await rm(join(root, file), { force: true });
    }
  }

  for (const config of [".oxlintrc.json", ".oxfmtrc.json"] as const) {
    await stripAuthoringIgnorePatterns(join(root, config));
  }

  await rewriteIfPresent(join(root, ".github/workflows/ci.yml"), (ci) =>
    ci.replace(
      /\n {4}paths-ignore:\n {6}- "docs\/\*\*"\n {6}- "\.github\/workflows\/docs\.yml"(?=\n)/g,
      "",
    ),
  );

  await rewriteIfPresent(join(root, "product.config.ts"), (product) =>
    product.replace(/^ \* See AUTHORING\.md → Template wiring policy\.\n/m, ""),
  );

  await rewriteIfPresent(join(root, "README.md"), (readme) =>
    readme
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
      .replace(/\npnpm create @wanialabs\/zstack(?:@latest)? my-app\n/g, "\n")
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
      .replace(/\nSee \[AUTHORING\.md\]\(AUTHORING\.md\)\.\n/g, "\n"),
  );
}

async function rewriteIfPresent(path: string, rewrite: (text: string) => string): Promise<void> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return;
  }
  const next = rewrite(text);
  if (next !== text) {
    await writeFile(path, next);
  }
}

async function stripAuthoringIgnorePatterns(path: string): Promise<void> {
  let config: { ignorePatterns?: unknown };
  try {
    config = JSON.parse(await readFile(path, "utf8")) as { ignorePatterns?: unknown };
  } catch {
    return;
  }
  if (!Array.isArray(config.ignorePatterns)) {
    return;
  }
  const next = config.ignorePatterns.filter(
    (pattern) => typeof pattern !== "string" || !AUTHORING_IGNORE_PATTERNS.has(pattern),
  );
  if (next.length === config.ignorePatterns.length) {
    return;
  }
  config.ignorePatterns = next;
  await writeFile(path, formatJson(config));
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
    // lockfile optional
  }
}

/**
 * Clones are pnpm workspaces: `workspace:*` specifiers, `pnpm-workspace.yaml`,
 * `pnpm --filter` root scripts, and a committed `pnpm-lock.yaml`. npm, yarn,
 * and bun cannot install them as-is, so the clone's install manager is always
 * pnpm. (`npm create` / `yarn create` / `bunx` are fine as *launchers*.)
 */
export type ScaffoldPackageManager = "pnpm";

export function parsePackageManager(raw: string | undefined): ScaffoldPackageManager {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "pnpm") {
    return "pnpm";
  }
  throw new Error(
    `Unsupported --package-manager "${raw}". zstack clones are pnpm workspaces ` +
      "(workspace:* deps, pnpm-workspace.yaml, pnpm --filter scripts), so only pnpm is supported. " +
      "You can still launch the CLI with npm/yarn/bun create; the clone installs with pnpm.",
  );
}
