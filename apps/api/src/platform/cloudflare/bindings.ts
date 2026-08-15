import type { JobMessage } from "../queue/job-queue";
import type { ExampleWorkflowParams } from "../workflow/durable-workflow";

export type ApiBindings = {
  HYPERDRIVE: Hyperdrive;
  /** Worker R2 binding. Absent (wrangler without r2) → FakeObjectStoreLive. */
  OBJECTS?: R2Bucket;
  /** Worker Queue producer. Absent → FakeJobQueueLive. */
  JOBS?: Queue<JobMessage>;
  /** Cloudflare Workflow binding for the example workflow class. Absent → fake. */
  EXAMPLE_WORKFLOW?: Workflow<ExampleWorkflowParams>;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Verified sender used by Bento (`from`). Absent → console transport. */
  EMAIL_FROM?: string;
  BENTO_SITE_UUID?: string;
  BENTO_PUBLISHABLE_KEY?: string;
  BENTO_SECRET_KEY?: string;
  /** Optional. Empty → Sentry SDK + evlog Sentry drain stay off. */
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  /** 0–1; defaults to 1 when DSN is set. Lower in production. */
  SENTRY_TRACES_SAMPLE_RATE?: string;
  /** Optional. Empty → deterministic fake AI models (no spend). */
  AI_GATEWAY_API_KEY?: string;
  /** Optional. Empty → FakeBillingLive (checkout/portal unconfigured). */
  POLAR_ACCESS_TOKEN?: string;
  /** Optional. `sandbox` (default) or `production` when the token is set. */
  POLAR_SERVER?: string;
  /** Optional. Server-owned redirect after checkout success. */
  POLAR_CHECKOUT_SUCCESS_URL?: string;
  /** Optional. Polar Standard Webhooks secret. Empty → webhook route returns 503. */
  POLAR_WEBHOOK_SECRET?: string;
  /** Optional. Polar product catalog entries (`POLAR_PRODUCT_<SLUG>`). */
  POLAR_PRODUCT_PRO?: string;
  POLAR_PRODUCT_ENTERPRISE?: string;
  /** Optional. PostHog project key. Empty → no-op analytics. */
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
  /** R2 S3 API credentials for presigned URLs. Empty → Worker `/api/objects/*` paths. */
  CLOUDFLARE_ACCOUNT_ID?: string;
  OBJECTS_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  /** Optional. `FEATURE_FLAG_<KEY>` overlays the in-memory flag map. */
  FEATURE_FLAG_EXAMPLE_READY?: string;
};
