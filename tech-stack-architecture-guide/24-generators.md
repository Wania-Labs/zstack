# Code generators

## Default

Native Turborepo generators are the in-repository scaffolding mechanism. `pnpm generate` aliases `turbo gen`. The default generator creates a complete vertical feature slice rather than a disconnected controller, component, or database file.

Giget is reserved for bootstrapping a completely new product repository from this architecture starter. It is not used to modify an existing monorepo feature-by-feature.

## Primary feature generator

```text
pnpm generate feature customers
```

The generator asks only questions that materially change the output, such as whether the slice needs persistence, customer UI, admin UI, a workflow, a queue consumer, a feature flag, analytics, or translated copy.

Depending on answers, it can create:

```text
apps/api/src/modules/customers/
  contract.ts or package-contract wiring
  service.ts
  errors.ts
  repository.ts
  procedures.ts
  tests/
apps/web/src/features/customers/
  api/
  components/
  routes/
apps/admin/src/features/customers/
  api/
  components/
  routes/
packages/contracts/src/customers/
packages/analytics/src/events/customers.ts
packages/i18n/messages/*
```

The concrete structure follows the owning application; generation must not force every feature into every layer.

## Generated conventions

The feature generator establishes:

- Zod input/output and stable API error codes;
- oRPC/Hono registration at an explicit composition root;
- an Effect service/use-case boundary and typed failures;
- Drizzle schema/migration placeholders only when persistence is selected;
- authorization and Better Auth organization-context hooks;
- Vitest/oRPC/SQL test fixtures appropriate to the selected layers;
- Sentry/evlog correlation and typed PostHog events when requested;
- feature-flag safe defaults and i18n semantic keys when requested.

Generated code must compile and pass lint/tests immediately. It may include explanatory comments, but not unresolved `TODO` placeholders that make the baseline fail.

If generated code selects a previously absent capability, the generator must update the typed manifest, Effect Layer composition, Alchemy module, local adapter, conservative limits, and capability contract tests together. It must never insert a production dummy Layer merely to satisfy types.

## Smaller generators

| Generator | Purpose |
| --- | --- |
| `workflow` | Workflow definition, versioned input, steps, tests, and Hono trigger registration |
| `queue` | Producer contract, consumer, idempotency skeleton, retry/DLQ tests |
| `migration` | Drizzle migration pair/metadata and reversibility classification fixture |
| `component` | Shared or feature-owned Base UI/shadcn composition with test/story fixture |
| `package` | Private workspace package with exports, configs, and Turbo scripts |

The `package` generator is intentionally less prominent than `feature`; backend modules stay in `apps/api` until a real second consumer exists.

## Generator implementation

Place TypeScript definitions in `turbo/generators/`. Turborepo discovers root and workspace-local generators, runs them from the correct workspace root, and supplies Plop-compatible prompts/actions without requiring a separate `plop` dependency.

Keep templates as ordinary source files reviewed with the architecture. Prefer deterministic edits and explicit registration markers/composition files. If modifying an existing TypeScript registry becomes fragile, introduce an AST-aware edit narrowly; do not make an all-purpose code-rewriting framework.

Turborepo currently documents a limitation around ESM dependencies in custom generators. Do not wrap generators in a separate `citty`/UnJS CLI until that integration is proven. The repository can still use UnJS Changelogen for releases and Giget for whole-repository templates.

## AI-assisted development

Generators and AI agents complement each other. The generator establishes correct paths, boundaries, imports, and minimum tests. An AI agent fills product behavior inside that known shape. This reduces architectural drift and makes generated diffs easier to review.

Do not generate hundreds of speculative abstractions. Templates should represent patterns the product has used successfully more than once. Update generator snapshot tests whenever conventions change.

## Testing

- Snapshot the file tree and important generated contents for each option set.
- Generate into a temporary fixture workspace, then run typecheck, Oxlint, and focused tests.
- Test name normalization, collisions, existing-file refusal, and deterministic reruns.
- Never overwrite hand-edited files without an explicit, reviewable merge behavior.
- CI checks representative generator outputs so template drift cannot silently break new features.

## What not to do

- Do not build a bespoke CLI framework before Turbo generators fail a real need.
- Do not generate server logic into a frontend app.
- Do not publish generated shared packages.
- Do not create database tables, flags, events, or translations unless the requested feature needs them.
- Do not let templates bypass the same lint, type, and test rules as handwritten code.

## Escape hatches

Giget can turn the completed architecture into a remotely versioned product starter. A future dedicated CLI can use UnJS `citty`, `giget`, `c12`, and `magicast` if organization-wide repository creation/customization becomes a product of its own. The generated architecture remains ordinary files if the generator is later removed.

## Primary references

- [Turborepo generating code](https://turborepo.dev/docs/guides/generating-code)
- [`turbo generate` reference](https://turborepo.dev/docs/reference/generate)
- [`@turbo/gen`](https://turborepo.dev/docs/reference/turbo-gen)
- [UnJS Giget](https://unjs.io/packages/giget)
- [UnJS Citty](https://unjs.io/packages/citty/)
