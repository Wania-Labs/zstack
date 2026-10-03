declare const identityBrand: unique symbol;

type Brand<Value, Name extends string> = Value & {
  readonly [identityBrand]: Name;
};

export type ProductDisplayName = Brand<string, "ProductDisplayName">;
export type ProjectSlug = Brand<string, "ProjectSlug">;
export type NpmScope = Brand<`@${string}`, "NpmScope">;
export type NpmPackageName = Brand<string, "NpmPackageName">;
export type ResourceName = Brand<string, "ResourceName">;
export type PostgresIdentifier = Brand<string, "PostgresIdentifier">;
export type LocalPostgresPassword = Brand<string, "LocalPostgresPassword">;
export type PostgresConnectionUrl = Brand<string, "PostgresConnectionUrl">;

export type ServiceRole = "api" | "web" | "admin";

const LONGEST_RESOURCE_SUFFIX = "-postgres";
export const MAX_PROJECT_SLUG_LENGTH = 63 - LONGEST_RESOURCE_SUFFIX.length;

/**
 * Display names are spliced into TS/JSX string literals, JSX text, template
 * literals, Markdown, and YAML front matter. A small safe charset means no
 * per-context escaping, and the width cap keeps rewritten lines inside the
 * clone's formatter print width so `pnpm format:check` passes on a fresh clone.
 * Width is measured in terminal columns (East Asian wide characters count 2),
 * because that is how the formatter measures line length.
 */
export const MAX_DISPLAY_NAME_LENGTH = 32;
const DISPLAY_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .'&-]*$/u;

/** npm scope body cap (without `@`); keeps rewritten imports inside print width. */
export const MAX_NPM_SCOPE_LENGTH = 32;

export type ProjectIdentity = Readonly<{
  displayName: ProductDisplayName;
  slug: ProjectSlug;
  npm: Readonly<{
    root: NpmPackageName;
    scope: NpmScope;
  }>;
  deploy: Readonly<{
    alchemyStack: ResourceName;
    workers: Readonly<Record<ServiceRole, ResourceName>>;
  }>;
  local: Readonly<{
    postgresContainer: ResourceName;
    postgresVolume: ResourceName;
    postgresDatabase: PostgresIdentifier;
    postgresUser: PostgresIdentifier;
    postgresPassword: LocalPostgresPassword;
    postgresUrl: PostgresConnectionUrl;
  }>;
  telemetry: Readonly<Record<ServiceRole, ResourceName>>;
}>;

type AutomaticIdentityOptions = Readonly<{
  mode: "automatic";
  targetDir: string;
  name?: string;
  scope?: string;
}>;

type InteractiveIdentityOptions = Readonly<{
  mode: "interactive";
  targetDir: string;
  name?: string;
  scope?: string;
  promptProjectName: (defaultName: string) => Promise<string>;
}>;

export type ResolveProjectIdentityOptions = AutomaticIdentityOptions | InteractiveIdentityOptions;

function brand<Value, Name extends string>(value: Value): Brand<Value, Name> {
  return value as Brand<Value, Name>;
}

export function basenameFromTargetDir(targetDir: string): string {
  const normalized = targetDir.replace(/[/\\]+$/, "");
  const parts = normalized.split(/[/\\]/);
  const base = parts[parts.length - 1] ?? "";
  if (!base || base === "." || base === "..") {
    throw new Error("Target directory basename is empty; pass an explicit directory name.");
  }
  return base;
}

export function titleCaseFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** East Asian Wide / Fullwidth ranges (what the formatter counts as two columns). */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1b000, 0x1b2ff],
  [0x20000, 0x3fffd],
];

