import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_PROJECT_SLUG_LENGTH,
  basenameFromTargetDir,
  buildProjectIdentity,
  formatIdentitySummary,
  parseNpmScope,
  resolveProjectIdentity,
  slugifyProjectName,
  titleCaseFromSlug,
  toPostgresIdentifier,
} from "./project-identity.js";

void test("slugifyProjectName lowercases, strips accents, and collapses separators", () => {
  assert.equal(slugifyProjectName("Acme Cloud"), "acme-cloud");
  assert.equal(slugifyProjectName("  Café App!! "), "cafe-app");
  assert.equal(slugifyProjectName("my__product"), "my-product");
});

void test("slugifyProjectName rejects empty, non-ascii-only, leading digit, and overlong slugs", () => {
  assert.throws(() => slugifyProjectName("   "), /empty/i);
  assert.throws(() => slugifyProjectName("!!!"), /ASCII letters or digits/i);
  assert.throws(() => slugifyProjectName("9acme"), /must start with a letter/i);
  const long = `a${"b".repeat(MAX_PROJECT_SLUG_LENGTH)}`;
  assert.throws(() => slugifyProjectName(long), /max is 54 \(63 − "-postgres"\)/);
});

void test("parseNpmScope accepts @scope, bare scope, and defaults from slug", () => {
  const slug = slugifyProjectName("acme-cloud");
  assert.equal(parseNpmScope(undefined, slug), "@acme-cloud");
  assert.equal(parseNpmScope("@acme", slug), "@acme");
  assert.equal(parseNpmScope("acme", slug), "@acme");
  assert.throws(() => parseNpmScope("@Acme", slug), /Invalid npm scope/);
  assert.throws(() => parseNpmScope("@", slug), /Invalid npm scope/);
});

void test("toPostgresIdentifier swaps hyphens for underscores", () => {
  assert.equal(toPostgresIdentifier(slugifyProjectName("acme-cloud")), "acme_cloud");
});

void test("titleCaseFromSlug and basenameFromTargetDir", () => {
  assert.equal(titleCaseFromSlug("acme-cloud"), "Acme Cloud");
  assert.equal(basenameFromTargetDir("/tmp/acme-cloud/"), "acme-cloud");
  assert.equal(basenameFromTargetDir("my-product"), "my-product");
});

void test("buildProjectIdentity derives deploy, local, and telemetry together", () => {
  const slug = slugifyProjectName("Acme Cloud");
  const identity = buildProjectIdentity({
    displayName: "Acme Cloud",
    slug,
    scope: parseNpmScope("@acme", slug),
  });

  assert.equal(identity.displayName, "Acme Cloud");
  assert.equal(identity.npm.root, "acme-cloud");
  assert.equal(identity.npm.scope, "@acme");
  assert.equal(identity.deploy.alchemyStack, "acme-cloud");
  assert.equal(identity.deploy.workers.api, "acme-cloud-api");
  assert.equal(identity.local.postgresContainer, "acme-cloud-postgres");
  assert.equal(identity.local.postgresVolume, "acme_cloud_pg_data");
  assert.equal(identity.local.postgresUser, "acme_cloud");
  assert.equal(
    identity.local.postgresUrl,
    "postgresql://acme_cloud:acme_cloud@127.0.0.1:5432/acme_cloud",
  );
  assert.equal(identity.telemetry.web, "acme-cloud-web");
});

void test("resolveProjectIdentity automatic uses basename when name omitted", async () => {
  const identity = await resolveProjectIdentity({
    mode: "automatic",
    targetDir: "/tmp/my-product",
  });
  assert.equal(identity.displayName, "My Product");
  assert.equal(identity.slug, "my-product");
  assert.equal(identity.npm.scope, "@my-product");
});

void test("resolveProjectIdentity automatic prefers --name and --scope", async () => {
  const identity = await resolveProjectIdentity({
    mode: "automatic",
    targetDir: "/tmp/console",
    name: "Acme Cloud",
    scope: "acme",
  });
  assert.equal(identity.displayName, "Acme Cloud");
  assert.equal(identity.slug, "acme-cloud");
  assert.equal(identity.npm.scope, "@acme");
  assert.equal(identity.npm.root, "acme-cloud");
});

void test("resolveProjectIdentity interactive prompts when name omitted", async () => {
  const identity = await resolveProjectIdentity({
    mode: "interactive",
    targetDir: "/tmp/console",
    promptProjectName: async (defaultName) => {
      assert.equal(defaultName, "Console");
      return "Acme Cloud";
    },
  });
  assert.equal(identity.slug, "acme-cloud");
});

void test("formatIdentitySummary includes brand, packages, workers, stack, postgres", () => {
  const slug = slugifyProjectName("Acme Cloud");
  const summary = formatIdentitySummary(
    buildProjectIdentity({
      displayName: "Acme Cloud",
      slug,
      scope: parseNpmScope("@acme", slug),
    }),
  );
  assert.match(summary, /brand:\s+Acme Cloud/);
  assert.match(summary, /@acme\/\*/);
  assert.match(summary, /acme-cloud-api/);
  assert.match(summary, /acme_cloud/);
});
