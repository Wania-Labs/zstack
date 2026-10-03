import { Link, createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { ArrowRight } from "lucide-react";
import { CodePanel } from "@/components/code-panel";
import { CopyPromptButton, GetStarted } from "@/components/get-started";
import { baseOptions } from "@/lib/layout.shared";
import { appName, gitConfig } from "@/lib/shared";

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export const Route = createFileRoute("/")({
  component: Home,
});

const stack = [
  "Cloudflare Workers",
  "Hono",
  "Effect 4",
  "oRPC",
  "Zod",
  "Drizzle",
  "Postgres",
  "Better Auth",
  "TanStack Start",
  "shadcn/ui",
  "Alchemy",
];

const capabilities: ReadonlyArray<{ name: string; local: string; on: string; href: string }> = [
  {
    name: "Email",
    local: "Logged to the console",
    on: "EMAIL_FROM + BENTO_*",
    href: "guides/turn-on-email",
  },
  {
    name: "AI",
    local: "Deterministic fake model",
    on: "AI_GATEWAY_API_KEY",
    href: "guides/turn-on-ai",
  },
  {
    name: "Billing",
    local: "Fake checkout and entitlements",
    on: "POLAR_ACCESS_TOKEN + POLAR_WEBHOOK_SECRET",
    href: "guides/turn-on-billing",
  },
  {
    name: "Analytics",
    local: "Typed events, no-op sink",
    on: "POSTHOG_API_KEY",
    href: "guides/turn-on-analytics",
  },
  {
    name: "Errors and traces",
    local: "Off",
    on: "SENTRY_DSN",
    href: "guides/turn-on-observability",
  },
  {
    name: "Object storage",
    local: "In-memory store, local R2 under alchemy:dev",
    on: "R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY",
    href: "guides/turn-on-object-storage",
  },
];

const bets = [
  {
    title: "Zod at the edge, Effect inside",
    body: "oRPC contracts validate every request. Domain code is plain Effect with typed errors and injected services.",
  },
  {
    title: "One Worker runs the backend",
    body: "HTTP, queue consumers, and workflows live in the same Hono Worker. No fleet of tiny services to deploy.",
  },
  {
    title: "Ports, not vendor SDKs",
    body: "Modules ask for EmailService or BillingService. The edge picks a Layer from env, so a swap never touches product code.",
  },
  {
    title: "Customer app and staff console",
    body: "Two TanStack Start apps share one contract package and Better Auth roles. Neither imports API source.",
  },
];

const aiSnippet = `export const completeAi = Effect.fn("completeAi")(function* (input) {
  const { organizationId } = yield* CurrentRequestContext;

  // Billing is a port: a fake locally, Polar once a token is set.
  const billing = yield* BillingService;
  if (organizationId && (yield* billing.isConfigured())) {
    const allowed = yield* billing.canUse({
      customerId: organizationId,
      capability: aiCapabilityEntitlement(input.capability),
    });
    if (!allowed) {
      return yield* Effect.fail(
        new BillingError({ message: "entitlement denied" }),
      );
    }
  }

  // AI is a port too: a deterministic fake until AI_GATEWAY_API_KEY is set.
  const ai = yield* AiService;
  return yield* ai.complete(input);
});`;

const agentTree = `AGENTS.md                 // hard rules, commands, env split
apps/api/AGENTS.md        // module and port rules for the Worker
.agent/
  playbooks/
    add-capability.md
    swap-adapter.md
    database-migrations.md
    deploy-alchemy.md
  skills/
    effect-ts/SKILL.md    // points at node_modules/effect/AGENTS.md
CLAUDE.md                 // written by --agent-tools
.mcp.json                 // docs MCPs by default`;

const agentFeatures = [
  {
    title: "Rules that ship with the code",
    body: "Root and nested AGENTS.md files tell agents where code goes and which imports are off limits.",
  },
  {
    title: "Playbooks for multi-step work",
    body: "Adding a capability, swapping an adapter, migrating the database, and deploying are written down step by step.",
  },
  {
    title: "Docs MCPs on day one",
    body: "Cloudflare docs, Context7, and the shadcn registry are wired into Claude Code, Cursor, or OpenCode at scaffold time.",
  },
  {
    title: "Docs agents can read",
    body: "Every page has a markdown twin, and llms.txt indexes the site for one-shot ingest.",
  },
];

const path = [
  {
    step: "01",
    title: "Launch lean",
    body: "Compose Postgres, local Workers, fake vendors. Ship the first version without a cloud bill.",
  },
  {
    step: "02",
    title: "Turn things on",
    body: "Add a key and the matching adapter takes over. Alchemy provisions PlanetScale, Hyperdrive, R2, and queues.",
  },
  {
    step: "03",
    title: "Move when you outgrow it",
    body: "Postgres is portable and every vendor sits behind a port. Rehome a layer without rewriting the product.",
  },
];

const maturity = [
  { name: "Effect 4", status: "Stable" },
  { name: "Drizzle 1.0", status: "Release candidate" },
  { name: "Alchemy 2", status: "Beta" },
  { name: "TanStack Start", status: "Fast moving" },
];

const textLink =
  "inline-flex items-center gap-1.5 text-base/6 font-medium text-fd-foreground hover:text-fd-primary sm:text-sm/6";

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="font-mono text-sm/6 font-medium tracking-wide text-fd-primary uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-[40ch] text-3xl font-semibold tracking-tight text-balance text-fd-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-[48ch] text-lg text-pretty text-fd-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function FeatureList({ items }: { items: ReadonlyArray<{ title: string; body: string }> }) {
  return (
    <dl className="grid gap-8 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="flex flex-col gap-1.5">
          <dt className="text-base/7 font-medium text-fd-foreground sm:text-sm/6">{item.title}</dt>
          <dd className="text-base/7 text-pretty text-fd-muted-foreground sm:text-sm/6">
            {item.body}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const sectionBorder = "border-t border-fd-foreground/5 dark:border-fd-border";
const splitGrid =
  "mx-auto grid max-w-6xl items-start gap-x-16 gap-y-12 px-6 lg:grid-cols-[minmax(0,10fr)_minmax(0,11fr)] lg:px-8";

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="isolate flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="zstack-hero-grid pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden="true"
            className="zstack-hero-glow pointer-events-none absolute inset-x-0 -top-40 h-[36rem]"
          />
          <div className={`relative ${splitGrid} pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-28`}>
            <div className="lg:pt-6">
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-fd-background/70 py-1 pr-1 pl-3 font-mono text-sm/6 font-medium tracking-wide text-fd-muted-foreground uppercase ring-1 ring-fd-foreground/10 backdrop-blur-sm hover:text-fd-foreground sm:text-xs/6"
              >
                Open source · MIT
                <span className="inline-flex items-center gap-1 rounded-full bg-fd-accent pr-1.5 pl-2 text-fd-accent-foreground">
                  GitHub
                  <ArrowRight aria-hidden="true" className="size-3 shrink-0" />
                </span>
              </a>
              <h1 className="mt-6 max-w-[16ch] text-5xl font-semibold tracking-tight text-balance text-fd-foreground sm:text-6xl">
                Launch lean. Graduate without a rewrite.
              </h1>
              <p className="mt-6 max-w-[44ch] text-lg text-pretty text-fd-muted-foreground sm:text-xl">
                {appName} is a Cloudflare-first TypeScript starter with auth, billing, a staff
                console, email, AI, and infrastructure already wired. Every vendor stays off until
                you add a key, and every layer is replaceable.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link to="/docs/$" params={{ _splat: "getting-started" }} className={textLink}>
                  Read the guide
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </Link>
                <Link
                  to="/docs/$"
                  params={{ _splat: "concepts/stack-map" }}
                  className="text-base/6 font-medium text-fd-muted-foreground hover:text-fd-foreground sm:text-sm/6"
                >
                  See the stack map
                </Link>
              </div>
            </div>
            <GetStarted />
          </div>

          <div className={`relative ${sectionBorder}`}>
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-baseline sm:gap-6 lg:px-8">
              <p className="shrink-0 font-mono text-sm/6 font-medium tracking-wide text-fd-muted-foreground uppercase sm:text-xs/6">
                Built on
              </p>
              <ul role="list" className="flex flex-wrap gap-x-5 gap-y-1">
                {stack.map((item) => (
                  <li key={item} className="text-base/6 text-fd-foreground/80 sm:text-sm/6">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Vendors off until keyed */}
        <section className={`${sectionBorder} bg-fd-card py-24 sm:py-32`}>
          <div className={splitGrid}>
            <div className="flex flex-col gap-8">
              <SectionHeading
                eyebrow="Configured, not connected"
                title="Every vendor is off until you add a key."
                description="Clone it and the whole product runs on your laptop: Postgres in Compose, Workers in workerd, and local stand-ins for everything that costs money."
              />
              <p className="max-w-[56ch] text-base/7 text-pretty text-fd-muted-foreground">
                Auth, organizations, staff roles, and i18n are always on. Everything else is a port
                with a fake, console, or in-memory adapter, so you can build the product before you
                pick a single vendor.
              </p>
              <Link
                to="/docs/$"
                params={{ _splat: "concepts/capabilities" }}
                className={`${textLink} self-start`}
              >
                How capabilities work
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </div>
            <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap lg:mx-0">
              <div className="inline-block min-w-full px-6 py-2 align-middle lg:px-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-fd-foreground/10">
                      <th className="py-3 pr-4 text-sm/6 font-medium whitespace-nowrap text-fd-foreground">
                        Capability
                      </th>
                      <th className="px-4 py-3 text-sm/6 font-medium whitespace-nowrap text-fd-foreground">
                        Runs locally as
                      </th>
                      <th className="py-3 pl-4 text-sm/6 font-medium whitespace-nowrap text-fd-foreground">
                        Turns on with
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fd-foreground/5">
                    {capabilities.map((row) => (
                      <tr key={row.name}>
                        <td className="py-3 pr-4 align-top text-sm/6 font-medium">
                          <Link
                            to="/docs/$"
                            params={{ _splat: row.href }}
                            className="text-fd-foreground hover:text-fd-primary"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 align-top text-sm/6 text-fd-muted-foreground">
                          {row.local}
                        </td>
                        <td className="py-3 pl-4 align-top font-mono text-[0.8125rem]/6 text-fd-foreground/80">
                          {row.on.split(" + ").map((envVar) => (
                            <div key={envVar}>{envVar}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className={`${sectionBorder} py-24 sm:py-32`}>
          <div className={splitGrid}>
            <div className="flex flex-col gap-12">
              <SectionHeading
                eyebrow="Boundaries"
                title="Typed at the edge, Effect inside."
                description="A handful of architectural bets keep the starter coherent as it grows, and keep each piece swappable when it stops fitting."
              />
              <FeatureList items={bets} />
            </div>
            <CodePanel filename="apps/api/src/modules/ai/service.ts (excerpt)" code={aiSnippet} />
          </div>
        </section>

        {/* Agents */}
        <section className={`${sectionBorder} bg-fd-card py-24 sm:py-32`}>
          <div className={splitGrid}>
            <div className="flex flex-col gap-12">
              <SectionHeading
                eyebrow="Agent native"
                title="Your coding agent knows the rules before it writes a line."
                description="The repo carries its own instructions, so Claude Code, Cursor, Codex, and OpenCode start productive instead of guessing at conventions."
              />
              <FeatureList items={agentFeatures} />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <CopyPromptButton />
                <Link to="/docs/$" params={{ _splat: "guides/coding-agents" }} className={textLink}>
                  Coding agents guide
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </Link>
              </div>
            </div>
            <CodePanel filename="my-product/" code={agentTree} />
          </div>
        </section>

        {/* Path */}
        <section className={`${sectionBorder} py-24 sm:py-32`}>
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <SectionHeading
              eyebrow="The path"
              title="Start small without designing for day one thousand."
              description="The cheap path and the serious path share the same code. You only change adapters and infrastructure."
            />
            <ol role="list" className="mt-16 grid gap-x-16 gap-y-10 md:grid-cols-3">
              {path.map((item) => (
                <li
                  key={item.step}
                  className="flex flex-col gap-2 border-t border-fd-foreground/10 pt-6"
                >
                  <p className="font-mono text-sm/6 text-fd-primary tabular-nums">{item.step}</p>
                  <h3 className="text-lg font-semibold text-fd-foreground">{item.title}</h3>
                  <p className="text-base/7 text-pretty text-fd-muted-foreground sm:text-sm/6">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Honest risks */}
        <section className={`${sectionBorder} bg-fd-card py-24 sm:py-32`}>
          <div className={`${splitGrid} lg:items-end`}>
            <SectionHeading
              eyebrow="Honest risks"
              title="Some of this stack is young. We say so."
              description="Hono, oRPC, Better Auth, and Effect are stable. A few pieces are still moving, so versions are pinned and upgrades happen on purpose."
            />
            <dl className="grid grid-cols-2 gap-x-16 gap-y-8 sm:grid-cols-4 lg:grid-cols-2">
              {maturity.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col gap-1 border-t border-fd-foreground/10 pt-4"
                >
                  <dt className="text-base/7 font-medium text-fd-foreground sm:text-sm/6">
                    {item.name}
                  </dt>
                  <dd className="text-base/7 text-fd-muted-foreground sm:text-sm/6">
                    {item.status}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Closing CTA */}
        <section className={`${sectionBorder} py-24 sm:py-32`}>
          <div className="mx-auto flex max-w-6xl flex-col items-center px-6 text-center lg:px-8">
            <h2 className="max-w-[30ch] text-4xl font-semibold tracking-tight text-balance text-fd-foreground sm:text-5xl">
              Hand it to your agent.
            </h2>
            <p className="mt-6 max-w-[48ch] text-lg text-pretty text-fd-muted-foreground">
              One prompt scaffolds the repo, writes agent rules for your tool, starts Postgres, and
              brings up the API, customer app, and staff console.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <CopyPromptButton />
              <Link to="/docs/$" params={{ _splat: "" }} className={textLink}>
                Read the docs
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </div>
          </div>
        </section>

        <footer className={sectionBorder}>
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p className="text-base/6 text-fd-muted-foreground sm:text-sm/6">
              <span className="font-semibold text-fd-foreground">{appName}</span> by Wania Labs. MIT
              licensed.
            </p>
            <ul role="list" className="flex flex-wrap gap-x-6 gap-y-2">
              <li className="text-base/6 sm:text-sm/6">
                <Link
                  to="/docs/$"
                  params={{ _splat: "" }}
                  className="text-fd-muted-foreground hover:text-fd-foreground"
                >
                  Docs
                </Link>
              </li>
              <li className="text-base/6 sm:text-sm/6">
                <a href="/llms.txt" className="text-fd-muted-foreground hover:text-fd-foreground">
                  llms.txt
                </a>
              </li>
              <li className="text-base/6 sm:text-sm/6">
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fd-muted-foreground hover:text-fd-foreground"
                >
                  GitHub
                </a>
              </li>
              <li className="text-base/6 sm:text-sm/6">
                <a
                  href="https://www.npmjs.com/package/@wanialabs/create-zstack"
                  target="_blank"
                  rel="noreferrer"
                  className="text-fd-muted-foreground hover:text-fd-foreground"
                >
                  npm
                </a>
              </li>
            </ul>
          </div>
        </footer>
      </main>
    </HomeLayout>
  );
}
