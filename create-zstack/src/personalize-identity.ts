import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import type { ProjectIdentity } from "./project-identity.js";

declare const pathBrand: unique symbol;
type RelativeProjectPath = string & { readonly [pathBrand]: "RelativeProjectPath" };

function asPath(path: string): RelativeProjectPath {
  return path.replaceAll("\\", "/") as RelativeProjectPath;
}

type ExpectedOccurrences = "exactly-one" | "one-or-more";

type ExactReplacement = Readonly<{
  source: string;
  target: string;
  occurrences: ExpectedOccurrences;
}>;

type NonEmpty<Kind> = readonly [Kind, ...Kind[]];

type JsonOperation =
  | Readonly<{
      kind: "set-string";
      pointer: string;
      expected: string;
      value: string;
    }>
  | Readonly<{
      kind: "rewrite-workspace-deps";
      fromScope: "@zstack";
      toScope: string;
    }>;

type FileRewrite =
  | Readonly<{
      kind: "json";
      operations: NonEmpty<JsonOperation>;
    }>
  | Readonly<{
      kind: "text";
      replacements: NonEmpty<ExactReplacement>;
    }>
  | Readonly<{
      kind: "delete";
      reason: "authoring-only";
    }>;

type RewritePlan = Map<RelativeProjectPath, FileRewrite>;

export type FrameworkReferenceAllowance = Readonly<{
  path: RelativeProjectPath;
  exactText:
    | "create-zstack"
    | "@wanialabs/create-zstack"
    | "@wanialabs/zstack"
    | "ZSTACK_TEMPLATE"
    | "https://github.com/Wania-Labs/zstack";
}>;

export type ResidualHit = Readonly<{
  path: string;
  text: string;
  line: number;
}>;

export type PersonalizeReport = Readonly<{
  rewrittenPaths: readonly string[];
  deletedPaths: readonly string[];
  residuals: readonly ResidualHit[];
}>;

const SOURCE_SCOPE = "@zstack";
const SOURCE_SLUG = "zstack";

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  ".turbo",
  ".alchemy",
  "coverage",
  ".wrangler",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".gz",
  ".wasm",
]);

export const FRAMEWORK_REFERENCE_ALLOWLIST: readonly FrameworkReferenceAllowance[] = [
  {
    path: asPath("AGENTS.md"),
    exactText: "create-zstack",
  },
];

export type PersonalizeCloneOptions = Readonly<{
  root: string;
  identity: ProjectIdentity;
}>;

export async function personalizeClone(
  options: PersonalizeCloneOptions,
): Promise<PersonalizeReport> {
  const root = options.root;
  const identity = options.identity;
  const plan = await buildRewritePlan(root, identity);
  const staged = await stageRewritePlan(root, plan);
  const residuals = await auditFullTree(root, staged);
  if (residuals.length > 0) {
    const sample = residuals
      .slice(0, 12)
      .map((hit) => `  ${hit.path}:${hit.line}: ${hit.text}`)
      .join("\n");
    throw new Error(
      `Unapproved source identity remains after personalization (${residuals.length} hit(s)):\n${sample}`,
    );
  }
  await commitStagedRewrite(root, staged);
  const rewrittenPaths: string[] = [];
  const deletedPaths: string[] = [];
  for (const [path, value] of staged) {
    if (value === "delete") {
      deletedPaths.push(path);
    } else {
      rewrittenPaths.push(path);
    }
  }
  return { rewrittenPaths, deletedPaths, residuals };
}

export async function assertNoUnapprovedSourceIdentity(root: string): Promise<void> {
  const residuals = await auditFullTree(root, new Map());
  if (residuals.length > 0) {
    const sample = residuals
      .slice(0, 12)
      .map((hit) => `  ${hit.path}:${hit.line}: ${hit.text}`)
      .join("\n");
    throw new Error(`Unapproved source identity in ${root} (${residuals.length}):\n${sample}`);
  }
}

