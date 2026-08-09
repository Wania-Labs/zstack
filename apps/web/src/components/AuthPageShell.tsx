import { Link } from "@tanstack/react-router";

import ThemeToggle from "./ThemeToggle";

export default function AuthPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background/80 backdrop-blur-lg">
        <nav className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-foreground no-underline">
            zstack
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
