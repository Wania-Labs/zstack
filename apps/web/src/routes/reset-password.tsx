import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import * as m from "@zstack/i18n/messages";
import { useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { parseTokenSearch } from "@/lib/auth-search";

export const Route = createFileRoute("/reset-password")({
  validateSearch: parseTokenSearch,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!search.token) {
      setError(m["auth.resetPassword.errorMissingToken"]());
      return;
    }

    setPending(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: search.token,
      });
      if (result.error) {
        setError(result.error.message ?? m["auth.resetPassword.errorFallback"]());
        return;
      }
      await navigate({ to: "/login" });
    } finally {
      setPending(false);
    }
  }

  if (!search.token) {
    return (
      <AuthPageShell
        title={m["auth.resetPassword.title"]()}
        description={m["auth.resetPassword.descriptionInvalid"]()}
      >
        <Alert variant="destructive">
          <AlertTitle>{m["auth.resetPassword.missingTokenTitle"]()}</AlertTitle>
          <AlertDescription>
            {m["auth.resetPassword.missingTokenDescription"]()}{" "}
            <Link to="/forgot-password" className="underline underline-offset-4">
              {m["auth.resetPassword.forgotPasswordLink"]()}
            </Link>{" "}
            {m["auth.resetPassword.page"]()}
          </AlertDescription>
        </Alert>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title={m["auth.resetPassword.title"]()}
      description={m["auth.resetPassword.descriptionValid"]()}
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">{m["auth.resetPassword.newPassword"]()}</FieldLabel>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FieldDescription>{m["auth.resetPassword.passwordHint"]()}</FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{m["auth.resetPassword.errorTitle"]()}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? m["auth.resetPassword.submitPending"]() : m["auth.resetPassword.submit"]()}
        </Button>
      </form>
    </AuthPageShell>
  );
}
