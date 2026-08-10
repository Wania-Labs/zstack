import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
  };
  if (packageJson.scripts && "create-zstack" in packageJson.scripts) {
    delete packageJson.scripts["create-zstack"];
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  await rm(join(root, ".github/workflows/docs.yml"), { force: true });

  const readmePath = join(root, "README.md");
  try {
    let readme = await readFile(readmePath, "utf8");
    readme = readme
      .replace(
        /^- `create-zstack` authoring CLI \(citty \+ giget \+ nypm; excluded from clones\)\n/m,
        "",
      )
      .replace(
        /Product PRs run `\.github\/workflows\/ci\.yml` \(ignores `docs\/\*\*`\)\. Docs changes run `\.github\/workflows\/docs\.yml` against the standalone `docs\/` lockfile\./,
        "Product PRs run `.github/workflows/ci.yml`.",
      )
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
