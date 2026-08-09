# Tech Stack Architecture Guide

This guide records the default architecture for a solo-founder-friendly, AI-capable TypeScript product stack that is willing to use young technology where boundaries remain replaceable. It is a documentation set and decision guide—not a generated starter repository or an instruction to provision services now.

The stack is Cloudflare-first but not Cloudflare-only. It keeps product data in portable Postgres, contracts in Zod/oRPC, backend behavior in one Hono application plus Effect services, and AI behind a capability registry. Managed services remove operational or business work without becoming the product's internal programming model.

## Guide map

| Page | What it answers |
| --- | --- |
| [Architecture overview](01-overview.md) | How the full system fits together and which decisions are locked |
| [Frontend](02-frontend.md) | Customer/admin React apps, TanStack Start, Tailwind v4, Base UI, shadcn, Query, and client state |
| [Backend and API](03-backend-api.md) | The single Hono backend, oRPC/OpenAPI, same-origin routing, and transport boundaries |
| [Validation and Effect](04-validation-and-effect.md) | Zod v4 at boundaries; Effect v4 in backend/domain code |
| [Data, database, and search](05-data-database-search.md) | Drizzle, PlanetScale Postgres, Hyperdrive, release-coupled migrations, and search |
| [Authentication](06-auth.md) | Better Auth ownership, sessions, staff identity, organizations, and authorization boundaries |
| [Workflows and queues](07-workflows-and-queues.md) | Hono-triggered Workflow SDK, the community Cloudflare World, and Cloudflare Queues |
| [Object storage](08-object-storage.md) | R2 upload/download paths, metadata, processing, and retention |
| [Email](09-email.md) | Bento transport, React Email templates, and durable sending |
| [AI stack](10-ai-stack.md) | AI SDK 7, AI Elements, model capabilities, gateways, agents, and RAG |
| [Observability and evals](11-observability-and-evals.md) | Sentry, AI observability, evlog, Vitest, and vitest-evals |
| [Feature flags](12-feature-flags.md) | OpenFeature-compatible evaluation, PlanetScale authoring, KV snapshots, and kill switches |
| [Billing](13-billing.md) | Polar as MoR, subscriptions, usage, credits, and product entitlements |
| [Testing](14-testing.md) | Test layers, real runtimes, matching Postgres, migrations, and production-targeted verification |
| [Infrastructure and IaC](15-infrastructure-and-iac.md) | Alchemy ownership, resource graph, config/secrets, stages, and blue/green primitives |
| [CI/CD and previews](16-ci-cd-and-previews.md) | GitHub Actions, Depot, Alchemy previews, continuous delivery, and rollback |
| [Internationalization](17-i18n.md) | Paraglide JS, localized URLs, message workflow, and AI-assisted translation |
| [Cross-cutting conventions](18-cross-cutting-conventions.md) | Boundaries, errors, idempotency, tenancy, privacy, security status, and decision rules |
| [Monorepo, toolchain, and local development](19-monorepo-toolchain-and-local-development.md) | pnpm, Turborepo, app/package layout, TypeScript 7, Oxc tooling, Docker, and local/cloud development |
| [Admin and support](20-admin-and-support.md) | Staff console, Better Auth Admin, impersonation, masking, operational actions, and audit ledger |
| [Product analytics](21-product-analytics.md) | PostHog Cloud US, typed semantic events, identity/groups, privacy, replay, and staff exclusion |
| [Release management](22-release-management.md) | SHA identity, Changelogen, complete-PR releases, blue/green, migrations, production tests, and rollback |
| [Caching](23-caching.md) | TanStack Query, Effect Cache, Cloudflare Cache/KV, consistency budgets, and invalidation |
| [Code generators](24-generators.md) | Turbo vertical-slice generators and Giget repository bootstrapping |
| [Capability activation and release readiness](25-capability-activation-and-release-readiness.md) | Typed optional capabilities, Effect/Alchemy enforcement, security defaults, limits, recovery gates, and opt-in previews |
| [Team tenancy and identity](26-team-tenancy-and-identity.md) | Mandatory Better Auth organizations, multiple memberships, isolation, invitations, stable Team identity, and verified domains |

## Reading paths

- To understand the stack quickly, read the [overview](01-overview.md), [cross-cutting conventions](18-cross-cutting-conventions.md), and the page for the layer you are changing.
- Before laying out a repository, read [monorepo/toolchain/local development](19-monorepo-toolchain-and-local-development.md), [frontend](02-frontend.md), and [backend/API](03-backend-api.md).
- Before implementing infrastructure or releases, read [workflows and queues](07-workflows-and-queues.md), [IaC](15-infrastructure-and-iac.md), [CI/CD](16-ci-cd-and-previews.md), and [release management](22-release-management.md) together.
- Before implementing an AI feature, read [AI](10-ai-stack.md), [billing](13-billing.md), [observability/evals](11-observability-and-evals.md), and [product analytics](21-product-analytics.md).
- Before building staff operations, read [admin/support](20-admin-and-support.md), [auth](06-auth.md), [billing](13-billing.md), and [workflows](07-workflows-and-queues.md).
- Before adding a cache, read [caching](23-caching.md) and the authority/consistency rules in [cross-cutting conventions](18-cross-cutting-conventions.md).
- Before enabling infrastructure or preparing a first production release, read [capability activation and release readiness](25-capability-activation-and-release-readiness.md), [IaC](15-infrastructure-and-iac.md), and [CI/CD](16-ci-cd-and-previews.md).
- Before adding organization-owned data or invitations, read [team tenancy and identity](26-team-tenancy-and-identity.md), [authentication](06-auth.md), and [data/database](05-data-database-search.md).

## Status language

- **Default** means new projects start here.
- **Boundary** means application code must not bypass the named abstraction.
- **Compatibility note** identifies a version, runtime, or integration concern that must be rechecked during upgrades.
- **Escape hatch** is an intentional migration path, not a second implementation to maintain today.
- **Deferred** means the topic was deliberately not standardized; it is not permission to ignore it when a product needs it.
- **Absent capability** means no Layer, binding, resource, or production fallback exists until a reviewed manifest change introduces it.

## Architecture posture

1. Own product semantics: domain rules, product data, entitlements, prompts, flags, contracts, analytics events, and audit records.
2. Rent undifferentiated work: global runtime, email delivery, payment/tax operations, model access, error aggregation, product-analytics storage, and CI compute.
3. Keep one authoritative owner for every kind of state.
4. Prefer portable contracts and explicit consistency over lowest-common-denominator abstractions.
5. Treat a pull request as one complete product change across applications, data, infrastructure, flags, and tests.
6. Add a service or shared package only after the current layer demonstrates a real limit or second consumer.
7. Make organizations—not individual user identities—the product tenant and ownership boundary.
8. Keep optional infrastructure absent until a feature requires it, then add its Effect Layer, Alchemy resource, local adapter, limits, and tests together.
