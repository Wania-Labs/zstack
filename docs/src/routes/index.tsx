import { Link, createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home,
});

const pillars = [
  {
    title: "Cloudflare-first",
    body: "Hono API Worker, Hyperdrive, and Alchemy-owned deploys — Wrangler stays local-only.",
  },
  {
    title: "Effect + Zod",
    body: "Domain work in Effect; Zod at boundaries; Drizzle 1.0 RC for SQL.",
  },
  {
    title: "Ready to wire",
    body: "Optional vendors scaffold off until a clone binds secrets. Compose Postgres for day one.",
  },
] as const;

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="relative flex flex-1 flex-col">
        <section className="relative overflow-hidden border-b border-fd-border">
          <div aria-hidden className="zstack-hero-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24 sm:py-32">
            <p className="text-sm font-medium tracking-[0.18em] text-fd-primary uppercase">
              zstack
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Product starter docs
            </h1>
            <p className="max-w-xl text-lg text-fd-muted-foreground text-pretty">
              Opinionated TypeScript stack for shipping on Cloudflare — Alchemy, Effect, TanStack
              Start, and vendors that stay quiet until you turn them on.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/docs/$"
                params={{ _splat: "" }}
                className="rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
              >
                Read the docs
              </Link>
              <a
                href="https://github.com/Wania-Labs/zstack"
                className="rounded-md border border-fd-border bg-fd-background px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
                rel="noreferrer"
                target="_blank"
              >
                GitHub
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold tracking-tight">{pillar.title}</h2>
              <p className="text-sm leading-relaxed text-fd-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </section>
      </main>
    </HomeLayout>
  );
}
