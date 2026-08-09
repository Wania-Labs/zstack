import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/")({ component: AdminHomePage });

function AdminHomePage() {
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const staffQuery = useQuery({
    ...orpc.staff.me.queryOptions(),
    enabled: Boolean(session.data?.user),
    retry: false,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setPending(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setAuthError(result.error.message ?? "sign-in failed");
      }
    } finally {
      setPending(false);
    }
  }

  async function onSignOut() {
    await authClient.signOut();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Staff console</h1>
          <Badge variant="secondary">apps/admin</Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Staff-only shell. Sign-in uses the shared Better Auth identity; Hono rejects non-staff
          before private content.
        </p>
      </div>

      {!session.data?.user ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Staff sign-in</CardTitle>
            <CardDescription>
              No self-serve sign-up here. Create an account on the customer app, then promote with{" "}
              <code>STAFF_EMAIL=… pnpm db:seed</code>.
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
      ) : null}

      {session.data?.user ? (
        <>
          {staffQuery.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Checking staff access…
            </div>
          ) : null}

          {staffQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Not staff</AlertTitle>
              <AlertDescription>
                Signed in as {session.data.user.email}, but this account has no staff role. Promote
                with <code>STAFF_EMAIL={session.data.user.email} pnpm db:seed</code>, then refresh.
              </AlertDescription>
              <div className="mt-3">
                <Button type="button" variant="outline" onClick={() => void onSignOut()}>
                  Sign out
                </Button>
              </div>
            </Alert>
          ) : null}

          {staffQuery.data ? (
            <Card>
              <CardHeader>
                <CardTitle>Console</CardTitle>
                <CardDescription>
                  Staff gate passed via <code>staff.me</code>. Ops surfaces land in later slices.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-sm">
                  {JSON.stringify(staffQuery.data, null, 2)}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() => void onSignOut()}
                >
                  Sign out
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
