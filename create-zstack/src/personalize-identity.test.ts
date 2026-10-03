import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  FRAMEWORK_REFERENCE_ALLOWLIST,
  assertConsumerIdentity,
  assertNoUnapprovedSourceIdentity,
  findSourceIdentityTokens,
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
        // Sorted as in the template; after the rename `@acme/*` must move ahead of `@ai-sdk/*`.
        dependencies: {
          "@ai-sdk/gateway": "^4.0.0",
          "@zstack/contracts": "workspace:*",
          ai: "^7.0.0",
        },
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
      '      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]',
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
      "  ],",
      '  "queues": {',
      '    "producers": [{ "binding": "JOBS", "queue": "zstack-jobs" }],',
      '    "consumers": [{ "queue": "zstack-jobs" }]',
      "  },",
      '  "workflows": [{ "name": "zstack-example", "binding": "EXAMPLE_WORKFLOW" }]',
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
  for (const app of ["web", "admin"]) {
    await mkdir(join(root, `apps/${app}/src/lib`), { recursive: true });
    await writeFile(
      join(root, `apps/${app}/src/lib/sentry.ts`),
      [
        "export const sentryServices = {",
        '  web: "zstack-web",',
        '  admin: "zstack-admin",',
        "} as const;",
        "",
      ].join("\n"),
    );
  }
  await writeFile(join(root, ".github/workflows/publish-create-zstack.yml"), "name: publish\n");
  await writeFile(join(root, ".github/workflows/generate-clone.yml"), "name: generate\n");
  await mkdir(join(root, "scripts"), { recursive: true });
  await writeFile(join(root, "scripts/smoke-create-zstack"), "#!/usr/bin/env bash\n");
}

function identityFor(displayName: string, scope?: string) {
  const slug = slugifyProjectName(displayName);
  return buildProjectIdentity({ displayName, slug, scope: parseNpmScope(scope, slug) });
}

function acmeIdentity() {
  return identityFor("Acme Cloud", "@acme");
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
    assert.deepEqual(Object.keys(apiPkg.dependencies), [
      "@acme/contracts",
      "@ai-sdk/gateway",
      "ai",
    ]);

    const wrangler = await readFile(join(root, "apps/api/wrangler.jsonc"), "utf8");
    assert.equal(wrangler.match(/"queue": "acme-cloud-jobs"/g)?.length, 2);
    assert.match(wrangler, /"name": "acme-cloud-example"/);

    const sentry = await readFile(join(root, "apps/web/src/lib/sentry.ts"), "utf8");
    assert.match(sentry, /web: "acme-cloud-web",\n {2}admin: "acme-cloud-admin",/);

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

void test("personalizeClone accepts a product name that contains zstack", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-named-zstack-"));
  try {
    await writeMinimalFixture(root);
    const identity = identityFor("Zstack Demo");
    assert.equal(identity.npm.scope, "@zstack-demo");
    await personalizeClone({ root, identity });

    const apiPkg = JSON.parse(await readFile(join(root, "apps/api/package.json"), "utf8")) as {
      name: string;
      dependencies: Record<string, string>;
    };
    assert.equal(apiPkg.name, "@zstack-demo/api");
    assert.equal(apiPkg.dependencies["@zstack-demo/contracts"], "workspace:*");
    const compose = await readFile(join(root, "compose.yaml"), "utf8");
    assert.match(compose, /container_name: zstack-demo-postgres/);
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    assert.match(agents, /Zstack Demo docs site/);

    await assertConsumerIdentity(root, identity);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("personalizeClone still flags real residue when the name contains zstack", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-named-residue-"));
  try {
    await writeMinimalFixture(root);
    await writeFile(join(root, "note.md"), "Uses the zstack-jobs queue.\n");
    await assert.rejects(
      () => personalizeClone({ root, identity: identityFor("Zstack Demo") }),
      /note\.md:1: zstack/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test("findSourceIdentityTokens treats - _ @ / as boundaries and masks own identity", () => {
  const texts = (line: string, own: readonly string[] = []) =>
    findSourceIdentityTokens(line, own).map((hit) => hit.text);

  assert.deepEqual(texts('"queue": "zstack-jobs"'), ["zstack"]);
  assert.deepEqual(texts("zstack_pg_data"), ["zstack"]);
  assert.deepEqual(texts("import from @zstack/contracts"), ["@zstack"]);
  assert.deepEqual(texts("run create-zstack now"), ["zstack"]);
  assert.deepEqual(texts("ZSTACK_TEMPLATE and Zstack"), ["ZSTACK", "Zstack"]);
  assert.deepEqual(texts("zstacks myzstack zstack2"), []);

  const own = ["Zstack Demo", "@zstack-demo", "zstack-demo", "zstack_demo"];
  assert.deepEqual(texts("@zstack-demo/api Zstack Demo zstack_demo", own), []);
  assert.deepEqual(texts("@zstack-demo/api but also @zstack/api", own), ["@zstack"]);
});

void test("FRAMEWORK_REFERENCE_ALLOWLIST permits create-zstack only where listed", async () => {
  const root = await mkdtemp(join(tmpdir(), "zstack-allowlist-"));
  try {
    await writeFile(join(root, "AGENTS.md"), "packs (`create-zstack --agent-tools=…`)\n");
    await assertNoUnapprovedSourceIdentity(root);
    await writeFile(join(root, "README.md"), "run create-zstack\n");
    await assert.rejects(() => assertNoUnapprovedSourceIdentity(root), /README\.md:1/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
