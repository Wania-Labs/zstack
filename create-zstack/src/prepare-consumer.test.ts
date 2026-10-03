import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  AUTHORING_DIRECTORIES,
  CONSUMER_IGNORE,
  isConsumerIgnored,
  parsePackageManager,
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
    // Dotfiles under authoring dirs slip past `path.matchesGlob` (`**` skips dot names).
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs/.npmrc"), "x\n");
    await mkdir(join(root, ".cursor/skills/verify-zstack"), { recursive: true });
    await writeFile(join(root, ".cursor/skills/verify-zstack/.gitignore"), "x\n");
    await writeFile(join(root, "AUTHORING.md"), "# authoring\n");
    await mkdir(join(root, "apps/web"), { recursive: true });
    await writeFile(join(root, "apps/web/.cta.json"), "{}\n");
    await writeFile(join(root, "apps/web/package.json"), "{}\n");
    const lintConfig = {
      $schema: "./node_modules/oxlint/configuration_schema.json",
      ignorePatterns: ["docs/**", "tech-stack-architecture-guide/**", "**/dist/**", "repos/**"],
    };
    await writeFile(join(root, ".oxlintrc.json"), `${JSON.stringify(lintConfig, null, 2)}\n`);
    await writeFile(join(root, ".oxfmtrc.json"), `${JSON.stringify(lintConfig, null, 2)}\n`);
    await writeFile(
      join(root, ".github/workflows/ci.yml"),
      [
        "name: CI",
        "",
        "on:",
        "  push:",
        "    branches: [main]",
        "    paths-ignore:",
        '      - "docs/**"',
        '      - ".github/workflows/docs.yml"',
        "  pull_request:",
        "    paths-ignore:",
        '      - "docs/**"',
        '      - ".github/workflows/docs.yml"',
        "",
        "jobs: {}",
        "",
      ].join("\n"),
    );
    await writeFile(
      join(root, "product.config.ts"),
      [
        "/**",
        " * Optional vendors stay off until a clone sets secrets or flips the manifest.",
        " * See AUTHORING.md → Template wiring policy.",
        " *",
        " */",
        "",
      ].join("\n"),
    );
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
        "pnpm create @wanialabs/zstack@latest my-app",
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
    for (const dir of AUTHORING_DIRECTORIES) {
      await assert.rejects(stat(join(root, dir)), `${dir} should be removed`);
    }
    await assert.rejects(readFile(join(root, "AUTHORING.md")));
    await assert.rejects(readFile(join(root, "apps/web/.cta.json")));
    await readFile(join(root, "apps/web/package.json"));

    for (const config of [".oxlintrc.json", ".oxfmtrc.json"]) {
      const parsed = JSON.parse(await readFile(join(root, config), "utf8")) as {
        ignorePatterns: string[];
      };
      assert.deepEqual(parsed.ignorePatterns, ["**/dist/**", "repos/**"]);
    }

    const ci = await readFile(join(root, ".github/workflows/ci.yml"), "utf8");
    assert.equal(ci.includes("docs"), false);
    assert.match(ci, /push:\n {4}branches: \[main\]\n {2}pull_request:\n\njobs/);

    const product = await readFile(join(root, "product.config.ts"), "utf8");
    assert.equal(product.includes("AUTHORING"), false);
    assert.match(product, /flips the manifest\.\n \*\n/);

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

void test("isConsumerIgnored matches authoring dotfiles that path.matchesGlob misses", () => {
  for (const path of [
    "docs/.npmrc",
    "docs/.gitignore",
    "docs/.oxlintrc.json",
    "docs/.oxfmtrc.json",
    "docs/content/docs/index.mdx",
    "docs/",
    "docs",
    ".cursor/skills/verify-zstack/.gitignore",
    "create-zstack/package.json",
    "tech-stack-architecture-guide/README.md",
    "repos/effect/.github/workflows/ci.yml",
    "AUTHORING.md",
    "apps/web/.cta.json",
    "apps/admin/.cta.json",
    ".github/workflows/docs.yml",
    ".github/workflows/generate-clone.yml",
    ".github/workflows/publish-create-zstack.yml",
    "scripts/smoke-create-zstack",
  ]) {
    assert.equal(isConsumerIgnored(path), true, path);
  }
  for (const path of [
    "apps/web/package.json",
    "apps/web/src/docs/page.tsx",
    ".github/workflows/ci.yml",
    "docs-site/README.md",
    ".cursorrules",
    "scripts/vendor-effect.mjs",
    "README.md",
    ".npmrc",
  ]) {
    assert.equal(isConsumerIgnored(path), false, path);
  }
});

void test("AUTHORING_DIRECTORIES matches every directory glob in CONSUMER_IGNORE", () => {
  const dirs = CONSUMER_IGNORE.filter((pattern) => pattern.endsWith("/**")).map((pattern) =>
    pattern.slice(0, -"/**".length),
  );
  assert.deepEqual([...dirs].sort(), [...AUTHORING_DIRECTORIES].sort());
});

void test("parsePackageManager only accepts pnpm", () => {
  assert.equal(parsePackageManager(undefined), "pnpm");
  assert.equal(parsePackageManager(""), "pnpm");
  assert.equal(parsePackageManager(" PNPM "), "pnpm");
  for (const other of ["npm", "yarn", "bun", "deno"]) {
    assert.throws(() => parsePackageManager(other), /only pnpm is supported/);
  }
});
