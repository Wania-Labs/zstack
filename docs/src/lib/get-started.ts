/**
 * Builds the "copy prompt" and CLI commands shown on the landing page and in docs.
 * Name and slug rules mirror `create-zstack/src/project-identity.ts` so the preview never
 * shows a name the CLI would reject.
 */

export const agentTools = [
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex" },
  { id: "opencode", label: "OpenCode" },
] as const;

export type AgentToolId = (typeof agentTools)[number]["id"];

/** Tools that create-zstack writes MCP config for (Codex reads ~/.codex/config.toml). */
const MCP_TOOLS: ReadonlySet<AgentToolId> = new Set(["claude", "cursor", "opencode"]);
/** Tools that get a skills directory linked to `.agent/skills`. */
const SKILL_TOOLS: ReadonlySet<AgentToolId> = new Set(["claude", "cursor"]);

export const packageManagers = [
  { id: "pnpm", command: (args: string) => `pnpm create @wanialabs/zstack@latest ${args}` },
  { id: "npm", command: (args: string) => `npm create @wanialabs/zstack@latest ${args}` },
  { id: "bun", command: (args: string) => `bunx @wanialabs/create-zstack@latest ${args}` },
  { id: "yarn", command: (args: string) => `yarn create @wanialabs/zstack@latest ${args}` },
] as const;

export type PackageManagerId = (typeof packageManagers)[number]["id"];

