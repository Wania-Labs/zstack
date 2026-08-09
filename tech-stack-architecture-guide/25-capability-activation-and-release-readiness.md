# Capability activation and release readiness

## Default

Start with few provisioned capabilities. A committed, typed `product.config.ts` declares which platform capabilities the product is allowed to use. Effect services express what backend programs require. Alchemy reads the same declaration when it creates bindings and resources. Environment variables provide secrets and runtime settings; they do not silently add infrastructure or change the compile-time service graph.

This preserves a low initial footprint while making an accidental dependency on an absent Queue, object store, billing provider, or other service fail during typechecking or CI rather than after deployment.

## Two configuration layers

| Layer | Examples | Responsibility |
| --- | --- | --- |
| Committed capability manifest | Queue absent, Workflow SDK selected, R2 enabled | Structural/type/IaC decisions safe to review in Git |
| Validated runtime configuration | credentials, limits, provider endpoints, enablement | Stage-specific values and secrets resolved through Effect Config/Alchemy |

Environment variables cannot provide compile-time assurance: TypeScript does not know which variables will exist in a future Worker. Structural capability selection therefore belongs in committed code. Secrets never do.

Conceptually:

```ts
export default defineProduct({
  capabilities: {
    objectStorage: cloudflareR2(),
    workflows: workflowSdk({
      world: cloudflareWorld(),
    }),

    queues: absent(),
    billing: absent(),
    email: bento({ enabledByDefault: false }),
    ai: aiSdk({ enabledByDefault: false }),
  },

  security: standardSecurity(),
  previews: disabled(),
})
```

The names are an architectural interface; actual helpers are created only when the starter/generator work begins.

## Capability states

| State | Meaning | Effect/IaC behavior |
| --- | --- | --- |
| `absent()` | The product does not use the capability | No production Layer, binding, resource, or secret contract |
| `configured()` | Adapter/resources exist, but product behavior is off by default | Layer and Alchemy resources exist; validated config/flags gate behavior |
| `enabled()` | Adapter/resources exist and behavior starts active | Full Layer/resource/config contract is required |

Use `absent()` until a real feature requires the capability. Do not provision a Queue merely because the architecture knows how to use Queues. When a document-processing feature genuinely needs buffering, the pull request changes the manifest, adds the Alchemy resource, provides the Effect Layer, and adds its contract tests as one release unit.

Runtime enablement is still useful after a capability is structurally present: it supports rollout, provider maintenance, and local no-op/fake behavior. It is not a substitute for the manifest.

## Effect requirement enforcement

Backend use cases, Hono/oRPC adapters, Workflow SDK steps, queue consumers, cron entrypoints, repositories, and provider adapters are Effect programs/services. Each program's service environment records the capabilities it needs.

```ts
const startDocumentProcessing = Effect.fn("startDocumentProcessing")(
  function* (command: ProcessDocument) {
    const documents = yield* Documents
    const queue = yield* JobQueue

    const document = yield* documents.create(command)
    yield* queue.publish(makeDocumentJob(document, command.operationId))
    return document
  },
)
```

The application-edge runner accepts only an Effect whose requirements have been completely provided by the selected production Layers. A feature that requires `JobQueue` cannot be registered in a product whose manifest says `queues: absent()`.

CI adds a policy check because types alone cannot prove the live resource graph:

```text
pnpm capabilities:check
```

It verifies:

- every registered backend module requirement is selected;
- every selected capability has a production Effect Layer;
- every resource-backed capability has an Alchemy declaration and typed binding;
- every selected capability has a deterministic local fake/emulator path;
- config schemas contain safe non-secret defaults where allowed;
- required production secret names are declared, without reading their values;
- preview support is present or explicitly unavailable;
- provider/runtime types do not escape their adapters.

## Alchemy relationship

Alchemy remains the only authority that provisions deployed infrastructure. The manifest describes product intent; the Alchemy program interprets that intent into Cloudflare/PlanetScale resources and bindings. A capability declaration that cannot be reconciled with the Alchemy plan fails CI/deployment.

Do not create an independent generic infrastructure framework. Keep provider-specific declarations in `infra/` and provider-specific runtime code in `apps/api/src/platform/*`. Application code sees product capabilities such as `ObjectStore`, `JobQueue`, `DurableWorkflow`, and `FeatureFlags`.

AWS is the documented reference escape target, not a second implementation maintained today. The boundaries should permit R2 to S3, Queues to SQS, and the Hono Worker entrypoint to Lambda without changing domain use cases. Only the current Cloudflare adapter and deterministic test adapter are required.

## Instantiated security baseline

Every product selects a required application security preset. The default supplies predictable controls that do not require a product-specific vendor decision:

