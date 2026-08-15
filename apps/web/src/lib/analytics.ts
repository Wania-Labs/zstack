import { analyticsClientFromEnv } from "@zstack/analytics";
import { StaffRole } from "@zstack/contracts";
import type { AnyRouter } from "@tanstack/react-router";

import { loadAuthSnapshot } from "./session";

const ANON_ID_KEY = "zstack.analytics.distinct_id";

export const analytics = analyticsClientFromEnv({
  VITE_PUBLIC_POSTHOG_KEY: import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
  VITE_PUBLIC_POSTHOG_HOST: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
});

function analyticsEnvironment(): string {
  return import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || "development";
}

function readAnonymousId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) {
      return existing;
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem(ANON_ID_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function isStaffRole(role: string | null | undefined): boolean {
  if (!role) {
    return false;
  }
  for (const part of role.split(",")) {
    if (StaffRole.safeParse(part.trim()).success) {
      return true;
    }
  }
  return false;
}

/**
 * Identify the signed-in user and alias the anonymous id. No-op without a key.
 * Staff sessions are excluded from customer analytics.
 */
export async function identifySignedInUser(): Promise<void> {
  const auth = await loadAuthSnapshot();
  if (auth.kind !== "authenticated" || isStaffRole(auth.user.role)) {
    return;
  }
  await analytics.identify({
    distinctId: auth.user.id,
    anonymousId: readAnonymousId(),
    ...(auth.activeOrganizationId ? { organizationId: auth.activeOrganizationId } : {}),
  });
}

export async function capturePageView(path: string): Promise<void> {
  const auth = await loadAuthSnapshot();
  if (auth.kind === "authenticated" && isStaffRole(auth.user.role)) {
    return;
  }

  const distinctId = auth.kind === "authenticated" ? auth.user.id : readAnonymousId();
  await analytics.capture(
    { name: "page_viewed", properties: { path } },
    {
      distinctId,
      ...(auth.kind === "authenticated" && auth.activeOrganizationId
        ? { organizationId: auth.activeOrganizationId }
        : {}),
      environment: analyticsEnvironment(),
    },
  );
}

/**
 * Browser PostHog wiring. Capture API only; no posthog-js and no replay.
 */
export function initBrowserAnalytics(router: AnyRouter): void {
  if (router.isServer) {
    return;
  }

  let lastPath: string | undefined;
  const track = (path: string) => {
    if (path === lastPath) {
      return;
    }
    lastPath = path;
    void capturePageView(path);
  };

  void identifySignedInUser();
  track(router.state.location.pathname);
  router.subscribe("onRendered", () => {
    track(router.state.location.pathname);
  });
}
