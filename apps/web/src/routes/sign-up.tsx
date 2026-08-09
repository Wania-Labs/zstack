import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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

export const Route = createFileRoute("/sign-up")({
  validateSearch: parseAuthRedirectSearch,
  beforeLoad: async ({ search }) => {
    await ensureGuest(search.redirect ? { redirectTo: search.redirect } : undefined);
  },
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign up failed");
        return;
      }

      const redirectTo = safeInternalPath(search.redirect);
      if (redirectTo) {
        router.history.push(redirectTo);
        return;
      }

      const auth = await loadAuthSnapshot();
      if (auth.kind !== "authenticated") {
        await navigate({ to: "/login" });
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
    <AuthPageShell title="Create account" description="Start with a Team after you sign up.">
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FieldDescription>At least 8 characters.</FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not sign up</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          search={search.redirect ? { redirect: search.redirect } : {}}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
