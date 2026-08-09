# Product analytics

## Default

PostHog Cloud in the US region is the product analytics and selective session-replay backend. It answers how customers use the product. Sentry and evlog continue to answer how the system behaves. The custom OpenFeature-compatible flag system continues to own feature rollout and kill switches; PostHog feature flags are disabled.

`packages/analytics` owns a typed, vendor-neutral event vocabulary so feature code does not import PostHog SDKs directly.

## Event model

Prefer semantic product events such as:

```text
account_signed_up
project_created
document_processing_completed
ai_generation_completed
checkout_completed
subscription_changed
```

An event schema defines its name, version, allowed properties, source, and owning feature. Shared properties include product release, environment, anonymous/authenticated identity state, organization, plan class, and locale when relevant.

Zod validates event payloads at the adapter boundary. Avoid free-form property bags. Rename or change semantics through an explicit event version; dashboards should not silently combine incompatible meanings.

## Browser and server authority

- Browser capture owns pageviews, navigation context, client interaction, and selected UX milestones.
- Hono server capture owns authoritative outcomes such as successful signup, persisted creation, completed workflow, accepted payment state, and billable AI completion.
- Do not emit the same semantic success from both browser and server unless they are deliberately different events.
- Automatic pageviews and basic navigation are enabled where useful.
- Broad element autocapture is minimized or disabled. Important behavior gets named events.

The server adapter sends events after the authoritative state transition or from a committed outbox/workflow step. Analytics failure never rolls back product behavior.

## Identity and tenancy

Before authentication, use an anonymous distinct ID. After authentication, identify/alias it to the application's opaque internal user ID. Email, display name, and provider IDs are properties—not primary identity.

For organization-based products:

- user ID is `distinct_id`;
- application organization ID is the PostHog group key;
- organization-scoped events include the organization group and safe plan/category properties;
- organization changes do not rewrite historical user identity.

Staff and support activity is excluded from customer product analytics using trusted server-derived staff context. Impersonated actions remain in the admin audit ledger and operational telemetry, not customer funnels or retention cohorts.

## Typed boundary

`packages/analytics` provides conceptual interfaces such as:

```ts
type ProductEvent =
  | { name: 'project_created'; properties: { projectId: string; source: 'web' | 'api' } }
  | { name: 'ai_generation_completed'; properties: { capability: string; durationMs: number } }

interface Analytics {
  capture(event: ProductEvent, context: AnalyticsContext): void | Promise<void>
  identify(identity: AnalyticsIdentity): void | Promise<void>
}
```

Exact implementation types may differ. The boundary must preserve typed names/properties and allow browser, Hono, test, and no-op adapters without reproducing PostHog's entire API.

## Session replay and privacy

Session replay is selective, sampled, and masked. Default masking covers text inputs and sensitive DOM regions. Add explicit suppression for authentication, billing, admin, AI prompt/output, file/document, and secret-bearing interfaces.

Never capture:

- passwords, passkeys, recovery codes, session/API tokens, or authorization headers;
- raw payment details or unrestricted Polar payloads;
- raw prompts, AI outputs, uploaded document contents, filenames, or email bodies;
- arbitrary form values or customer-entered text without a reviewed need;
- staff/admin sessions in the customer analytics project.

Retention, consent, regional routing, and deletion/export behavior are product decisions that must be configured before launch.

## Event governance

- Every semantic event has an owner and a documented question it answers.
- Pull requests adding events include schema fixtures and review sensitive fields.
- Dashboards use semantic events for activation, conversion, retention, and feature adoption.
- Deprecated events remain documented until dependent dashboards are migrated.
- High-volume events have sampling/cardinality budgets.
- Analytics IDs and event names are stable product vocabulary, not CSS selectors or component names.

## Relationship to other telemetry

| Need | Owner |
| --- | --- |
| Customer funnel, retention, adoption | PostHog |
| Session replay for approved customer UX | PostHog |
| Errors, traces, logs, AI operational telemetry | Sentry + evlog |
| Durable staff/customer support actions | Postgres audit ledger |
| Feature rollout/exposure decision | Custom OpenFeature provider |
| Billing usage and entitlement enforcement | Polar + application ledgers |

Correlation may use release, user/organization, request, trace, or operation IDs when privacy policy permits. Do not duplicate full payloads across every system.

## Local, preview, and CI behavior

Local development uses a no-op or console adapter. Tests assert typed events against an in-memory capture adapter. Preview environments use a separate PostHog project or disable outbound capture by default; they never pollute production analytics. CI schema tests catch invalid names/properties without calling PostHog.

## What not to do

- Do not call `posthog.capture` throughout components and domain code.
- Do not use product analytics as an audit log or billing ledger.
- Do not turn on broad autocapture and assume it produces a coherent data model.
- Do not send Sentry exceptions to PostHog merely to have one dashboard.
- Do not enable PostHog feature flags beside the custom flag system.
- Do not include staff/impersonation activity in customer behavior metrics.

## Escape hatches

The typed `Analytics` boundary permits another event backend or first-party warehouse later. Semantic events can be dual-delivered during a measured migration. Session replay can be disabled independently without changing the event model.

See [Team tenancy and identity](26-team-tenancy-and-identity.md) for the canonical organization/group boundary and [Capability activation and release readiness](25-capability-activation-and-release-readiness.md) for replay/retention readiness defaults.

## Primary references

- [PostHog product analytics](https://posthog.com/docs/product-analytics)
- [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js)
- [PostHog group analytics](https://posthog.com/docs/product-analytics/group-analytics)
- [PostHog session replay privacy](https://posthog.com/docs/session-replay/privacy)
- [PostHog data residency](https://posthog.com/docs/privacy/data-storage)
