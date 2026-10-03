import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const TOKEN =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|export|const|function|yield|return|if|new|type)\b|\b([A-Z][A-Za-z0-9]*)\b/gm;

/** Tiny TypeScript tinter for static marketing snippets. Not a general highlighter. */
function tint(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(code.slice(last, index));
    const [text, comment, string, keyword] = match;
    const className = comment
      ? "text-fd-muted-foreground italic"
      : string
        ? "text-amber-700 dark:text-amber-300"
        : keyword
          ? "text-fd-primary"
          : "text-sky-700 dark:text-sky-300";
    out.push(
      <span key={index} className={className}>
        {text}
      </span>,
    );
    last = index + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodePanel({
  filename,
  code,
  className,
}: {
  filename: string;
  code: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-xl bg-fd-card ring-1 ring-fd-foreground/10 dark:ring-fd-border",
        className,
      )}
    >
      <figcaption className="flex items-center gap-2 border-b border-fd-foreground/10 px-4 py-2.5 font-mono text-sm/5 text-fd-muted-foreground dark:border-fd-border sm:text-xs/5">
        {filename}
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem]/6 text-fd-foreground">
        <code>
          {code.split("\n").map((line, i) => (
            <Fragment key={i}>
              {tint(line)}
              {"\n"}
            </Fragment>
          ))}
        </code>
      </pre>
    </figure>
  );
}
