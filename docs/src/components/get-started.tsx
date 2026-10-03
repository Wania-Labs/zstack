import { Sparkles, SquareTerminal } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { CopyIconButton, CopyStateIcon, copyAnnouncement, useCopy } from "@/components/copy";
import { cn } from "@/lib/cn";
import {
  DEFAULT_PROJECT_NAME,
  agentTools,
  buildAgentPrompt,
  createCommand,
  defaultAgentPrompt,
  packageManagers,
  parseProjectName,
  setupCommands,
  type AgentToolId,
  type PackageManagerId,
  type ValidProjectName,
} from "@/lib/get-started";

const noopSubscribe = () => () => {};

/**
 * Docs origin on the client. SSR and hydration use "" (GitHub links); React then
 * re-checks the client snapshot after mount and re-renders with the real origin.
 */
function useOrigin() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * Roving focus for radiogroups and tablists: one tab stop, arrow keys and
 * Home/End move between options and select them.
 */
function useRovingSelect<T extends string>(ids: ReadonlyArray<T>, onSelect: (id: T) => void) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: T) => {
    const index = ids.indexOf(current);
    let next: number | undefined;
    if (NEXT_KEYS.has(event.key)) next = (index + 1) % ids.length;
    else if (PREV_KEYS.has(event.key)) next = (index - 1 + ids.length) % ids.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    const id = ids[next]!;
    onSelect(id);
    refs.current.get(id)?.focus();
  };
  const register = (id: T) => (node: HTMLButtonElement | null) => {
    if (node) refs.current.set(id, node);
    else refs.current.delete(id);
  };
  return { onKeyDown, register };
}