export async function assertConsumerIdentity(
  root: string,
  expected: ProjectIdentity,
): Promise<void> {
  const rootPkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    name?: string;
  };
  if (rootPkg.name !== expected.npm.root) {
    throw new Error(`Expected root package name ${expected.npm.root}, got ${rootPkg.name}`);
  }

  const apiPkg = JSON.parse(await readFile(join(root, "apps/api/package.json"), "utf8")) as {
    name?: string;
  };
  if (apiPkg.name !== `${expected.npm.scope}/api`) {
    throw new Error(`Expected api package ${expected.npm.scope}/api, got ${apiPkg.name}`);
  }

  const compose = await readFile(join(root, "compose.yaml"), "utf8");
  if (!compose.includes(`container_name: ${expected.local.postgresContainer}`)) {
    throw new Error("compose.yaml missing personalized postgres container name");
  }
  if (!compose.includes(`POSTGRES_USER: ${expected.local.postgresUser}`)) {
    throw new Error("compose.yaml missing personalized postgres user");
  }

  const alchemy = await readFile(join(root, "alchemy.run.ts"), "utf8");
  if (!alchemy.includes(`"${expected.deploy.alchemyStack}"`)) {
    throw new Error("alchemy.run.ts missing personalized stack name");
  }

  const wrangler = await readFile(join(root, "apps/api/wrangler.jsonc"), "utf8");
  if (!wrangler.includes(`"name": "${expected.deploy.workers.api}"`)) {
    throw new Error("api wrangler missing personalized worker name");
  }
  if (!wrangler.includes(expected.local.postgresUrl)) {
    throw new Error("api wrangler localConnectionString does not match identity postgres URL");
  }

  const database = await readFile(join(root, "infra/database.ts"), "utf8");
  if (!database.includes(`database: "${expected.local.postgresDatabase}"`)) {
    throw new Error("infra/database.ts composeDevOrigin database mismatch");
  }

  const product = await readFile(join(root, "product.config.ts"), "utf8");
  if (!product.includes(`name: "${expected.displayName}"`)) {
    throw new Error("product.config.ts display name mismatch");
  }

  try {
    await stat(join(root, ".github/workflows/publish-create-zstack.yml"));
    throw new Error("publish-create-zstack.yml should be deleted from consumer clones");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await assertNoUnapprovedSourceIdentity(root);
}

