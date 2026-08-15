import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  applyPackageManagerChoice,
  runScriptCommand,
  stripAuthoringManifest,
  stripCreateZstackLockfileImporter,
} from "./prepare-consumer.js";

void test("stripAuthoringManifest removes create-zstack workspace, script, lockfile importer, and docs workflow", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-strip-"));
  try {
    await writeFile(
      join(root, "pnpm-workspace.yaml"),
      `packages:\n  - "apps/*"\n  - "packages/*"\n  - "create-zstack"\n`,
    );
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "zstack",
          packageManager: "pnpm@11.18.0",
          scripts: {
            build: "turbo run build",
            "create-zstack": "pnpm --filter @wanialabs/create-zstack start",
            "smoke:create": "bash scripts/smoke-create-zstack",
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(root, "pnpm-lock.yaml"),
      [
        "lockfileVersion: '9.0'",
        "",
        "importers:",
        "",
        "  .:",
        "    dependencies:",
        "      turbo:",
        "        specifier: ^2.10.9",
        "        version: 2.10.9",
        "",
        "  create-zstack:",
        "    dependencies:",
        "      citty:",
        "        specifier: ^0.2.2",
        "        version: 0.2.2",
        "    devDependencies:",
        "      tsx:",
        "        specifier: 4.23.11",
        "        version: 4.23.11",
        "",
        "  packages/contracts:",
        "    dependencies:",
        "      zod:",
        "        specifier: ^4.0.0",
        "        version: 4.0.0",
        "",
      ].join("\n"),
    );
    await mkdir(join(root, ".github/workflows"), { recursive: true });
    await writeFile(join(root, ".github/workflows/docs.yml"), "name: docs\n");
    await writeFile(join(root, ".github/workflows/generate-clone.yml"), "name: generate\n");
    await mkdir(join(root, "scripts"), { recursive: true });
    await writeFile(join(root, "scripts/smoke-create-zstack"), "#!/usr/bin/env bash\n");
    await mkdir(join(root, "repos/effect"), { recursive: true });
    await writeFile(join(root, "repos/effect/LLMS.md"), "# effect\n");
    await writeFile(
      join(root, "README.md"),
      [
        "# zstack",
        "",
        "- `create-zstack` / `@wanialabs/create-zstack` scaffold CLI (excluded from clones)",
        "",
        "Product PRs run `.github/workflows/ci.yml` (ignores `docs/**`). Docs changes run `.github/workflows/docs.yml` against the standalone `docs/` lockfile.",
        "",
        "```bash",
        "npm create @wanialabs/zstack@latest my-app",
        "pnpm create @wanialabs/zstack my-app",
        "cd docs && pnpm install && pnpm dev   # authoring docs :4000",
        "```",
        "",
        "```text",
        "create-zstack/             # authoring-only scaffold CLI (not in clones)",
        "docs/                      # authoring-only docs site (own lockfile/CI; not in clones)",
        "```",
        "",
        "See [AUTHORING.md](AUTHORING.md). Agents: [AGENTS.md](AGENTS.md).",
        "",
      ].join("\n"),
    );

    await stripAuthoringManifest(root);

    const workspace = await readFile(join(root, "pnpm-workspace.yaml"), "utf8");
    assert.equal(workspace.includes("create-zstack"), false);

    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.equal(packageJson.scripts?.["create-zstack"], undefined);
    assert.equal(packageJson.scripts?.["smoke:create"], undefined);
    assert.equal(packageJson.scripts?.build, "turbo run build");

    const lock = await readFile(join(root, "pnpm-lock.yaml"), "utf8");
    assert.equal(lock.includes("create-zstack:"), false);
    assert.match(lock, /packages\/contracts:/);

    await assert.rejects(readFile(join(root, ".github/workflows/docs.yml")));
    await assert.rejects(readFile(join(root, ".github/workflows/generate-clone.yml")));
    await assert.rejects(readFile(join(root, "scripts/smoke-create-zstack")));
    await assert.rejects(readFile(join(root, "repos/effect/LLMS.md")));

    const readme = await readFile(join(root, "README.md"), "utf8");
    assert.equal(readme.includes("create-zstack"), false);
    assert.equal(readme.includes("@wanialabs/zstack"), false);
    assert.equal(readme.includes("AUTHORING.md"), false);
    assert.match(readme, /See \[AGENTS\.md\]\(AGENTS\.md\)\./);
    assert.match(readme, /Product PRs run `\.github\/workflows\/ci\.yml`\./);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("stripCreateZstackLockfileImporter is a no-op when lockfile missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-strip-nolock-"));
  try {
    await stripCreateZstackLockfileImporter(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("applyPackageManagerChoice rewrites packageManager and drops pnpm lock for npm", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-pm-"));
  try {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "zstack", packageManager: "pnpm@11.18.0" }, null, 2)}\n`,
    );
    await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

    await applyPackageManagerChoice(root, "npm");

    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      packageManager?: string;
    };
    assert.equal(packageJson.packageManager, "npm@10");
    await assert.rejects(readFile(join(root, "pnpm-lock.yaml")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("runScriptCommand matches package manager", () => {
  assert.equal(runScriptCommand("pnpm", "dev:services"), "pnpm dev:services");
  assert.equal(runScriptCommand("npm", "dev:services"), "npm run dev:services");
  assert.equal(runScriptCommand("yarn", "db:seed"), "yarn db:seed");
  assert.equal(runScriptCommand("bun", "alchemy:dev"), "bun run alchemy:dev");
});
