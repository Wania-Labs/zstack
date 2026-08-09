import { Link } from "@tanstack/react-router";

import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <Link to="/" className="text-sm font-semibold tracking-tight text-foreground no-underline">
          zstack
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
