import { Link, createFileRoute, isRedirect, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import ThemeToggle from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/UserMenu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { orpcClient } from "@/lib/orpc";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      return;
    }

    try {
      await orpcClient.staff.me();
      throw redirect({ to: "/" });
    } catch (error) {
      if (isRedirect(error)) {
        throw error;
      }
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setPending(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setAuthError(result.error.message ?? "sign-in failed");
        return;
      }
      await router.navigate({ to: "/" });
    } finally {
      setPending(false);
    }
  }

  const signedInNonStaff = Boolean(session.data?.user);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link to="/login" className="text-sm font-semibold tracking-tight no-underline">
          zstack admin
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        {signedInNonStaff ? (
          <Alert variant="destructive">
            <AlertTitle>Not staff</AlertTitle>
            <AlertDescription>
              Signed in as {session.data?.user.email}, but this account has no staff role. Bootstrap
              with{" "}
              <code>
                STAFF_EMAIL={session.data?.user.email} pnpm db:seed
              </code>
              .
            </AlertDescription>
            <div className="mt-3">
              <SignOutButton />
            </div>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Staff sign-in</CardTitle>
              <CardDescription>
                No self-serve sign-up. Create an account on the customer app, then promote via seed
                or Users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Loading session…
                </div>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <FieldDescription>At least 8 characters.</FieldDescription>
                    </Field>

                    {authError ? (
                      <Field data-invalid>
                        <FieldError>{authError}</FieldError>
                      </Field>
                    ) : null}
                  </FieldGroup>

                  <Button type="submit" disabled={pending} className="w-full">
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {pending ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