export const DEFAULT_PROJECT_NAME = "My Product";
const MAX_DISPLAY_NAME_COLUMNS = 32;
const DISPLAY_NAME = /^[\p{L}\p{N}][\p{L}\p{N} .'&-]*$/u;

/** East Asian Wide / Fullwidth ranges, matching create-zstack's displayWidth. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1b000, 0x1b2ff],
  [0x20000, 0x3fffd],
];

function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    width += WIDE_RANGES.some(([lo, hi]) => code >= lo && code <= hi) ? 2 : 1;
  }
  return width;
}

export type ProjectName =
  | { ok: true; displayName: string; slug: string }
  | { ok: false; error: string };

export type ValidProjectName = Extract<ProjectName, { ok: true }>;

export function parseProjectName(raw: string): ProjectName {
  const displayName = raw.normalize("NFC").trim();
  if (!displayName) return { ok: false, error: "Enter a project name." };
  if (!DISPLAY_NAME.test(displayName)) {
    return {
      ok: false,
      error: "Use letters, digits, spaces, and . ' & - only, starting with a letter or digit.",
    };
  }
  if (displayWidth(displayName) > MAX_DISPLAY_NAME_COLUMNS) {
    return { ok: false, error: `Keep it to ${MAX_DISPLAY_NAME_COLUMNS} characters or fewer.` };
  }

  const slug = displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug) return { ok: false, error: "Include at least one ASCII letter or digit." };
  if (!/^[a-z]/.test(slug)) return { ok: false, error: "Start with a letter." };
  return { ok: true, displayName, slug };
}

/** POSIX single-quote escaping: safe in bash and zsh, including `!` history expansion. */
function shellQuote(value: string): string {
  return /^[A-Za-z0-9._-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

export function createArgs(project: ValidProjectName, tool: AgentToolId): string {
  return [
    project.slug,
    `--name ${shellQuote(project.displayName)}`,
    "--yes",
    `--agent-tools=${tool}`,
    MCP_TOOLS.has(tool) ? "--mcp=defaults" : null,
    SKILL_TOOLS.has(tool) ? "--skills=symlink" : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function createCommand(
  project: ValidProjectName,
  tool: AgentToolId,
  manager: PackageManagerId = "pnpm",
): string {
  const pm = packageManagers.find((entry) => entry.id === manager) ?? packageManagers[0];
  const args = createArgs(project, tool);
  // npm forwards flags to the initializer only after `--`.
  return manager === "npm" ? pm.command(args.replace(/^(\S+) /, "$1 -- ")) : pm.command(args);
}

/**
 * Alchemy reads BETTER_AUTH_SECRET from the root .env; wrangler reads
 * apps/api/.dev.vars. dotenv keeps the last duplicate key, so appending
 * overrides the example's placeholder.
 */
export function setupCommands(project: ValidProjectName): string[] {
  return [
    `cd ${project.slug}`,
    "cp apps/api/.dev.vars.example apps/api/.dev.vars",
    `printf 'BETTER_AUTH_SECRET=%s\\n' "$(openssl rand -base64 32)" | tee -a .env >> apps/api/.dev.vars`,
    "pnpm dev:services && pnpm db:migrate && pnpm db:seed",
    "pnpm alchemy:dev",
  ];
}

export function buildAgentPrompt(
  project: ValidProjectName,
  tool: AgentToolId,
  origin: string,
): string {
  const docs = "https://github.com/Wania-Labs/zstack/tree/main/docs/content/docs";
  const page = (path: string) => (origin ? `${origin}/docs/${path}.md` : `${docs}/${path}.mdx`);

  return `Set up a new zstack product called "${project.displayName}" and get it running locally.

zstack is a Cloudflare-first TypeScript product starter: a Hono + Effect API Worker, TanStack Start customer and staff apps, Better Auth, Drizzle on Postgres, and Alchemy for infrastructure. Optional vendors stay off until they get credentials.

Read first
- ${origin ? `${origin}/llms.txt (docs index)` : docs}
- ${page("getting-started")}
- ${page("guides/coding-agents")}

Steps
1. Scaffold (Node >= 22.5; the clone always installs with pnpm):
   ${createCommand(project, tool)}
2. cd ${project.slug} and read AGENTS.md end to end, plus the nested AGENTS.md next to any code you touch. Treat them as the rules for this repo.
3. Secrets: copy apps/api/.dev.vars.example to apps/api/.dev.vars. Generate one value with \`openssl rand -base64 32\` and set it as BETTER_AUTH_SECRET in both apps/api/.dev.vars (wrangler) and the root .env (Alchemy). Write it to files; shell exports do not persist between your commands. Both files are gitignored.
4. Database (needs Docker): pnpm dev:services && pnpm db:migrate && pnpm db:seed
5. Run the stack: pnpm alchemy:dev (api :8787, web :3000, admin :3001). If Alchemy asks for credentials, stop and ask me to run \`alchemy login\`. Until then use the escape hatch: pnpm --filter @${project.slug}/api dev, then the same for web and admin.
6. Verify: open http://localhost:3000 and confirm sign-up renders, then run pnpm typecheck && pnpm lint && pnpm test.

Ground rules
- Do not sign up for vendors or invent API keys. Email, Sentry, AI Gateway, Polar, PostHog, and R2 presign stay on their local defaults.
- Never put secrets in product.config.ts.
- Read node_modules/effect/AGENTS.md before writing Effect code.

When you finish, tell me what is running and where, which checks passed, and which optional capabilities are off with the env vars that turn each one on.`;
}

export const defaultProject = parseProjectName(DEFAULT_PROJECT_NAME) as ValidProjectName;

export function defaultAgentPrompt(origin: string): string {
  return buildAgentPrompt(defaultProject, "claude", origin);
}

/** Bare self-closing widget tags on their own line, which is how the MDX uses them. */
const WIDGET_TAG = /^<(GetStarted|CopyPromptButton)\s*\/>$/gm;

/** Replaces interactive MDX widgets with plain text for markdown twins and llms-full.txt. */
export function inlineWidgetsForMarkdown(markdown: string, origin: string): string {
  const block = [
    'Agent prompt (defaults: project "My Product", Claude Code; change `--agent-tools` for Cursor, Codex, or OpenCode):',
    "",
    "```text",
    defaultAgentPrompt(origin),
    "```",
  ].join("\n");
  return markdown.replace(WIDGET_TAG, () => block);
}
