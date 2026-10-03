/**
 * Builds the "copy prompt" and CLI commands shown on the landing page and in docs.
 * Mirrors create-zstack's slug rules closely enough for a preview; the CLI stays
 * the source of truth and re-validates whatever the user pastes.
 */

export const agentTools = [
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex" },
  { id: "opencode", label: "OpenCode" },
] as const;

export type AgentToolId = (typeof agentTools)[number]["id"];

export const packageManagers = [
  { id: "pnpm", command: (args: string) => `pnpm create @wanialabs/zstack@latest ${args}` },
  { id: "npm", command: (args: string) => `npm create @wanialabs/zstack@latest ${args}` },
  { id: "bun", command: (args: string) => `bunx @wanialabs/create-zstack@latest ${args}` },
  { id: "yarn", command: (args: string) => `yarn create @wanialabs/zstack@latest ${args}` },
] as const;

export type PackageManagerId = (typeof packageManagers)[number]["id"];

export const DEFAULT_PROJECT_NAME = "My Product";
const FALLBACK_SLUG = "my-product";

export function slugifyProjectName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54)
    .replace(/-+$/, "");
  return /^[a-z][a-z0-9-]*$/.test(slug) ? slug : FALLBACK_SLUG;
}

function displayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PROJECT_NAME;
}

function shellQuote(value: string): string {
  return /^[A-Za-z0-9._-]+$/.test(value) ? value : `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

export type GetStartedOptions = {
  name: string;
  tool: AgentToolId;
  /** Absolute docs origin, e.g. https://zstack.example.com. Empty string during SSR. */
  origin: string;
};

export function createArgs({ name, tool }: Pick<GetStartedOptions, "name" | "tool">): string {
  const slug = slugifyProjectName(name);
  return [
    slug,
    `--name ${shellQuote(displayName(name))}`,
    "--yes",
    `--agent-tools=${tool}`,
    "--mcp=defaults",
    "--skills=symlink",
  ].join(" ");
}

export function createCommand(
  options: Pick<GetStartedOptions, "name" | "tool">,
  manager: PackageManagerId = "pnpm",
): string {
  const pm = packageManagers.find((entry) => entry.id === manager) ?? packageManagers[0];
  const args = createArgs(options);
  // npm forwards flags to the initializer only after `--`.
  return manager === "npm" ? pm.command(args.replace(/^(\S+) /, "$1 -- ")) : pm.command(args);
}

export function buildAgentPrompt({ name, tool, origin }: GetStartedOptions): string {
  const slug = slugifyProjectName(name);
  const title = displayName(name);
  const docs = origin || "https://github.com/Wania-Labs/zstack/tree/main/docs/content/docs";
  const page = (path: string) => (origin ? `${origin}/docs/${path}.md` : `${docs}/${path}.mdx`);

  return `Set up a new zstack product called "${title}" and get it running locally.

zstack is a Cloudflare-first TypeScript product starter: a Hono + Effect API Worker, TanStack Start customer and staff apps, Better Auth, Drizzle on Postgres, and Alchemy for infrastructure. Optional vendors stay off until they get credentials.

Read first
- ${origin ? `${origin}/llms.txt (docs index)` : docs}
- ${page("getting-started")}
- ${page("guides/coding-agents")}

Steps
1. Scaffold (Node >= 22.5):
   ${createCommand({ name, tool })}
2. cd ${slug} and read AGENTS.md end to end, plus the nested AGENTS.md next to any code you touch. Treat them as the rules for this repo.
3. Secrets: cp apps/api/.dev.vars.example apps/api/.dev.vars, then set BETTER_AUTH_SECRET to the output of \`openssl rand -base64 32\`. Export the same value in the shell for Alchemy.
4. Database (needs Docker): pnpm dev:services && pnpm db:migrate && pnpm db:seed
5. Run the stack: pnpm alchemy:dev (api :8787, web :3000, admin :3001). If Alchemy asks for credentials, stop and ask me to run \`alchemy login\`. Until then use the escape hatch: pnpm --filter @${slug}/api dev, then the same for web and admin.
6. Verify: open http://localhost:3000 and confirm sign-up renders, then run pnpm typecheck && pnpm lint && pnpm test.

Ground rules
- Do not sign up for vendors or invent API keys. Email, Sentry, AI Gateway, Polar, PostHog, and R2 presign stay on their local defaults.
- Never put secrets in product.config.ts.
- Read node_modules/effect/AGENTS.md before writing Effect code.

When you finish, tell me what is running and where, which checks passed, and which optional capabilities are off with the env vars that turn each one on.`;
}

/** Replaces interactive MDX widgets with plain text for markdown twins and llms-full.txt. */
export function inlineWidgetsForMarkdown(markdown: string, origin: string): string {
  const prompt = buildAgentPrompt({ name: DEFAULT_PROJECT_NAME, tool: "claude", origin });
  const block = [
    'Agent prompt (defaults: project "My Product", Claude Code; change `--agent-tools` for Cursor, Codex, or OpenCode):',
    "",
    "```text",
    prompt,
    "```",
  ].join("\n");
  return markdown
    .replace(/^<GetStarted\s*\/>$/gm, block)
    .replace(/^<CopyPromptButton\s*\/>$/gm, block);
}