/** Display width in columns: wide characters count 2, everything else 1. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    width += WIDE_RANGES.some(([lo, hi]) => code >= lo && code <= hi) ? 2 : 1;
  }
  return width;
}

export function validateDisplayName(raw: string): ProductDisplayName {
  const trimmed = raw.normalize("NFC").trim();
  if (!trimmed) {
    throw new Error("Project display name is empty.");
  }
  if (!DISPLAY_NAME_RE.test(trimmed)) {
    throw new Error(
      `Invalid project name ${JSON.stringify(raw)}. Use letters, digits, spaces, and . ' & - only, starting with a letter or digit.`,
    );
  }
  const width = displayWidth(trimmed);
  if (width > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(
      `Project name ${JSON.stringify(trimmed)} is ${width} columns wide; max is ${MAX_DISPLAY_NAME_LENGTH} (wide characters count as 2).`,
    );
  }
  return brand(trimmed);
}

export function slugifyProjectName(raw: string): ProjectSlug {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Project name is empty.");
  }

  const slug = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug) {
    throw new Error(
      `Project name "${raw}" does not contain any ASCII letters or digits to form a slug.`,
    );
  }

  if (!/^[a-z]/.test(slug)) {
    throw new Error(
      `Project slug "${slug}" must start with a letter (Cloudflare Worker and npm package rules).`,
    );
  }

  if (slug.length > MAX_PROJECT_SLUG_LENGTH) {
    throw new Error(
      `Project slug "${slug}" is ${slug.length} characters; max is ${MAX_PROJECT_SLUG_LENGTH} (63 − "${LONGEST_RESOURCE_SUFFIX}").`,
    );
  }

  return brand(slug);
}

export function parseNpmScope(raw: string | undefined, slug: ProjectSlug): NpmScope {
  if (raw === undefined || raw.trim() === "") {
    return brand(`@${slug}` as `@${string}`);
  }

  const trimmed = raw.trim();
  const withAt = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  const body = withAt.slice(1);

  if (!body) {
    throw new Error(`Invalid npm scope "${raw}". Use @acme or acme.`);
  }

  if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,213}$/.test(body)) {
    throw new Error(
      `Invalid npm scope "${raw}". Scope must be @name with lowercase letters, digits, and single hyphens.`,
    );
  }

  if (body.length > MAX_NPM_SCOPE_LENGTH) {
    throw new Error(
      `npm scope "${withAt}" is ${body.length} characters after @; max is ${MAX_NPM_SCOPE_LENGTH}.`,
    );
  }

  return brand(withAt as `@${string}`);
}

export function toPostgresIdentifier(slug: ProjectSlug): PostgresIdentifier {
  const ident = slug.replace(/-/g, "_");
  if (ident.length > 63) {
    throw new Error(`Postgres identifier "${ident}" exceeds 63 characters.`);
  }
  return brand(ident);
}

export function buildProjectIdentity(input: {
  displayName: string;
  slug: ProjectSlug;
  scope: NpmScope;
}): ProjectIdentity {
  const { slug, scope } = input;
  const displayName = validateDisplayName(input.displayName);

  const pg = toPostgresIdentifier(slug);
  const password = brand<string, "LocalPostgresPassword">(pg);
  const postgresUrl = brand<string, "PostgresConnectionUrl">(
    `postgresql://${pg}:${pg}@127.0.0.1:5432/${pg}`,
  );

  const worker = (role: ServiceRole): ResourceName => brand(`${slug}-${role}`);

  return {
    displayName,
    slug,
    npm: {
      root: brand(slug),
      scope,
    },
    deploy: {
      alchemyStack: brand(slug),
      workers: {
        api: worker("api"),
        web: worker("web"),
        admin: worker("admin"),
      },
    },
    local: {
      postgresContainer: brand(`${slug}-postgres`),
      postgresVolume: brand(`${pg}_pg_data`),
      postgresDatabase: pg,
      postgresUser: pg,
      postgresPassword: password,
      postgresUrl,
    },
    telemetry: {
      api: worker("api"),
      web: worker("web"),
      admin: worker("admin"),
    },
  };
}

/** Title-cased default from the target directory basename, or the reason it has none. */
function defaultDisplayFromTargetDir(targetDir: string): { name: string } | { error: string } {
  try {
    const basename = basenameFromTargetDir(targetDir);
    return { name: titleCaseFromSlug(slugifyProjectName(basename.replace(/_/g, "-"))) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function resolveProjectIdentity(
  options: ResolveProjectIdentityOptions,
): Promise<ProjectIdentity> {
  let displayRaw: string;
  if (options.name !== undefined && options.name.trim() !== "") {
    // An explicit --name wins; the directory basename is never validated.
    displayRaw = options.name.trim();
  } else {
    const fallback = defaultDisplayFromTargetDir(options.targetDir);
    const defaultName = "name" in fallback ? fallback.name : "";
    if (options.mode === "interactive") {
      displayRaw = (await options.promptProjectName(defaultName)).trim() || defaultName;
    } else {
      displayRaw = defaultName;
    }
    if (!displayRaw && "error" in fallback) {
      throw new Error(
        `Cannot derive a project name from the target directory: ${fallback.error} Pass --name "<Product Name>".`,
      );
    }
  }

  let displayName: ProductDisplayName;
  try {
    displayName = validateDisplayName(displayRaw);
  } catch (error) {
    const fromName = options.name !== undefined && options.name.trim() !== "";
    if (fromName) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} Pass --name "<Product Name>" to choose a shorter name.`);
  }
  const slug = slugifyProjectName(displayName);
  const scope = parseNpmScope(options.scope, slug);
  return buildProjectIdentity({ displayName, slug, scope });
}

export function formatIdentitySummary(identity: ProjectIdentity): string {
  const { displayName, slug, npm, deploy, local, telemetry } = identity;
  return [
    "Project identity",
    `  brand:      ${displayName}`,
    `  packages:   ${npm.root}, ${npm.scope}/*`,
    `  workers:    ${deploy.workers.api}, ${deploy.workers.web}, ${deploy.workers.admin}`,
    `  stack:      ${deploy.alchemyStack}`,
    `  telemetry:  ${telemetry.api}, ${telemetry.web}, ${telemetry.admin}`,
    `  postgres:   ${local.postgresContainer} / ${local.postgresDatabase}`,
    `  slug:       ${slug}`,
  ].join("\n");
}

/** Interactive-prompt validator: an error message, or undefined when the name is usable. */
export function projectNameProblem(raw: string): string | undefined {
  try {
    slugifyProjectName(validateDisplayName(raw));
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