function Segmented<T extends string>({
  label,
  labelledBy,
  value,
  options,
  onChange,
}: {
  label?: string;
  labelledBy?: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const roving = useRovingSelect(
    options.map((option) => option.id),
    onChange,
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-1 rounded-lg bg-fd-muted p-1"
    >
      {options.map((option) => (
        <button
          key={option.id}
          ref={roving.register(option.id)}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === value ? 0 : -1}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => roving.onKeyDown(event, option.id)}
          className="rounded-md px-2.5 py-1.5 text-base/5 font-medium text-fd-muted-foreground hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring aria-checked:bg-fd-background aria-checked:text-fd-foreground aria-checked:shadow-sm aria-checked:ring-1 aria-checked:ring-fd-foreground/5 sm:py-1 sm:text-sm/5 dark:aria-checked:shadow-none"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProjectNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const parsed = parseProjectName(value);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <label
          htmlFor={id}
          className="shrink-0 text-base/5 font-medium text-fd-foreground sm:text-sm/5"
        >
          Project name
        </label>
        <p
          id={`${id}-hint`}
          aria-live="polite"
          className={cn(
            "min-w-0 truncate text-sm/5 sm:text-xs/5",
            parsed.ok ? "font-mono text-fd-muted-foreground" : "text-red-700 dark:text-red-400",
          )}
        >
          {parsed.ok ? `./${parsed.slug} · @${parsed.slug}/*` : parsed.error}
        </p>
      </div>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={DEFAULT_PROJECT_NAME}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={!parsed.ok}
        aria-describedby={`${id}-hint`}
        className="w-full min-w-0 rounded-md bg-fd-background px-3 py-2 text-base/6 text-fd-foreground ring-1 ring-fd-border placeholder:text-fd-muted-foreground focus:ring-2 focus:ring-fd-ring focus:outline-none aria-invalid:ring-red-600/60 sm:py-1.5 sm:text-sm/6"
      />
    </div>
  );
}

function PromptPanel({
  project,
  tool,
  origin,
}: {
  project: ValidProjectName | null;
  tool: AgentToolId;
  origin: string;
}) {
  const prompt = project ? buildAgentPrompt(project, tool, origin) : "";
  const { state, copy } = useCopy();
  const toolLabel = agentTools.find((entry) => entry.id === tool)?.label ?? "your agent";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <pre
          tabIndex={0}
          aria-label="Agent prompt preview"
          className="max-h-64 overflow-auto rounded-lg bg-fd-muted/60 p-4 font-mono text-[0.8125rem]/6 whitespace-pre-wrap text-fd-foreground/90 ring-1 ring-fd-border ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
        >
          {prompt || "Fix the project name to generate a prompt."}
        </pre>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-px bottom-px h-12 rounded-b-lg bg-linear-to-t from-fd-card to-transparent"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          disabled={!project}
          onClick={() => void copy(prompt)}
          className="inline-flex items-center gap-2 rounded-md bg-fd-primary py-2.5 pr-4 pl-3 text-base/6 font-medium text-fd-primary-foreground hover:bg-fd-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring disabled:cursor-not-allowed disabled:opacity-50 sm:py-2 sm:text-sm/6"
        >
          <CopyStateIcon state={state} />
          {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy prompt"}
        </button>
        <p className="text-base/6 text-pretty text-fd-muted-foreground sm:text-sm/6">
          {state === "failed"
            ? "Select the prompt above and copy it manually."
            : `Paste it into ${toolLabel} from an empty folder.`}
        </p>
        <span className="sr-only" aria-live="polite">
          {copyAnnouncement(state, "Prompt")}
        </span>
      </div>
    </div>
  );
}

function CommandBlock({ command, label }: { command: string; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-fd-muted/60 py-2 pr-2 pl-4 ring-1 ring-fd-border ring-inset">
      <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-[0.8125rem]/6 text-fd-foreground">
        {command}
      </pre>
      <CopyIconButton text={command} label={label} />
    </div>
  );
}

function TerminalPanel({ project, tool }: { project: ValidProjectName | null; tool: AgentToolId }) {
  const [manager, setManager] = useState<PackageManagerId>("pnpm");
  if (!project) {
    return (
      <p className="text-base/6 text-fd-muted-foreground sm:text-sm/6">
        Fix the project name to generate commands.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Package manager"
        value={manager}
        options={packageManagers.map((entry) => ({ id: entry.id, label: entry.id }))}
        onChange={setManager}
      />
      <CommandBlock command={createCommand(project, tool, manager)} label="Copy create command" />
      <div className="flex flex-col gap-2">
        <p className="text-base/6 text-fd-muted-foreground sm:text-sm/6">
          Then set a local auth secret and start the stack on Compose Postgres (needs Docker and
          pnpm):
        </p>
        <CommandBlock command={setupCommands(project).join("\n")} label="Copy setup commands" />
      </div>
    </div>
  );
}

const tabs = [
  { id: "prompt", label: "Agent prompt", icon: Sparkles },
  { id: "terminal", label: "Terminal", icon: SquareTerminal },
] as const;

type Mode = (typeof tabs)[number]["id"];

/**
 * Landing-page and MDX "get started" widget: a personalized prompt for coding
 * agents, plus the equivalent terminal commands for people who'd rather type.
 */
export function GetStarted({ className }: { className?: string }) {
  const origin = useOrigin();
  const [mode, setMode] = useState<Mode>("prompt");
  const [name, setName] = useState(DEFAULT_PROJECT_NAME);
  const [tool, setTool] = useState<AgentToolId>("claude");
  const id = useId();
  const parsed = parseProjectName(name);
  const project = parsed.ok ? parsed : null;
  const roving = useRovingSelect(
    tabs.map((tab) => tab.id),
    setMode,
  );

  return (
    <div
      className={cn(
        "not-prose overflow-hidden rounded-xl bg-fd-card shadow-lg ring-1 shadow-fd-foreground/5 ring-fd-foreground/10 dark:shadow-none dark:ring-fd-border",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="Get started"
        className="flex gap-1 border-b border-fd-foreground/10 px-2 dark:border-fd-border"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={roving.register(tab.id)}
            id={`${id}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            aria-controls={`${id}-${tab.id}-panel`}
            tabIndex={mode === tab.id ? 0 : -1}
            onClick={() => setMode(tab.id)}
            onKeyDown={(event) => roving.onKeyDown(event, tab.id)}
            className="-mb-px inline-flex items-center gap-2 border-b-2 border-transparent py-3 pr-3 pl-2 text-base/6 font-medium text-fd-muted-foreground hover:text-fd-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fd-ring aria-selected:border-fd-primary aria-selected:text-fd-foreground sm:text-sm/6"
          >
            <tab.icon aria-hidden="true" className="size-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <ProjectNameField value={name} onChange={setName} />
          <div className="flex flex-col gap-1.5">
            <p
              id={`${id}-agent`}
              className="text-base/5 font-medium text-fd-foreground sm:text-sm/5"
            >
              Coding agent
            </p>
            <Segmented
              labelledBy={`${id}-agent`}
              value={tool}
              options={agentTools}
              onChange={setTool}
            />
          </div>
        </div>

        <div
          id={`${id}-prompt-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-prompt-tab`}
          hidden={mode !== "prompt"}
        >
          <PromptPanel project={project} tool={tool} origin={origin} />
        </div>
        <div
          id={`${id}-terminal-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-terminal-tab`}
          hidden={mode !== "terminal"}
        >
          <TerminalPanel project={project} tool={tool} />
        </div>
      </div>
    </div>
  );
}

/** Compact copy control for MDX pages and secondary CTAs. Uses the default project. */
export function CopyPromptButton({ className }: { className?: string }) {
  const origin = useOrigin();
  const { state, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => void copy(defaultAgentPrompt(origin))}
      className={cn(
        "inline-flex items-center gap-2 rounded-md bg-fd-background py-2.5 pr-4 pl-3 text-base/6 font-medium text-fd-foreground ring-1 ring-fd-border hover:bg-fd-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring sm:py-2 sm:text-sm/6",
        className,
      )}
    >
      <CopyStateIcon state={state} className={state === "copied" ? "text-fd-primary" : undefined} />
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy agent prompt"}
      <span className="sr-only" aria-live="polite">
        {copyAnnouncement(state, "Prompt")}
      </span>
    </button>
  );
}