- secure response headers and configurable Content Security Policy;
- same-origin CORS and an explicit trusted-origin allowlist;
- CSRF protection for cookie-authenticated mutations;
- secure, HTTP-only, same-site cookie defaults;
- request/correlation IDs, safe external errors, and secret/header/body redaction;
- content-type enforcement and bounded JSON/form request bodies;
- webhook verification hooks that reject unsigned/unrecognized deliveries;
- login, recovery, verification, and invitation throttling interfaces;
- normalized upload names/types and direct-to-object-store upload policy;
- production rejection of development secrets, permissive cookie settings, or unresolved origins.

Infrastructure-dependent WAF, bot, distributed quota, and product threat-model controls remain implementation-time decisions. Disabling a baseline protection requires a named, reviewed override; omission is not the disable mechanism.

## Conservative starter limits

Limits are typed, documented configuration with safe code defaults. Each limit states where it applies, how failure is represented, which metric is emitted, and how to change it. Products override them deliberately rather than inheriting unbounded provider maximums.

| Area | Starter default |
| --- | ---: |
| API JSON/form body | 1 MiB |
| Ordinary/default list page | 50 items |
| Maximum list page | 100 items |
| Direct file upload | 25 MiB |
| Simultaneous upload intents per user | 5 |
| Application Queue payload | 64 KiB |
| Queue batch size | 10 |
| Queue delivery attempts | 5, then DLQ |
| Workflow input | 64 KiB |
| Workflow steps | 100 |
| Workflow attempts per durable step | 5 |
| Ordinary provider timeout | 15 seconds |
| AI output | 4,096 tokens |
| AI tool iterations | 8 |
| AI request budget | US$0.25 |
| AI daily user budget | US$5 |
| AI daily organization budget | US$25 |
| PostHog replay sampling | 10% |
| PostHog input masking | 100% by default |
| Sentry error capture | 100% |
| Sentry trace sampling | 10% |
| Organization invitation lifetime | 48 hours |
| Feature snapshot maximum accepted age | 5 minutes |
| Ordinary email rate | 10 per user per minute |
| Organization email rate | 100 per hour |

Streaming AI requests receive a separate deadline from ordinary provider calls. Bulk email, large media, long AI agents, and high-volume APIs require explicit capability/limit profiles rather than simply raising a global number.

## Release-readiness profile

Development can begin before every operational policy is chosen. Production cannot. A committed release-readiness profile records the product's decisions:

```ts
releaseReadiness: {
  recovery: {
    rpo: "15 minutes",
    rto: "4 hours",
    backupRetention: "7 days",
    restoreDrillRequired: true,
  },
  dataLifecycle: {
    customerExport: "required",
    customerDeletion: "required",
    objectCleanup: "required",
  },
}
```

These are conservative starter values, not universal promises. A product may choose different documented objectives. Before the first production release, and whenever the profile changes, CI runs:

```text
pnpm release:check
```

It verifies that recovery objectives, backup/retention, restore evidence, deletion/export behavior, production origins, required provider secrets, security overrides, production limits, migration classification, and synthetic-production-test safety are resolved. It does not attempt to create a full incident/runbook platform; detailed runbooks remain deferred.

## Opt-in previews

Cloud preview environments are disabled by default. Normal pull requests still receive the full local/CI suite with matching-version ephemeral Postgres. A repository enables cloud previews explicitly:

```ts
previews: alchemyPreviews({
  database: seededDatabase({ seedProfile: "preview" }),
})
```

An enabled preview receives isolated application resources, migrations, a deterministic preview-safe seed, and sandbox/fake provider adapters. It never receives production data or production provider destinations by default.

The database source is snapshot-ready without requiring snapshot infrastructure initially:

```ts
database: sanitizedSnapshot({
  snapshot: "latest-preview-safe",
  runSeedsAfterRestore: true,
})
```

Only a reviewed sanitization/export process may produce that snapshot. Preview data remains disposable and receives expiry/cleanup ownership.

## What not to do

- Do not let the presence of an SDK dependency imply that its infrastructure exists.
- Do not use environment variables as an untyped service locator.
- Do not provide a dummy production Layer for an absent capability merely to make types compile.
- Do not provision every optional resource in every new product.
- Do not let the capability manifest contain secrets or live provider IDs.
- Do not make provider maximums the product's default limits.
- Do not make previews mandatory for repositories that receive sufficient confidence from local/CI tests.
- Do not interpret a release-readiness checklist as proof that a product is secure or recoverable; tests and restore evidence remain required.

## Escape hatches

The manifest helpers can evolve or be replaced without changing the Effect service boundaries. A larger team may introduce policy-as-code, shared staging, formal approvals, continuous restore testing, or a dedicated configuration system. Provider adapters can be added incrementally; no second cloud implementation is maintained merely to prove portability.

## Related pages

- [Validation and Effect](04-validation-and-effect.md)
- [Infrastructure and IaC](15-infrastructure-and-iac.md)
- [CI/CD and previews](16-ci-cd-and-previews.md)
- [Cross-cutting conventions](18-cross-cutting-conventions.md)
- [Team tenancy and identity](26-team-tenancy-and-identity.md)

