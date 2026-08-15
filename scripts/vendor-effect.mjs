#!/usr/bin/env node
/**
 * Vendor Effect-TS/effect for coding agents (read-only reference under repos/effect).
 * Default: git subtree (Effect recommendation). Pass --submodule for a submodule instead.
 *
 * Usage:
 *   node scripts/vendor-effect.mjs
 *   node scripts/vendor-effect.mjs --submodule
 *   node scripts/vendor-effect.mjs --pull
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREFIX = "repos/effect";
const REMOTE = "https://github.com/Effect-TS/effect.git";

function effectGitRef() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const raw = pkg.devDependencies?.effect ?? pkg.dependencies?.effect;
  if (!raw) {
    throw new Error("root package.json has no effect dependency to pin the subtree");
  }
  const version = raw.replace(/^[^\d]*/, "");
  return `effect@${version}`;
}

const REF = effectGitRef();

const args = new Set(process.argv.slice(2));
const useSubmodule = args.has("--submodule");
const pull = args.has("--pull");

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: "inherit",
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function ensureVscodeExcludes() {
  const settingsPath = join(ROOT, ".vscode/settings.json");
  let settings = {};
  try {
    settings = JSON.parse(await readFile(settingsPath, "utf8"));
  } catch {
    settings = {};
  }

  const mergeExclude = (key) => {
    const prev = settings[key] ?? {};
    settings[key] = { ...prev, "repos/**": true };
  };
  mergeExclude("files.exclude");
  mergeExclude("files.watcherExclude");
  mergeExclude("search.exclude");

  settings["typescript.preferences.autoImportFileExcludePatterns"] = Array.from(
    new Set([
      ...(settings["typescript.preferences.autoImportFileExcludePatterns"] ?? []),
      "repos/**",
    ]),
  );
  settings["javascript.preferences.autoImportFileExcludePatterns"] = Array.from(
    new Set([
      ...(settings["javascript.preferences.autoImportFileExcludePatterns"] ?? []),
      "repos/**",
    ]),
  );

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  console.log(`Updated ${settingsPath} to exclude repos/** from editor UX.`);
}

async function main() {
  if (!existsSync(join(ROOT, ".git"))) {
    console.error("vendor-effect requires a git checkout (run inside a clone).");
    process.exit(1);
  }

  console.log(`Vendoring ${REMOTE} ${REF} -> ${PREFIX}`);

  if (useSubmodule) {
    if (pull) {
      run("git", ["submodule", "update", "--remote", "--merge", PREFIX]);
    } else if (existsSync(join(ROOT, PREFIX))) {
      console.log(`${PREFIX} already exists. Pass --pull to update the submodule.`);
    } else {
      run("git", ["submodule", "add", "--branch", REF, REMOTE, PREFIX]);
    }
  } else if (pull) {
    if (!existsSync(join(ROOT, PREFIX))) {
      console.error(`${PREFIX} missing. Run without --pull first.`);
      process.exit(1);
    }
    run("git", ["subtree", "pull", "--prefix", PREFIX, REMOTE, REF, "--squash"]);
  } else if (existsSync(join(ROOT, PREFIX))) {
    console.log(`${PREFIX} already exists. Pass --pull to refresh the subtree.`);
  } else {
    run("git", ["subtree", "add", "--prefix", PREFIX, REMOTE, REF, "--squash"]);
  }

  await ensureVscodeExcludes();
  console.log(`
Done. Agents should treat ${PREFIX} as read-only reference.
Application imports stay on npm: effect / @effect/*.
`);
}

await main();