async function buildRewritePlan(root: string, identity: ProjectIdentity): Promise<RewritePlan> {
  const plan: RewritePlan = new Map();
  const scope = identity.npm.scope;
  const slug = identity.slug;
  const display = identity.displayName;
  const local = identity.local;
  const workers = identity.deploy.workers;

  const workspaceManifests = await discoverWorkspacePackageJsons(root);
  for (const rel of workspaceManifests) {
    const raw = await readFile(join(root, rel), "utf8");
    const pkg = JSON.parse(raw) as { name?: string };
    if (typeof pkg.name !== "string" || !pkg.name.startsWith(`${SOURCE_SCOPE}/`)) {
      throw new Error(
        `Rewrite precondition failed for ${rel}: expected package name starting with ${SOURCE_SCOPE}/, found ${pkg.name ?? "<missing>"}`,
      );
    }
    const role = pkg.name.slice(SOURCE_SCOPE.length + 1);
    plan.set(asPath(rel), {
      kind: "json",
      operations: [
        {
          kind: "set-string",
          pointer: "/name",
          expected: pkg.name,
          value: `${scope}/${role}`,
        },
        {
          kind: "rewrite-workspace-deps",
          fromScope: SOURCE_SCOPE,
          toScope: scope,
        },
      ],
    });
  }

  plan.set(asPath("package.json"), {
    kind: "json",
    operations: [
      {
        kind: "set-string",
        pointer: "/name",
        expected: SOURCE_SLUG,
        value: identity.npm.root,
      },
      {
        kind: "rewrite-workspace-deps",
        fromScope: SOURCE_SCOPE,
        toScope: scope,
      },
    ],
  });

  const namespaceFiles = await listTextFilesContaining(root, `${SOURCE_SCOPE}/`);
  for (const rel of namespaceFiles) {
    if (rel.endsWith("package.json") || rel === "pnpm-lock.yaml") {
      continue;
    }
    mergeTextPlan(plan, asPath(rel), {
      source: `${SOURCE_SCOPE}/`,
      target: `${scope}/`,
      occurrences: "one-or-more",
    });
  }

  await mergeTextPlanIfPresent(root, plan, asPath("pnpm-lock.yaml"), {
    source: `${SOURCE_SCOPE}/`,
    target: `${scope}/`,
    occurrences: "one-or-more",
  });

  const postgresUrl = local.postgresUrl;
  const pgIdent = local.postgresUser;
  const sourceUrl = "postgresql://zstack:zstack@127.0.0.1:5432/zstack";

  for (const rel of [".env.development", ".env.example"] as const) {
    await mergeTextPlanIfPresent(root, plan, asPath(rel), {
      source: sourceUrl,
      target: postgresUrl,
      occurrences: "exactly-one",
    });
  }

  await mergeTextPlanIfPresent(root, plan, asPath("apps/api/wrangler.jsonc"), {
    source: `"name": "zstack-api"`,
    target: `"name": "${workers.api}"`,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("apps/api/wrangler.jsonc"), {
    source: sourceUrl,
    target: postgresUrl,
    occurrences: "exactly-one",
  });

  await mergeTextPlanIfPresent(root, plan, asPath("apps/web/wrangler.jsonc"), {
    source: `"name": "zstack-web"`,
    target: `"name": "${workers.web}"`,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("apps/admin/wrangler.jsonc"), {
    source: `"name": "zstack-admin"`,
    target: `"name": "${workers.admin}"`,
    occurrences: "exactly-one",
  });

  await mergeTextPlanIfPresent(root, plan, asPath("compose.yaml"), {
    source: "zstack-postgres",
    target: local.postgresContainer,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("compose.yaml"), {
    source: "zstack_pg_data",
    target: local.postgresVolume,
    occurrences: "one-or-more",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("compose.yaml"), {
    source: "POSTGRES_USER: zstack",
    target: `POSTGRES_USER: ${pgIdent}`,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("compose.yaml"), {
    source: "POSTGRES_PASSWORD: zstack",
    target: `POSTGRES_PASSWORD: ${local.postgresPassword}`,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("compose.yaml"), {
    source: "POSTGRES_DB: zstack",
    target: `POSTGRES_DB: ${local.postgresDatabase}`,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("compose.yaml"), {
    source: "pg_isready -U zstack -d zstack",
    target: `pg_isready -U ${pgIdent} -d ${local.postgresDatabase}`,
    occurrences: "exactly-one",
  });

  await mergeTextPlanIfPresent(root, plan, asPath("infra/database.ts"), {
    source: `database: "zstack"`,
    target: `database: "${local.postgresDatabase}"`,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("infra/database.ts"), {
    source: `user: "zstack"`,
    target: `user: "${local.postgresUser}"`,
    occurrences: "exactly-one",
  });
  await mergeTextPlanIfPresent(root, plan, asPath("infra/database.ts"), {
    source: `Redacted.make("zstack")`,
    target: `Redacted.make("${local.postgresPassword}")`,
    occurrences: "exactly-one",
  });

  await mergeTextPlanIfPresent(root, plan, asPath("alchemy.run.ts"), {
    source: `  "zstack",`,
    target: `  "${identity.deploy.alchemyStack}",`,
    occurrences: "exactly-one",
  });

  await mergeTextPlanIfPresent(root, plan, asPath("product.config.ts"), {
    source: `name: "zstack"`,
    target: `name: "${display}"`,
    occurrences: "exactly-one",
  });

  await mergeTextPlanIfPresent(root, plan, asPath("apps/api/scripts/orpc-call-health.ts"), {
    source: sourceUrl,
    target: postgresUrl,
    occurrences: "exactly-one",
  });

  const brandExact: ReadonlyArray<{
    path: string;
    source: string;
    target: string;
    occurrences: ExpectedOccurrences;
  }> = [
    { path: "README.md", source: "# zstack", target: `# ${display}`, occurrences: "exactly-one" },
    {
      path: "AGENTS.md",
      source: "Deep tutorials live on the zstack docs site",
      target: `Deep tutorials live on the ${display} docs site`,
      occurrences: "exactly-one",
    },
    {
      path: ".agent/skills/effect-ts/SKILL.md",
      source: "# Effect in zstack",
      target: `# Effect in ${display}`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/web/src/routes/__root.tsx",
      source: `{ title: "zstack" }`,
      target: `{ title: "${display}" }`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/web/src/routes/index.tsx",
      source: "zstack",
      target: display,
      occurrences: "one-or-more",
    },
    {
      path: "apps/web/src/components/AppShell.tsx",
      source: "zstack",
      target: display,
      occurrences: "exactly-one",
    },
    {
      path: "apps/web/src/components/AuthPageShell.tsx",
      source: "zstack",
      target: display,
      occurrences: "exactly-one",
    },
    {
      path: "apps/admin/src/routes/__root.tsx",
      source: `{ title: "zstack admin" }`,
      target: `{ title: "${display} admin" }`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/admin/src/routes/login.tsx",
      source: "zstack admin",
      target: `${display} admin`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/admin/src/components/AppShell.tsx",
      source: "zstack admin",
      target: `${display} admin`,
      occurrences: "one-or-more",
    },
    {
      path: "packages/email/src/templates/layout.tsx",
      source: "zstack",
      target: display,
      occurrences: "one-or-more",
    },
    {
      path: "packages/email/src/templates/invitation.tsx",
      source: "on zstack",
      target: `on ${display}`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/api/src/platform/email/email-service.ts",
      source: "on zstack",
      target: `on ${display}`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/api/src/platform/email/email-service.ts",
      source: `"User-Agent": "zstack/0.0.0"`,
      target: `"User-Agent": "${slug}/0.0.0"`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/api/src/http/app.ts",
      source: `service: "zstack-api"`,
      target: `service: "${identity.telemetry.api}"`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/api/src/platform/ai/fake-model.ts",
      source: `provider: "zstack-fake"`,
      target: `provider: "${slug}-fake"`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/web/src/lib/sentry.ts",
      source: `"zstack-web" | "zstack-admin"`,
      target: `"${workers.web}" | "${workers.admin}"`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/admin/src/lib/sentry.ts",
      source: `"zstack-web" | "zstack-admin"`,
      target: `"${workers.web}" | "${workers.admin}"`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/web/src/router.tsx",
      source: `"zstack-web"`,
      target: `"${workers.web}"`,
      occurrences: "exactly-one",
    },
    {
      path: "apps/admin/src/router.tsx",
      source: `"zstack-admin"`,
      target: `"${workers.admin}"`,
      occurrences: "exactly-one",
    },
  ];

  for (const entry of brandExact) {
    await mergeTextPlanIfPresent(root, plan, asPath(entry.path), {
      source: entry.source,
      target: entry.target,
      occurrences: entry.occurrences,
    });
  }

  plan.set(asPath(".github/workflows/publish-create-zstack.yml"), {
    kind: "delete",
    reason: "authoring-only",
  });

  return plan;
}

async function mergeTextPlanIfPresent(
  root: string,
  plan: RewritePlan,
  path: RelativeProjectPath,
  replacement: ExactReplacement,
): Promise<void> {
  try {
    await stat(join(root, path));
  } catch {
    return;
  }
  mergeTextPlan(plan, path, replacement);
}

function mergeTextPlan(
  plan: RewritePlan,
  path: RelativeProjectPath,
  replacement: ExactReplacement,
): void {
  const existing = plan.get(path);
  if (!existing) {
    plan.set(path, { kind: "text", replacements: [replacement] });
    return;
  }
  if (existing.kind !== "text") {
    throw new Error(`Cannot merge text replacement into ${existing.kind} plan for ${path}`);
  }
  plan.set(path, {
    kind: "text",
    replacements: [...existing.replacements, replacement],
  });
}

async function discoverWorkspacePackageJsons(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const top of ["apps", "packages"] as const) {
    let entries: string[];
    try {
      entries = await readdir(join(root, top));
    } catch {
      continue;
    }
    for (const name of entries) {
      const rel = `${top}/${name}/package.json`;
      try {
        await stat(join(root, rel));
        out.push(rel);
      } catch {}
    }
  }
  out.sort();
  return out;
}

async function listTextFilesContaining(root: string, needle: string): Promise<string[]> {
  const files = await listProjectFiles(root);
  const hits: string[] = [];
  for (const rel of files) {
    if (isProbablyBinary(rel)) {
      continue;
    }
    try {
      const text = await readFile(join(root, rel), "utf8");
      if (text.includes(needle)) {
        hits.push(rel);
      }
    } catch {}
  }
  return hits;
}

async function listProjectFiles(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(abs: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        await walk(child);
        continue;
      }
      if (entry.isFile()) {
        out.push(relative(root, child).split(sep).join("/"));
      }
    }
  }

  await walk(root);
  return out;
}

function isProbablyBinary(rel: string): boolean {
  const dot = rel.lastIndexOf(".");
  if (dot < 0) {
    return false;
  }
  return BINARY_EXTENSIONS.has(rel.slice(dot).toLowerCase());
}

type StagedFile = Uint8Array | "delete";
type StagedCloneRewrite = Map<RelativeProjectPath, StagedFile>;

async function stageRewritePlan(root: string, plan: RewritePlan): Promise<StagedCloneRewrite> {
  const staged: StagedCloneRewrite = new Map();

  for (const [rel, rewrite] of plan) {
    if (rewrite.kind === "delete") {
      try {
        await stat(join(root, rel));
        staged.set(rel, "delete");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw error;
      }
      continue;
    }

    const abs = join(root, rel);
    const original = await readFile(abs);
    let nextBytes: Uint8Array;

    if (rewrite.kind === "json") {
      const text = new TextDecoder().decode(original);
      nextBytes = new TextEncoder().encode(applyJsonOperations(rel, text, rewrite.operations));
    } else {
      const text = new TextDecoder().decode(original);
      const ordered = orderReplacements(rewrite.replacements);
      nextBytes = new TextEncoder().encode(applyTextReplacements(rel, text, ordered));
    }

    staged.set(rel, nextBytes);
  }

  return staged;
}

function orderReplacements(replacements: readonly ExactReplacement[]): ExactReplacement[] {
  return [...replacements].sort((a, b) => {
    const aNs = a.source.includes("@zstack") ? 0 : 1;
    const bNs = b.source.includes("@zstack") ? 0 : 1;
    if (aNs !== bNs) {
      return aNs - bNs;
    }
    return b.source.length - a.source.length;
  });
}

function applyTextReplacements(
  path: string,
  text: string,
  replacements: readonly ExactReplacement[],
): string {
  let next = text;
  for (const replacement of replacements) {
    const count = countOccurrences(next, replacement.source);
    assertOccurrenceCount(path, replacement, count);
    next = next.split(replacement.source).join(replacement.target);
  }
  return next;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  let count = 0;
  let from = 0;
  while (from < haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) {
      break;
    }
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

function assertOccurrenceCount(path: string, replacement: ExactReplacement, count: number): void {
  if (replacement.occurrences === "exactly-one" && count !== 1) {
    throw new Error(
      `Rewrite precondition failed for ${path}: expected exactly one occurrence of ${JSON.stringify(replacement.source)}, found ${count}`,
    );
  }
  if (replacement.occurrences === "one-or-more" && count < 1) {
    throw new Error(
      `Rewrite precondition failed for ${path}: expected one or more occurrences of ${JSON.stringify(replacement.source)}, found ${count}`,
    );
  }
}

function applyJsonOperations(
  path: string,
  text: string,
  operations: NonEmpty<JsonOperation>,
): string {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected object JSON in ${path}`);
  }
  const obj = value as Record<string, unknown>;

  for (const op of operations) {
    if (op.kind === "set-string") {
      if (op.pointer !== "/name") {
        throw new Error(`Unsupported JSON pointer ${op.pointer} in ${path}`);
      }
      if (obj.name !== op.expected) {
        throw new Error(
          `Rewrite precondition failed for ${path} /name: expected ${JSON.stringify(op.expected)}, found ${JSON.stringify(obj.name)}`,
        );
      }
      obj.name = op.value;
      continue;
    }

    if (op.kind === "rewrite-workspace-deps") {
      rewriteDepMaps(obj, op.fromScope, op.toScope);
      if (obj.scripts && typeof obj.scripts === "object" && obj.scripts !== null) {
        const scripts = obj.scripts as Record<string, unknown>;
        for (const [key, script] of Object.entries(scripts)) {
          if (typeof script === "string" && script.includes(`${op.fromScope}/`)) {
            scripts[key] = script.split(`${op.fromScope}/`).join(`${op.toScope}/`);
          }
        }
      }
      continue;
    }

    const _exhaustive: never = op;
    return _exhaustive;
  }

  return `${JSON.stringify(obj, null, 2)}\n`;
}

function rewriteDepMaps(obj: Record<string, unknown>, fromScope: string, toScope: string): void {
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const) {
    const map = obj[field];
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      continue;
    }
    const deps = map as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith(`${fromScope}/`)) {
        next[`${toScope}/${name.slice(fromScope.length + 1)}`] = version;
      } else {
        next[name] = version;
      }
    }
    obj[field] = next;
  }
}

async function readEffectiveText(
  root: string,
  rel: string,
  staged: StagedCloneRewrite,
): Promise<string | null> {
  const key = asPath(rel);
  const stagedValue = staged.get(key);
  if (stagedValue === "delete") {
    return null;
  }
  if (stagedValue) {
    return new TextDecoder().decode(stagedValue);
  }
  if (isProbablyBinary(rel)) {
    return null;
  }
  try {
    return await readFile(join(root, rel), "utf8");
  } catch {
    return null;
  }
}

async function auditFullTree(root: string, staged: StagedCloneRewrite): Promise<ResidualHit[]> {
  const files = await listProjectFiles(root);
  const stagedOnly = [...staged.keys()].filter((path) => !files.includes(path));
  const all = [...new Set([...files, ...stagedOnly])];
  const hits: ResidualHit[] = [];

  for (const rel of all) {
    const text = await readEffectiveText(root, rel, staged);
    if (text === null) {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      for (const match of findSourceIdentityTokens(line)) {
        if (isAllowlisted(rel, line, match)) {
          continue;
        }
        hits.push({ path: rel, text: match.text, line: i + 1 });
      }
    }
  }

  return hits;
}

type SourceTokenHit = Readonly<{ text: string; start: number; end: number }>;

function findSourceIdentityTokens(line: string): SourceTokenHit[] {
  const found: SourceTokenHit[] = [];
  if (line.includes("@zstack")) {
    const start = line.indexOf("@zstack");
    found.push({ text: "@zstack", start, end: start + "@zstack".length });
  }

  const re = /zstack/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start === 0 ? "" : line[start - 1];
    const after = end >= line.length ? "" : line[end];
    const boundaryBefore = !before || /[^A-Za-z0-9_-]/.test(before);
    const boundaryAfter = !after || /[^A-Za-z0-9_-]/.test(after);
    if (boundaryBefore && boundaryAfter) {
      found.push({ text: match[0], start, end });
    }
  }
  return found;
}

function isAllowlisted(path: string, line: string, hit: SourceTokenHit): boolean {
  const normalized = path.replaceAll("\\", "/");
  for (const entry of FRAMEWORK_REFERENCE_ALLOWLIST) {
    if (entry.path !== normalized) {
      continue;
    }
    let from = 0;
    while (from < line.length) {
      const idx = line.indexOf(entry.exactText, from);
      if (idx < 0) {
        break;
      }
      const spanEnd = idx + entry.exactText.length;
      if (hit.start >= idx && hit.end <= spanEnd) {
        return true;
      }
      from = idx + 1;
    }
  }
  return false;
}

async function commitStagedRewrite(root: string, staged: StagedCloneRewrite): Promise<void> {
  const tempPaths: string[] = [];
  try {
    for (const [rel, value] of staged) {
      if (value === "delete") {
        continue;
      }
      const abs = join(root, rel);
      const temp = `${abs}.__personalize_tmp`;
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(temp, value);
      tempPaths.push(temp);
    }

    for (const [rel, value] of staged) {
      const abs = join(root, rel);
      if (value === "delete") {
        await rm(abs, { force: true });
        continue;
      }
      const temp = `${abs}.__personalize_tmp`;
      await rename(temp, abs);
    }
  } catch (error) {
    for (const temp of tempPaths) {
      await rm(temp, { force: true });
    }
    throw error;
  }
}
