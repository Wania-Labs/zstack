import { redirect } from "@tanstack/react-router";

import { authClient } from "./auth-client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
};

export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
};

export type AuthSnapshot =
  | { kind: "anonymous" }
  | {
      kind: "authenticated";
      user: SessionUser;
      activeOrganizationId: string | null;
    };

export type AppDestination =
  | { to: "/onboarding" }
  | { to: "/t/$organizationSlug"; params: { organizationSlug: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(value: unknown): SessionUser | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string") {
    return null;
  }
  if (typeof value.name !== "string") {
    return null;
  }
  if (typeof value.email !== "string") {
    return null;
  }
  if (typeof value.emailVerified !== "boolean") {
    return null;
  }
  if (value.image !== undefined && value.image !== null && typeof value.image !== "string") {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    emailVerified: value.emailVerified,
    image: typeof value.image === "string" ? value.image : null,
  };
}

function parseActiveOrganizationId(session: unknown): string | null {
  if (!isRecord(session)) {
    return null;
  }
  const value = session.activeOrganizationId;
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function parseTeam(value: unknown): TeamSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string") {
    return null;
  }
  if (typeof value.name !== "string") {
    return null;
  }
  if (typeof value.slug !== "string") {
    return null;
  }
  return { id: value.id, name: value.name, slug: value.slug };
}

export async function loadAuthSnapshot(): Promise<AuthSnapshot> {
  const result = await authClient.getSession();
  if (result.error || !result.data) {
    return { kind: "anonymous" };
  }

  const user = parseUser(result.data.user);
  if (!user) {
    return { kind: "anonymous" };
  }

  return {
    kind: "authenticated",
    user,
    activeOrganizationId: parseActiveOrganizationId(result.data.session),
  };
}

export async function listTeams(): Promise<TeamSummary[]> {
  const result = await authClient.organization.list();
  if (result.error || !Array.isArray(result.data)) {
    return [];
  }

  const teams: TeamSummary[] = [];
  for (const item of result.data) {
    const team = parseTeam(item);
    if (team) {
      teams.push(team);
    }
  }
  return teams;
}

export function resolveAppDestination(input: {
  teams: TeamSummary[];
  activeOrganizationId: string | null;
}): AppDestination {
  if (input.teams.length === 0) {
    return { to: "/onboarding" };
  }

  const active = input.activeOrganizationId
    ? input.teams.find((team) => team.id === input.activeOrganizationId)
    : undefined;
  const team = active ?? input.teams[0];
  if (!team) {
    return { to: "/onboarding" };
  }

  return {
    to: "/t/$organizationSlug",
    params: { organizationSlug: team.slug },
  };
}

export async function ensureGuest(input?: { redirectTo?: string }): Promise<void> {
  const auth = await loadAuthSnapshot();
  if (auth.kind !== "authenticated") {
    return;
  }

  const preferred = safeInternalPath(input?.redirectTo);
  if (preferred) {
    throw redirect({ href: preferred });
  }

  const teams = await listTeams();
  throw redirect(
    resolveAppDestination({
      teams,
      activeOrganizationId: auth.activeOrganizationId,
    }),
  );
}

export async function ensureSession(input?: {
  redirectTo?: string;
}): Promise<Extract<AuthSnapshot, { kind: "authenticated" }>> {
  const auth = await loadAuthSnapshot();
  if (auth.kind === "authenticated") {
    return auth;
  }

  if (input?.redirectTo) {
    throw redirect({
      to: "/login",
      search: { redirect: input.redirectTo },
    });
  }

  throw redirect({ to: "/login" });
}

export function createTeamSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stem = base.length > 0 ? base : "team";
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
  return `${stem}-${suffix}`;
}

export function safeInternalPath(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return undefined;
  }
  return value;
}
