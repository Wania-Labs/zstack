import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  FRAMEWORK_REFERENCE_ALLOWLIST,
  assertConsumerIdentity,
  assertNoUnapprovedSourceIdentity,
  personalizeClone,
} from "./personalize-identity.js";
import { buildProjectIdentity, parseNpmScope, slugifyProjectName } from "./project-identity.js";

async function writeMinimalFixture(root: string): Promise<void> {
  await mkdir(join(root, "apps/api"), { recursive: true });
  await mkdir(join(root, "packages/contracts"), { recursive: true });
  await mkdir(join(root, "infra"), { recursive: true });
  await mkdir(join(root, ".github/workflows"), { recursive: true });

  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "zstack",
        scripts: {
          "db:migrate": "pnpm --filter @zstack/api db:migrate",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(root, "apps/api/package.json"),
    `${JSON.stringify(
      {
        name: "@zstack/api",
        dependencies: { "@zstack/contracts": "workspace:*" },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(root, "packages/contracts/package.json"),
    `${JSON.stringify({ name: "@zstack/contracts" }, null, 2)}\n`,
  );
  await writeFile(
    join(root, "compose.yaml"),
    [
      "services:",
      "  postgres:",
      "    container_name: zstack-postgres",
      "    environment:",
      "      POSTGRES_USER: zstack",
      "      POSTGRES_PASSWORD: zstack",
      "      POSTGRES_DB: zstack",
      "    volumes:",
      "      - zstack_pg_data:/var/lib/postgresql",
      "    healthcheck:",
      '      test: ["CMD-SHELL", "pg_isready -U zstack -d zstack"]',
      "volumes:",
      "  zstack_pg_data:",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(root, "alchemy.run.ts"),
    'export default Alchemy.Stack(\n  "zstack",\n  {},\n  Effect.succeed(null),\n);\n',
  );
  await writeFile(
    join(root, "infra/database.ts"),
    [
      "export const composeDevOrigin = {",
      '  database: "zstack",',
      '  user: "zstack",',
      '  password: Redacted.make("zstack"),',
      "};",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(root, "apps/api/wrangler.jsonc"),
    [
      "{",
      '  "name": "zstack-api",',
      '  "hyperdrive": [',
      "    {",
      '      "localConnectionString": "postgresql://zstack:zstack@127.0.0.1:5432/zstack"',
      "    }",
      "  ]",
      "}",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(root, "product.config.ts"),
    'export const product = {\n  name: "zstack",\n} as const;\n',
  );
  await writeFile(
    join(root, "pnpm-lock.yaml"),
    [
      "importers:",
      "",
      "  apps/api:",
      "    dependencies:",
      "      '@zstack/contracts':",
      "        specifier: workspace:*",
      "        version: link:../../packages/contracts",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(root, "AGENTS.md"),
    [
      "Deep tutorials live on the zstack docs site when published.",
      "",
      "Frontends import `@zstack/contracts`.",
      "",
      "When agent packs write MCP config (`create-zstack --agent-tools=…`):",
      "",
    ].join("\n"),
  );
  await writeFile(join(root, ".github/workflows/publish-create-zstack.yml"), "name: publish\n");
  await writeFile(join(root, ".github/workflows/generate-clone.yml"), "name: generate\n");
  await mkdir(join(root, "scripts"), { recursive: true });
  await writeFile(join(root, "scripts/smoke-create-zstack"), "#!/usr/bin/env bash\n");
}

function acmeIdentity() {
  const slug = slugifyProjectName("Acme Cloud");
  return buildProjectIdentity({
    displayName: "Acme Cloud",
    slug,
    scope: parseNpmScope("@acme", slug),
  });
}

void test("FRAMEWORK_REFERENCE_ALLOWLIST is path + exactText only", () => {
  for (const entry of FRAMEWORK_REFERENCE_ALLOWLIST) {
    assert.ok(entry.path.length > 0);
    assert.ok(entry.exactText.length > 0);
    assert.equal(entry.path.includes("*"), false);
  }
});

void test("personalizeClone rewrites minimal fixture and deletes publish workflow", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-personalize-"));
  try {
    await writeMinimalFixture(root);
    const identity = acmeIdentity();
    const report = await personalizeClone({ root, identity });

    assert.ok(report.rewrittenPaths.includes("package.json"));
    assert.ok(report.deletedPaths.includes(".github/workflows/publish-create-zstack.yml"));
    assert.ok(report.deletedPaths.includes(".github/workflows/generate-clone.yml"));
    assert.ok(report.deletedPaths.includes("scripts/smoke-create-zstack"));

    const rootPkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      name: string;
      scripts: Record<string, string>;
    };
    assert.equal(rootPkg.name, "acme-cloud");
    assert.match(rootPkg.scripts["db:migrate"]!, /@acme\/api/);

    const apiPkg = JSON.parse(await readFile(join(root, "apps/api/package.json"), "utf8")) as {
      name: string;
      dependencies: Record<string, string>;
    };
    assert.equal(apiPkg.name, "@acme/api");
    assert.equal(apiPkg.dependencies["@acme/contracts"], "workspace:*");
    assert.equal(apiPkg.dependencies["@zstack/contracts"], undefined);

    const compose = await readFile(join(root, "compose.yaml"), "utf8");
    assert.match(compose, /container_name: acme-cloud-postgres/);
    assert.match(compose, /POSTGRES_USER: acme_cloud/);
    assert.match(compose, /acme_cloud_pg_data/);

    const lock = await readFile(join(root, "pnpm-lock.yaml"), "utf8");
    assert.match(lock, /@acme\/contracts/);
    assert.equal(lock.includes("@zstack/"), false);

    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    assert.match(agents, /Acme Cloud docs site/);
    assert.match(agents, /@acme\/contracts/);
    assert.match(agents, /create-zstack/);

    await assertConsumerIdentity(root, identity);
    await assert.rejects(() => personalizeClone({ root, identity }), /precondition failed/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("assertNoUnapprovedSourceIdentity fails on leftover @zstack", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-residual-"));
  try {
    await writeFile(join(root, "note.md"), "import from `@zstack/contracts`\n");
    await assert.rejects(
      () => assertNoUnapprovedSourceIdentity(root),
      /Unapproved source identity/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
