import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { stripAuthoringManifest } from "./prepare-consumer.js";

void test("stripAuthoringManifest removes create-zstack workspace, script, and docs workflow", async () => {
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
          scripts: {
            build: "turbo run build",
            "create-zstack": "pnpm --filter create-zstack start",
          },
        },
        null,
        2,
      )}\n`,
    );
    await mkdir(join(root, ".github/workflows"), { recursive: true });
    await writeFile(join(root, ".github/workflows/docs.yml"), "name: docs\n");
    await writeFile(
      join(root, "README.md"),
      [
        "# zstack",
        "",
        "- `create-zstack` authoring CLI (citty + giget + nypm; excluded from clones)",
        "",
        "Product PRs run `.github/workflows/ci.yml` (ignores `docs/**`). Docs changes run `.github/workflows/docs.yml` against the standalone `docs/` lockfile.",
        "",
        "```bash",
        "pnpm create-zstack my-app",
        "cd docs && pnpm install && pnpm dev   # authoring docs :4000",
        "```",
        "",
        "```text",
        "create-zstack/             # authoring-only scaffold CLI (not in clones)",
        "docs/                      # authoring-only docs site (own lockfile/CI; not in clones)",
        "```",
        "",
        "See [AUTHORING.md](AUTHORING.md).",
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
    assert.equal(packageJson.scripts?.build, "turbo run build");

    await assert.rejects(readFile(join(root, ".github/workflows/docs.yml")));

    const readme = await readFile(join(root, "README.md"), "utf8");
    assert.equal(readme.includes("pnpm create-zstack"), false);
    assert.equal(readme.includes("AUTHORING.md"), false);
    assert.match(readme, /Product PRs run `\.github\/workflows\/ci\.yml`\./);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
