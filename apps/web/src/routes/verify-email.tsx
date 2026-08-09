import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import AuthPageShell from "@/components/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { parseTokenSearch } from "@/lib/auth-search";

type VerifyState =
  | { kind: "missing-token" }
  | { kind: "pending" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export const Route = createFileRoute("/verify-email")({
  validateSearch: parseTokenSearch,
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const search = Route.useSearch();
  const [state, setState] = useState<VerifyState>(() =>
    search.token ? { kind: "pending" } : { kind: "missing-token" },
  );

  useEffect(() => {
    const token = search.token;
    if (!token) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await authClient.verifyEmail({
        query: { token },
      });
      if (cancelled) {
        return;
      }
      if (result.error) {
        setState({
          kind: "error",
          message: result.error.message ?? "Verification failed",
        });
        return;
      }
      setState({ kind: "success" });
    })();

    return () => {
      cancelled = true;
    };
  }, [search.token]);

  return (
    <AuthPageShell title="Verify email" description="Confirming your email address.">
      {state.kind === "missing-token" ? (
        <Alert variant="destructive">
          <AlertTitle>Missing token</AlertTitle>
          <AlertDescription>Open the link from your verification email.</AlertDescription>
        </Alert>
      ) : null}
      {state.kind === "pending" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Verifying…
        </div>
      ) : null}
      {state.kind === "success" ? (
        <Alert>
          <AlertTitle>Email verified</AlertTitle>
          <AlertDescription>
            You're all set.{" "}
            <Link to="/login" className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            to continue.
          </AlertDescription>
        </Alert>
      ) : null}
      {state.kind === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {search.error ? (
        <Alert variant="destructive">
          <AlertTitle>Link error</AlertTitle>
          <AlertDescription>{search.error}</AlertDescription>
        </Alert>
      ) : null}
    </AuthPageShell>
  );
}
