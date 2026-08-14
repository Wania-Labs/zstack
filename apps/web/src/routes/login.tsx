import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import * as m from "@zstack/i18n/messages";
import { useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { parseAuthRedirectSearch } from "@/lib/auth-search";
import {
  ensureGuest,
  listTeams,
  loadAuthSnapshot,
  resolveAppDestination,
  safeInternalPath,
} from "@/lib/session";

export const Route = createFileRoute("/login")({
  validateSearch: parseAuthRedirectSearch,
  beforeLoad: async ({ search }) => {
    await ensureGuest(search.redirect ? { redirectTo: search.redirect } : undefined);
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
        return;
      }

      const redirectTo = safeInternalPath(search.redirect);
      if (redirectTo) {
        router.history.push(redirectTo);
        return;
      }

      const auth = await loadAuthSnapshot();
      if (auth.kind !== "authenticated") {
        await navigate({ to: "/app" });
        return;
      }

      const teams = await listTeams();
      const destination = resolveAppDestination({
        teams,
        activeOrganizationId: auth.activeOrganizationId,
      });
      await navigate(destination);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthPageShell title={m["auth.signIn.title"]()} description={m["auth.signIn.description"]()}>
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">{m["auth.signIn.email"]()}</FieldLabel>
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
            <FieldLabel htmlFor="password">{m["auth.signIn.password"]()}</FieldLabel>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not sign in</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? m["auth.signIn.submitPending"]() : m["auth.signIn.submit"]()}
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <Link to="/forgot-password" className="underline-offset-4 hover:underline">
          Forgot password?
        </Link>
        <p>
          No account?{" "}
          <Link
            to="/sign-up"
            search={search.redirect ? { redirect: search.redirect } : {}}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
