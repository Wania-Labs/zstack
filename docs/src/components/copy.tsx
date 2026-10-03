import { Check, Copy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

function legacyCopy(text: string): boolean {
  const previousFocus = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();
  previousFocus?.focus();
  return ok;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is unavailable on insecure origins and in some embedded browsers.
    return legacyCopy(text);
  }
}

export type CopyState = "idle" | "copied" | "failed";

export function useCopy(resetAfterMs = 2000) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      setState((await writeClipboard(text)) ? "copied" : "failed");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), resetAfterMs);
    },
    [resetAfterMs],
  );

  return { state, copy };
}

export function CopyStateIcon({ state, className }: { state: CopyState; className?: string }) {
  const Icon = state === "copied" ? Check : state === "failed" ? X : Copy;
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}

export function copyAnnouncement(state: CopyState, what: string) {
  if (state === "copied") return `${what} copied to clipboard`;
  if (state === "failed") return "Copy failed. Select the text and copy it manually.";
  return "";
}

/** Square icon button that copies `text`. Announces the result to screen readers. */
export function CopyIconButton({
  text,
  label = "Copy to clipboard",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { state, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      aria-label={label}
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
      />
      <CopyStateIcon state={state} className={state === "copied" ? "text-fd-primary" : undefined} />
      <span className="sr-only" aria-live="polite">
        {copyAnnouncement(state, "Command")}
      </span>
    </button>
  );
}
