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
  const displayName = brand<string, "ProductDisplayName">(input.displayName.trim());
  if (!displayName) {
    throw new Error("Project display name is empty.");
  }

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

export async function resolveProjectIdentity(
  options: ResolveProjectIdentityOptions,
): Promise<ProjectIdentity> {
  const basename = basenameFromTargetDir(options.targetDir);
  const defaultDisplay = titleCaseFromSlug(slugifyProjectName(basename.replace(/_/g, "-")));

  let displayRaw: string;
  if (options.name !== undefined && options.name.trim() !== "") {
    displayRaw = options.name.trim();
  } else if (options.mode === "interactive") {
    displayRaw = (await options.promptProjectName(defaultDisplay)).trim() || defaultDisplay;
  } else {
    displayRaw = defaultDisplay;
  }

  const slug = slugifyProjectName(displayRaw);
  const scope = parseNpmScope(options.scope, slug);
  return buildProjectIdentity({ displayName: displayRaw, slug, scope });
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
