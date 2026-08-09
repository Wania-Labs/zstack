import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
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
      setError("This reset link is missing a token.");
      return;
    }

    setPending(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: search.token,
      });
      if (result.error) {
        setError(result.error.message ?? "Could not reset password");
        return;
      }
      await navigate({ to: "/login" });
    } finally {
      setPending(false);
    }
  }

  if (!search.token) {
    return (
      <AuthPageShell title="Reset password" description="This link is invalid or incomplete.">
        <Alert variant="destructive">
          <AlertTitle>Missing token</AlertTitle>
          <AlertDescription>
            Request a new reset link from the{" "}
            <Link to="/forgot-password" className="underline underline-offset-4">
              forgot password
            </Link>{" "}
            page.
          </AlertDescription>
        </Alert>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title="Reset password" description="Choose a new password for your account.">
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
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
              <AlertTitle>Reset failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
