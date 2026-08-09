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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const healthQuery = useQuery(orpc.health.queryOptions());
  const session = authClient.useSession();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setPending(true);

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
        });
        if (result.error) {
          setAuthError(result.error.message ?? "sign-up failed");
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        if (result.error) {
          setAuthError(result.error.message ?? "sign-in failed");
        }
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
          <h1 className="text-3xl font-semibold tracking-tight">zstack</h1>
          <Badge variant="secondary">apps/web</Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          TanStack Start shell talking to the Hono API over same-origin <code>/api/*</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API health</CardTitle>
          <CardDescription>oRPC contract via the Vite proxy to apps/api.</CardDescription>
        </CardHeader>
        <CardContent>
          {healthQuery.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Checking…
            </div>
          ) : null}
          {healthQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>API unreachable</AlertTitle>
              <AlertDescription>
                Failed to reach <code>/api/rpc/health</code>. Is <code>apps/api</code> running on
                :8787?
              </AlertDescription>
            </Alert>
          ) : null}
          {healthQuery.data ? (
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-sm">
              {JSON.stringify(healthQuery.data, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Better Auth email/password over same-origin /api/auth.</CardDescription>
        </CardHeader>
        <CardContent>
          {session.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Loading session…
            </div>
          ) : null}

          {session.data?.user ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Signed in as <span className="font-medium">{session.data.user.email}</span>
              </p>
              <Button type="button" variant="outline" onClick={() => void onSignOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  if (value === "sign-in" || value === "sign-up") {
                    setMode(value);
                    setAuthError(null);
                  }
                }}
              >
                <TabsList>
                  <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                  <TabsTrigger value="sign-up">Sign up</TabsTrigger>
                </TabsList>
              </Tabs>

              <FieldGroup>
                {mode === "sign-up" ? (
                  <Field>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                      id="name"
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                ) : null}

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
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
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
                {pending ? "Working…" : mode === "sign-up" ? "Create account" : "Sign in"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
