# Caching

## Default

Caching is opt-in and layered. There is no Redis service and no universal `packages/cache` abstraction. Each cache must state its scope, authority, consistency budget, key, TTL, invalidation behavior, organization partition, failure policy, and observability.

Postgres remains authoritative for product data. A cache miss or cache outage may increase latency; it must not change authorization, billing, credit, or destructive-operation correctness.

## Cache tiers

| Tier | Owner | Appropriate use | Important limitation |
| --- | --- | --- | --- |
| Browser server state | TanStack Query | fetched records, lists, pending mutations | user/device-local and potentially stale |
| Worker isolate | Effect `Cache` | expensive lookups, concurrent request deduplication | isolate-local, ephemeral, no global invalidation |
| HTTP edge | Cloudflare Cache API / cache rules | public or safely partitioned GET responses | data-center-local behavior and HTTP semantics |
| Global snapshot | Workers KV | low-churn configuration and compiled snapshots | eventually consistent, not transactional |
| Strong coordinator | Durable Object | narrow per-key serialization/strong decisions | not a general database or default hot path |
| Authority | PlanetScale Postgres | correctness-sensitive product state | optimize SQL/indexes before masking problems |

## TanStack Query

Set stale times by data class. Stable reference data may remain fresh for minutes; workflow progress may poll/stream; security or billing views may revalidate aggressively. Mutations update or invalidate known query keys. Hydration and optimistic UI are performance/experience techniques, never authorization mechanisms.

Do not copy query results into Zustand. Do not use one global stale time for every endpoint. Include organization and normalized identifiers in query keys and clear organization-scoped caches when identity/membership changes.

## Effect Cache

Effect v4 `Cache` provides bounded capacity, TTL, memoized lookup results/failures, refresh/invalidation, and sharing of an in-progress lookup among concurrent callers. Use it inside the server/domain layer for operations such as model-registry resolution or repeatedly loaded non-sensitive reference data.

A Worker isolate may disappear, multiply, or be replaced at any time. Effect Cache is therefore an opportunistic local optimization. Never require two requests to reach the same isolate or assume an invalidation call reaches other isolates.

Cache expected failures only with a deliberate short TTL. Do not accidentally turn a transient provider outage into a long-lived cached failure.

## HTTP edge caching

Cache only explicit GET/HEAD representations. Public assets/content and truly public read models are straightforward. Authenticated/organization data defaults to `Cache-Control: private, no-store` until a route documents safe partitioning.

A safe key may include:

```text
route + normalized query + organization + authorization scope + locale + representation version
```

Never key private responses only by URL if different users can receive different content. Responses with cookies or sensitive headers are not cached. Use `ETag`, `Cache-Control`, and `Cache-Tag` where their exact Cloudflare behavior is understood.

Cloudflare Cache API contents are not globally replicated and local `cache.delete` does not purge every data center. Prefer versioned keys and bounded TTLs; use global purge APIs only for workflows that truly need them.

## Workers KV snapshots

KV is appropriate for compiled feature-flag snapshots, model/configuration manifests, allowlists, and other write-infrequent/read-heavy data. Publish immutable versioned objects before moving an active-version pointer. Include schema version and checksum so evaluators can reject corrupt/incompatible snapshots.

KV can show a previous value for roughly a minute or longer in locations that cached it. It is not authoritative for:

- authentication/session revocation;
- permissions or organization membership;
- prepaid credits, billing enforcement, or usage reservations;
- destructive-operation locks;
- emergency kill switches requiring immediate acknowledgement.

Those paths read Postgres or use the explicitly stronger coordinator designed for that concern.

## Invalidation

Prefer these mechanisms in order:

1. Naturally bounded TTL and revalidation.
2. Immutable/versioned keys whose new version makes old entries unreachable.
3. Mutation-aware TanStack Query invalidation for the current client.
4. Cache tags/global purge for reviewed HTTP use cases.
5. Queue/outbox-driven best-effort invalidation for derived caches.

Queue invalidation is an optimization. Duplicate, delayed, or failed delivery must not create incorrect behavior. Correctness comes from the authority and consistency policy, not the hope that every cache delete arrived.

## Stampede and degraded behavior

Effect Cache deduplicates concurrent lookups within an isolate. For distributed expensive refreshes, use a short Durable Object coordination path or accept bounded duplicate recomputation after measuring cost. Add jitter to TTLs for high-cardinality keys and cap provider/database concurrency.

On cache failure, either load from the authority or return an explicit degraded response according to the route policy. Do not serve indefinitely stale security-sensitive state merely to remain available.

## Observability

Record cache tier, hit/miss, key class (not raw sensitive key), age, TTL, refresh source, load duration, result/error class, and release. Use sampled metrics to prevent cardinality explosions. A cache should have a measurable latency/load objective before becoming complex.

## Package boundary

Do not create `packages/cache` initially. TanStack Query configuration belongs to each frontend app, Effect caches belong to the API modules that own their lookup, and Cloudflare KV/Cache adapters belong in `apps/api/src/platform`. Extract a shared package only after two consumers require the same semantics—not merely the same method names.

## What not to do

- Do not add Redis as a reflex.
- Do not cache around unindexed or over-fetching SQL before fixing the query.
- Do not cache authorization, strict credits, or kill-switch decisions in eventually consistent KV.
- Do not store organization-private responses under an unpartitioned HTTP key.
- Do not use one abstraction that pretends browser, isolate, edge, KV, and Postgres caches have identical guarantees.
- Do not depend on cache deletion for correctness.

## Escape hatches

Add a managed Redis-compatible service only when measured workloads require cross-runtime atomic structures or data types not served well by Postgres/Durable Objects. A dedicated CDN invalidation service or globally replicated data store may replace a specific tier without changing domain authorities.

See [Team tenancy and identity](26-team-tenancy-and-identity.md) for organization switching/isolation rules.

## Primary references

- [Effect v4 Cache](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Cache.ts)
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Cloudflare Workers KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Caching data with Workers KV](https://developers.cloudflare.com/kv/examples/cache-data-with-workers-kv/)
- [TanStack Query caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching)
