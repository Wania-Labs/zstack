import { Link, createFileRoute } from "@tanstack/react-router";
import * as m from "@zstack/i18n/messages";
import { useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { ensureGuest } from "@/lib/session";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async () => {
    await ensureGuest();
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError(result.error.message ?? m["auth.forgotPassword.errorFallback"]());
        return;
      }
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthPageShell
      title={m["auth.forgotPassword.title"]()}
      description={m["auth.forgotPassword.description"]()}
    >
      {sent ? (
        <Alert>
          <AlertTitle>{m["auth.forgotPassword.successTitle"]()}</AlertTitle>
          <AlertDescription>{m["auth.forgotPassword.successDescription"]()}</AlertDescription>
        </Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{m["auth.forgotPassword.email"]()}</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{m["auth.forgotPassword.errorTitle"]()}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? m["auth.forgotPassword.submitPending"]() : m["auth.forgotPassword.submit"]()}
          </Button>
        </form>
      )}
      <p className="text-sm text-muted-foreground">
        <Link
          to="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {m["auth.forgotPassword.backToSignIn"]()}
        </Link>
      </p>
    </AuthPageShell>
  );
}
