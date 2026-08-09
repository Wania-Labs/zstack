import { Link, createFileRoute } from "@tanstack/react-router";

import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  component: MarketingHomePage,
});

function MarketingHomePage() {
  const session = authClient.useSession();
  const signedIn = Boolean(session.data?.user);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background/80 backdrop-blur-lg">
        <nav className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-foreground no-underline"
          >
            zstack
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Button render={<Link to="/app" />} size="sm">
                Open app
              </Button>
            ) : (
              <>
                <Button render={<Link to="/login" />} variant="ghost" size="sm">
                  Sign in
                </Button>
                <Button render={<Link to="/sign-up" />} size="sm">
                  Sign up
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="text-4xl font-semibold tracking-tight">zstack</h1>
        <p className="max-w-xl text-muted-foreground">
          A product starter with Teams, auth, and an appshell ready for your features.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {signedIn ? (
            <Button render={<Link to="/app" />}>Open app</Button>
          ) : (
            <>
              <Button render={<Link to="/sign-up" />}>Get started</Button>
              <Button render={<Link to="/login" />} variant="outline">
                Sign in
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
