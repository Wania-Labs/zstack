export type ProductEvent =
  | { name: "account_signed_up"; properties: { source: "web" } }
  | {
      name: "page_viewed";
      properties: { path: string };
    }
  | {
      name: "checkout_completed";
      properties: { organizationId: string; productSlug?: string };
    }
  | {
      name: "subscription_changed";
      properties: { organizationId: string; status: string };
    }
  | {
      name: "ai_generation_completed";
      properties: { capability: string; route: "fake" | "gateway" };
    };

export type AnalyticsIdentity = {
  distinctId: string;
  organizationId?: string;
  anonymousId?: string;
};

export type AnalyticsContext = {
  distinctId: string;
  organizationId?: string;
  isStaff?: boolean;
  environment?: string;
};

export type AnalyticsClient = {
  capture(event: ProductEvent, context: AnalyticsContext): Promise<void>;
  identify(identity: AnalyticsIdentity): Promise<void>;
};

export function createNoopAnalytics(): AnalyticsClient {
  return {
    capture: async () => undefined,
    identify: async () => undefined,
  };
}

export type PostHogCaptureConfig = {
  apiKey: string;
  host: string;
};

function posthogUrl(host: string, path: string): string {
  return `${host.replace(/\/$/, "")}${path}`;
}

/**
 * PostHog Capture API. No SDK, no feature flags, no session replay.
 * Clones bind POSTHOG_API_KEY / VITE_PUBLIC_POSTHOG_KEY; empty keys no-op.
 */
export function createPostHogAnalytics(config: PostHogCaptureConfig): AnalyticsClient {
  const captureUrl = posthogUrl(config.host, "/capture/");

  return {
    capture: async (event, context) => {
      if (context.isStaff) {
        return;
      }
      const eventName = event.name === "page_viewed" ? "$pageview" : event.name;
      await fetch(captureUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.apiKey,
          event: eventName,
          distinct_id: context.distinctId,
          properties: {
            ...event.properties,
            ...(event.name === "page_viewed" ? { $pathname: event.properties.path } : {}),
            $groups: context.organizationId ? { organization: context.organizationId } : undefined,
            environment: context.environment ?? "development",
          },
        }),
      });
    },
    identify: async (identity) => {
      await fetch(captureUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.apiKey,
          event: "$identify",
          distinct_id: identity.distinctId,
          properties: {
            ...(identity.anonymousId ? { $anon_distinct_id: identity.anonymousId } : {}),
            ...(identity.organizationId
              ? {
                  $set: { organization_id: identity.organizationId },
                  $groups: { organization: identity.organizationId },
                }
              : {}),
          },
        }),
      });
    },
  };
}

export function analyticsClientFromEnv(env: {
  POSTHOG_API_KEY?: string | undefined;
  POSTHOG_HOST?: string | undefined;
  VITE_PUBLIC_POSTHOG_KEY?: string | undefined;
  VITE_PUBLIC_POSTHOG_HOST?: string | undefined;
}): AnalyticsClient {
  const apiKey = env.POSTHOG_API_KEY?.trim() || env.VITE_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) {
    return createNoopAnalytics();
  }
  const host =
    env.POSTHOG_HOST?.trim() || env.VITE_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
  return createPostHogAnalytics({ apiKey, host });
}
