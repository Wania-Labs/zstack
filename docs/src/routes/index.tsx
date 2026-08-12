import { Link, createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="relative flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-fd-border">
          <div aria-hidden className="zstack-hero-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24 sm:py-32">
            <p className="text-sm font-medium tracking-[0.18em] text-fd-primary uppercase">
              zstack
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Cloudflare-first TypeScript product starter with portable Postgres and agent-ready
              boundaries
            </h1>
            <p className="max-w-xl text-lg text-fd-muted-foreground text-pretty">
              Opinionated monorepo you clone as the product: customer web app, staff admin console,
              and one Effect-backed Hono Worker. Vendors stay quiet until secrets bind. Local path
              is Compose plus alchemy:dev.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/docs/$"
                params={{ _splat: "" }}
                className="rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
              >
                Get started
              </Link>
              <Link
                to="/docs/$"
                params={{ _splat: "for-agents" }}
                className="rounded-md border border-fd-border bg-fd-background px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
              >
                For agents
              </Link>
              <a
                href="https://github.com/wanialabs/zstack"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-fd-border bg-fd-background px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
              >
                GitHub
              </a>
            </div>
            <div className="pt-2">
              <code className="inline-block rounded bg-fd-muted px-3 py-1.5 text-sm font-mono text-fd-foreground">
                pnpm create @wanialabs/zstack
              </code>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-b border-fd-border bg-fd-card">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Who it's for</h2>
            <div className="mt-6 flex flex-col gap-4 text-fd-muted-foreground">
              <p>
                Solo founders and small teams shipping an AI-capable SaaS who want Cloudflare
                Workers without maintaining a second Nest or Next.js API silo.
              </p>
              <p>
                You want coding agents productive on day one. zstack ships with{" "}
                <code className="text-sm">AGENTS.md</code>, playbooks, skills, and MCP defaults
                out of the box.
              </p>
              <p className="text-sm">
                <strong className="font-medium text-fd-foreground">Not for:</strong> dropping this
                framework into an existing repo, plugin marketplaces, or Vercel-only stacks.
              </p>
            </div>
          </div>
        </section>

        {/* Familiar, but a different axis */}
        <section className="border-b border-fd-border">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Familiar job, different axis
            </h2>
            <div className="mt-6 flex flex-col gap-4 text-fd-muted-foreground">
              <p>
                Same job as T3, create-t3-turbo, Makerkit, or ShipFast: opinionated product starter
                so you don't re-decide auth, billing shell, admin console, and email every time.
              </p>
              <p>
                Different axis:{" "}
                <strong className="font-medium text-fd-foreground">
                  Cloudflare-first + portable Postgres + Effect as the backend execution model +
                  agent-native authoring and docs.
                </strong>
              </p>
              <p>
                Most peers are Next.js on Vercel or thin Cloudflare demos. zstack fills the gap for
                teams who want Workers, real product boundaries, and agents that land productive day
                one.
              </p>
            </div>
          </div>
        </section>

        {/* Why the idea is good */}
        <section className="border-b border-fd-border bg-fd-card">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Why the idea is good
            </h2>
            <p className="mt-4 text-fd-muted-foreground">
              Boundaries, not a logo board. The architectural bets that make it coherent:
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              <li className="flex flex-col gap-1.5">
                <strong className="text-sm font-medium text-fd-foreground">
                  Zod at the edge, Effect inside
                </strong>
                <p className="text-sm text-fd-muted-foreground">
                  Type-safe contracts with oRPC. Effect services for domain use cases.
                </p>
              </li>
              <li className="flex flex-col gap-1.5">
                <strong className="text-sm font-medium text-fd-foreground">
                  One Hono Worker for everything
                </strong>
                <p className="text-sm text-fd-muted-foreground">
                  API, workflows, queues, cron all in one Worker app, not separate deploys.
                </p>
              </li>
              <li className="flex flex-col gap-1.5">
                <strong className="text-sm font-medium text-fd-foreground">
                  Better Auth org/admin model
                </strong>
                <p className="text-sm text-fd-muted-foreground">
                  Customer web vs staff admin console as separate TanStack Start apps.
                </p>
              </li>
              <li className="flex flex-col gap-1.5">
                <strong className="text-sm font-medium text-fd-foreground">
                  Capability ports pattern
                </strong>
                <p className="text-sm text-fd-muted-foreground">
                  EmailService, AiService, product.config. Optional vendors quiet until configured.
                </p>
              </li>
              <li className="flex flex-col gap-1.5">
                <strong className="text-sm font-medium text-fd-foreground">
                  Alchemy owns deploy
                </strong>
                <p className="text-sm text-fd-muted-foreground">
                  Provision Cloudflare and PlanetScale with one IaC tool. No parallel deploy paths.
                </p>
              </li>
              <li className="flex flex-col gap-1.5">
                <strong className="text-sm font-medium text-fd-foreground">
                  Portable Postgres
                </strong>
                <p className="text-sm text-fd-muted-foreground">
                  PlanetScale + Hyperdrive in prod. Compose locally. No cloud DB required to start.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* What's in the box */}
        <section className="border-b border-fd-border">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What's in the box
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">apps/web</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  Customer TanStack Start app with Better Auth
                </p>
              </div>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">apps/admin</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  Staff console TanStack Start app with role access
                </p>
              </div>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">apps/api</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  Hono Worker with Effect, oRPC, Drizzle, workflows, queues
                </p>
              </div>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">packages/contracts</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  Zod + oRPC contracts safe to import from frontends
                </p>
              </div>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">packages/email</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  React Email templates with console/Bento transport
                </p>
              </div>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">Alchemy IaC</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  Cloudflare Workers, PlanetScale Postgres, Hyperdrive, secrets
                </p>
              </div>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">AI capability registry</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  AiService + gateway + oRPC with fake/live model swap
                </p>
              </div>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <h3 className="font-medium text-fd-foreground">create-zstack CLI</h3>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  Scaffold with agent tools, MCP configs, skills
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/docs/$"
                params={{ _splat: "concepts/stack-map" }}
                className="text-sm text-fd-primary hover:underline"
              >
                Stack map →
              </Link>
              <Link
                to="/docs/$"
                params={{ _splat: "concepts/capabilities" }}
                className="text-sm text-fd-primary hover:underline"
              >
                Capabilities →
              </Link>
            </div>
          </div>
        </section>

        {/* Honesty / risks */}
        <section className="border-b border-fd-border bg-fd-card">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Honest risks</h2>
            <div className="mt-6 flex flex-col gap-4 text-fd-muted-foreground">
              <p>
                zstack bets on a young surface: Effect v4 (beta), Drizzle 1 (RC), Alchemy (beta),
                and TanStack Start. Hono, oRPC, and Better Auth are stable.
              </p>
              <p>
                Fine if you're willing to ride that. The main bounce risk for a public starter isn't
                the stable pieces — it's beta density.
              </p>
              <p>
                These boundaries are intentional and replaceable. You can swap adapters without
                rewriting domain code. That's the whole ports idea. But understand what you're
                signing up for before cloning.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-b border-fd-border">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to start building?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-fd-muted-foreground">
              Clone the monorepo, run locally on Compose, and deploy to Cloudflare when you're
              ready.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <code className="inline-block rounded bg-fd-muted px-4 py-2 text-sm font-mono text-fd-foreground">
                pnpm create @wanialabs/zstack
              </code>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to="/docs/$"
                  params={{ _splat: "" }}
                  className="rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                >
                  Get started
                </Link>
                <Link
                  to="/docs/$"
                  params={{ _splat: "for-agents" }}
                  className="rounded-md border border-fd-border bg-fd-background px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
                >
                  For agents
                </Link>
                <a
                  href="https://github.com/wanialabs/zstack"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-fd-border bg-fd-background px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </HomeLayout>
  );
}
