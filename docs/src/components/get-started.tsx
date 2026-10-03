import { Check, Copy, Sparkles, SquareTerminal } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { CopyIconButton, useCopy } from "@/components/copy";
import { cn } from "@/lib/cn";
import {
  DEFAULT_PROJECT_NAME,
  agentTools,
  buildAgentPrompt,
  createCommand,
  packageManagers,
  slugifyProjectName,
  type AgentToolId,
  type PackageManagerId,
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

type Mode = "prompt" | "terminal";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-lg bg-fd-muted p-1"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          onClick={() => onChange(option.id)}
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
  const slug = slugifyProjectName(value);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <label
          htmlFor={id}
          className="shrink-0 text-base/5 font-medium text-fd-foreground sm:text-sm/5"
        >
          Project name
        </label>
        <p className="min-w-0 truncate font-mono text-sm/5 text-fd-muted-foreground sm:text-xs/5">
          ./{slug} · @{slug}/*
        </p>
      </div>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={DEFAULT_PROJECT_NAME}
        spellCheck={false}
        autoComplete="off"
        className="w-full min-w-0 rounded-md bg-fd-background px-3 py-2 text-base/6 text-fd-foreground ring-1 ring-fd-border placeholder:text-fd-muted-foreground focus:ring-2 focus:ring-fd-ring focus:outline-none sm:py-1.5 sm:text-sm/6"
      />
    </div>
  );
}

function PromptPanel({ name, tool, origin }: { name: string; tool: AgentToolId; origin: string }) {
  const prompt = buildAgentPrompt({ name, tool, origin });
  const { copied, copy } = useCopy();
  const toolLabel = agentTools.find((entry) => entry.id === tool)?.label ?? "your agent";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <pre
          tabIndex={0}
          aria-label="Agent prompt preview"
          className="max-h-64 overflow-auto rounded-lg bg-fd-muted/60 p-4 font-mono text-[0.8125rem]/6 whitespace-pre-wrap text-fd-foreground/90 ring-1 ring-fd-border ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
        >
          {prompt}
        </pre>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-px bottom-px h-12 rounded-b-lg bg-linear-to-t from-fd-card to-transparent"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() => void copy(prompt)}
          className="inline-flex items-center gap-2 rounded-md bg-fd-primary py-2.5 pr-4 pl-3 text-base/6 font-medium text-fd-primary-foreground hover:bg-fd-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring sm:py-2 sm:text-sm/6"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <Copy aria-hidden="true" className="size-4 shrink-0" />
          )}
          {copied ? "Copied" : "Copy prompt"}
        </button>
        <p className="text-base/6 text-pretty text-fd-muted-foreground sm:text-sm/6">
          Paste it into {toolLabel} from an empty folder.
        </p>
        <span className="sr-only" aria-live="polite">
          {copied ? "Prompt copied to clipboard" : ""}
        </span>
      </div>
    </div>
  );
}

function CommandLine({ command }: { command: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-fd-muted/60 py-2 pr-2 pl-4 ring-1 ring-fd-border ring-inset">
      <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-[0.8125rem]/6 text-fd-foreground">
        <span aria-hidden="true" className="text-fd-muted-foreground select-none">
          ${" "}
        </span>
        {command}
      </pre>
      <CopyIconButton text={command} label="Copy command" />
    </div>
  );
}

function TerminalPanel({ name, tool }: { name: string; tool: AgentToolId }) {
  const [manager, setManager] = useState<PackageManagerId>("pnpm");
  const slug = slugifyProjectName(name);
  const next = [
    `cd ${slug}`,
    "cp apps/api/.dev.vars.example apps/api/.dev.vars",
    "pnpm dev:services && pnpm db:migrate && pnpm db:seed",
    "pnpm alchemy:dev",
  ].join("\n");

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Package manager"
        value={manager}
        options={packageManagers.map((entry) => ({ id: entry.id, label: entry.id }))}
        onChange={setManager}
      />
      <CommandLine command={createCommand({ name, tool }, manager)} />
      <div className="flex flex-col gap-2">
        <p className="text-base/6 text-fd-muted-foreground sm:text-sm/6">
          Then start the stack on local Postgres:
        </p>
        <div className="flex items-start gap-2 rounded-lg bg-fd-muted/60 py-2 pr-2 pl-4 ring-1 ring-fd-border ring-inset">
          <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-[0.8125rem]/6 text-fd-foreground">
            {next}
          </pre>
          <CopyIconButton text={next} label="Copy setup commands" />
        </div>
      </div>
    </div>
  );
}

/**
 * Landing-page and MDX "get started" widget: a personalized prompt for coding
 * agents, plus the equivalent terminal commands for people who'd rather type.
 */
export function GetStarted({ className }: { className?: string }) {
  const origin = useOrigin();
  const [mode, setMode] = useState<Mode>("prompt");
  const [name, setName] = useState(DEFAULT_PROJECT_NAME);
  const [tool, setTool] = useState<AgentToolId>("claude");
  const tabsId = useId();

  const tabs = [
    { id: "prompt" as const, label: "Agent prompt", icon: Sparkles },
    { id: "terminal" as const, label: "Terminal", icon: SquareTerminal },
  ];

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
            id={`${tabsId}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            aria-controls={`${tabsId}-${tab.id}-panel`}
            onClick={() => setMode(tab.id)}
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
            <p className="text-base/5 font-medium text-fd-foreground sm:text-sm/5">Coding agent</p>
            <Segmented label="Coding agent" value={tool} options={agentTools} onChange={setTool} />
          </div>
        </div>

        <div
          id={`${tabsId}-${mode}-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-${mode}-tab`}
        >
          {mode === "prompt" ? (
            <PromptPanel name={name} tool={tool} origin={origin} />
          ) : (
            <TerminalPanel name={name} tool={tool} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact copy control for MDX pages and secondary CTAs. */
export function CopyPromptButton({ className }: { className?: string }) {
  const origin = useOrigin();
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() =>
        void copy(buildAgentPrompt({ name: DEFAULT_PROJECT_NAME, tool: "claude", origin }))
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-md bg-fd-background py-2.5 pr-4 pl-3 text-base/6 font-medium text-fd-foreground ring-1 ring-fd-border hover:bg-fd-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring sm:py-2 sm:text-sm/6",
        className,
      )}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4 shrink-0 text-fd-primary" />
      ) : (
        <Copy aria-hidden="true" className="size-4 shrink-0" />
      )}
      {copied ? "Copied" : "Copy agent prompt"}
      <span className="sr-only" aria-live="polite">
        {copied ? "Prompt copied to clipboard" : ""}
      </span>
    </button>
  );
}
